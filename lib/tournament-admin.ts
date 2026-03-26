import { randomUUID } from "node:crypto";

import {
  isGoogleSheetsConfigured,
  readMultipleSheetRows,
  replaceMultipleSheetTabs,
  type RawSheetRow,
} from "@/lib/google-sheets";
import { computeMatchTotals, countRecordedSets } from "@/lib/score-utils";
import {
  generateDoubleEliminationSchedule,
  generateRoundRobinSchedule,
  generateSingleEliminationSchedule,
  isInactiveGrandFinalResetMatch,
} from "@/lib/schedule-generator";
import type {
  MatchRecord,
  MatchSetRecord,
  PlayerRecord,
  ScoringMode,
  TournamentFormat,
  TournamentStatus,
} from "@/lib/tournament-types";

type SheetDataset = {
  tournaments: RawSheetRow[];
  players: RawSheetRow[];
  matches: RawSheetRow[];
  matchSets: RawSheetRow[];
  standings: RawSheetRow[];
  eventLog: RawSheetRow[];
};

type TournamentConfig = {
  format: TournamentFormat;
  scoringMode: ScoringMode;
  targetScore: number | null;
  setCount: number | null;
};

export type CreateTournamentInput = {
  name: string;
  format: TournamentFormat;
  venue: string;
  scoringMode: ScoringMode;
  targetScore: number | null;
  setCount: number | null;
  playerNames: string[];
  randomize: boolean;
  status: Extract<TournamentStatus, "draft" | "live">;
};

type AdjustSetScoreInput = {
  tournamentId: string;
  matchId: string;
  setId: string;
  side: "player1" | "player2";
  delta: number;
};

type SetSetScoreInput = {
  tournamentId: string;
  matchId: string;
  setId: string;
  player1Score: number;
  player2Score: number;
};

type AddMatchSetInput = {
  tournamentId: string;
  matchId: string;
};

type OverrideMatchTotalInput = {
  tournamentId: string;
  matchId: string;
  player1Total: number;
  player2Total: number;
};

function ensureWritableMode() {
  if (!isGoogleSheetsConfigured()) {
    throw new Error("目前尚未完成 Google Sheets 寫入設定。");
  }
}

function nowIso() {
  return new Date().toISOString();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getUniqueSlug(base: string, existing: Set<string>) {
  let candidate = base || `tournament-${Date.now()}`;
  let counter = 2;

  while (existing.has(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function parseNumber(value: string | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function loadDataset(): Promise<SheetDataset> {
  const rowsByTab = await readMultipleSheetRows([
    "tournaments",
    "players",
    "matches",
    "match_sets",
    "standings",
    "event_log",
  ]);
  const tournaments = rowsByTab.tournaments;
  const players = rowsByTab.players;
  const matches = rowsByTab.matches;
  const matchSets = rowsByTab.match_sets;
  const standings = rowsByTab.standings;
  const eventLog = rowsByTab.event_log;

  return {
    tournaments,
    players,
    matches,
    matchSets,
    standings,
    eventLog,
  };
}

function parsePlayerRows(rows: RawSheetRow[]): PlayerRecord[] {
  return rows.map((row) => ({
    id: row.player_id,
    tournamentId: row.tournament_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || null,
    seed: row.seed ? parseNumber(row.seed, 0) : null,
    status:
      row.status === "eliminated" || row.status === "withdrawn"
        ? row.status
        : "active",
    createdAt: row.created_at || nowIso(),
  }));
}

function parseMatchSetRows(rows: RawSheetRow[]): MatchSetRecord[] {
  return rows.map((row) => ({
    id: row.set_id,
    matchId: row.match_id,
    setNo: parseNumber(row.set_no, 1),
    player1Score: parseNumber(row.player1_score, 0),
    player2Score: parseNumber(row.player2_score, 0),
    note: row.note || null,
    updatedAt: row.updated_at || nowIso(),
  }));
}

function parseMatchRows(rows: RawSheetRow[], sets: MatchSetRecord[]): MatchRecord[] {
  return rows.map((row) => ({
    id: row.match_id,
    tournamentId: row.tournament_id,
    roundName: row.round_name || "未命名輪次",
    roundOrder: parseNumber(row.round_order, 1),
    matchOrder: parseNumber(row.match_order, 1),
    player1Id: row.player1_id,
    player2Id: row.player2_id,
    state:
      row.state === "completed" || row.state === "live" ? row.state : "scheduled",
    isFeatured: row.is_featured === "TRUE",
    scheduledLabel: row.scheduled_label || "",
    updatedAt: row.updated_at || nowIso(),
    sets: sets
      .filter((set) => set.matchId === row.match_id)
      .toSorted((left, right) => left.setNo - right.setNo),
  }));
}

function playerRow(player: PlayerRecord): RawSheetRow {
  return {
    player_id: player.id,
    tournament_id: player.tournamentId,
    display_name: player.displayName,
    seed: player.seed ? String(player.seed) : "",
    status: player.status,
    avatar_url: player.avatarUrl ?? "",
    created_at: player.createdAt,
  };
}

function matchSetRow(set: MatchSetRecord): RawSheetRow {
  return {
    set_id: set.id,
    match_id: set.matchId,
    set_no: String(set.setNo),
    player1_score: String(set.player1Score),
    player2_score: String(set.player2Score),
    note: set.note ?? "",
    updated_at: set.updatedAt,
  };
}

function getResolvedWinnerId(match: MatchRecord) {
  const totals = computeMatchTotals(match.sets);

  if (match.player1Id.startsWith("bye:")) {
    return match.player2Id;
  }

  if (match.player2Id.startsWith("bye:")) {
    return match.player1Id;
  }

  if (match.state !== "completed" || totals.player1Total === totals.player2Total) {
    return "";
  }

  return totals.player1Total > totals.player2Total
    ? match.player1Id
    : match.player2Id;
}

function isReadyMatch(match: MatchRecord) {
  return (
    !match.player1Id.startsWith("pending:") && !match.player2Id.startsWith("pending:")
  );
}

function isByeMatch(match: MatchRecord) {
  return match.player1Id.startsWith("bye:") || match.player2Id.startsWith("bye:");
}

function getMatchState(
  match: MatchRecord,
  config: TournamentConfig,
  forceComplete = false,
) {
  if (!isReadyMatch(match)) {
    return "scheduled" as const;
  }

  if (isByeMatch(match)) {
    return "completed" as const;
  }

  const totals = computeMatchTotals(match.sets);
  const hasAnyScore =
    totals.player1Total > 0 ||
    totals.player2Total > 0 ||
    countRecordedSets(match.sets) > 0 ||
    match.state === "live";

  if (
    (forceComplete || match.state === "completed") &&
    totals.player1Total !== totals.player2Total
  ) {
    return "completed" as const;
  }

  if (config.scoringMode === "target_score") {
    const target = config.targetScore ?? 0;
    const reachedTarget =
      target > 0 &&
      (totals.player1Total >= target || totals.player2Total >= target) &&
      totals.player1Total !== totals.player2Total;

    if (reachedTarget) {
      return "completed" as const;
    }

    return hasAnyScore ? ("live" as const) : ("scheduled" as const);
  }

  const requiredSetCount = Math.max(1, config.setCount ?? match.sets.length);
  const recordedSetCount = countRecordedSets(match.sets);

  if (
    recordedSetCount >= requiredSetCount &&
    totals.player1Total !== totals.player2Total
  ) {
    return "completed" as const;
  }

  return hasAnyScore ? ("live" as const) : ("scheduled" as const);
}

function serializeMatches(matches: MatchRecord[]) {
  return matches.map((match) => {
    const totals = computeMatchTotals(match.sets);

    return {
      match_id: match.id,
      tournament_id: match.tournamentId,
      round_name: match.roundName,
      round_order: String(match.roundOrder),
      match_order: String(match.matchOrder),
      player1_id: match.player1Id,
      player2_id: match.player2Id,
      player1_total: String(totals.player1Total),
      player2_total: String(totals.player2Total),
      winner_id: getResolvedWinnerId(match),
      state: match.state,
      is_featured: match.isFeatured ? "TRUE" : "FALSE",
      scheduled_label: match.scheduledLabel,
      updated_at: match.updatedAt,
    };
  });
}

function serializeMatchSets(matches: MatchRecord[]) {
  return matches.flatMap((match) => match.sets.map(matchSetRow));
}

function buildStandingsRows(
  tournamentId: string,
  players: PlayerRecord[],
  matches: MatchRecord[],
  updatedAt: string,
) {
  const standings = new Map(
    players.map((player) => [
      player.id,
      {
        tournament_id: tournamentId,
        player_id: player.id,
        wins: 0,
        losses: 0,
        points_for: 0,
        points_against: 0,
        point_diff: 0,
        rank: 0,
        updated_at: updatedAt,
      },
    ]),
  );

  for (const match of matches) {
    if (
      match.state !== "completed" ||
      match.player1Id.startsWith("pending:") ||
      match.player2Id.startsWith("pending:") ||
      match.player1Id.startsWith("bye:") ||
      match.player2Id.startsWith("bye:")
    ) {
      continue;
    }

    const left = standings.get(match.player1Id);
    const right = standings.get(match.player2Id);

    if (!left || !right) {
      continue;
    }

    const totals = computeMatchTotals(match.sets);
    left.points_for += totals.player1Total;
    left.points_against += totals.player2Total;
    left.point_diff = left.points_for - left.points_against;

    right.points_for += totals.player2Total;
    right.points_against += totals.player1Total;
    right.point_diff = right.points_for - right.points_against;

    const winnerId = getResolvedWinnerId(match);

    if (winnerId === match.player1Id) {
      left.wins += 1;
      right.losses += 1;
    } else if (winnerId === match.player2Id) {
      right.wins += 1;
      left.losses += 1;
    }
  }

  return [...standings.values()]
    .toSorted((left, right) => {
      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }

      if (right.point_diff !== left.point_diff) {
        return right.point_diff - left.point_diff;
      }

      if (right.points_for !== left.points_for) {
        return right.points_for - left.points_for;
      }

      return left.player_id.localeCompare(right.player_id);
    })
    .map((standing, index) => ({
      tournament_id: standing.tournament_id,
      player_id: standing.player_id,
      wins: String(standing.wins),
      losses: String(standing.losses),
      points_for: String(standing.points_for),
      points_against: String(standing.points_against),
      point_diff: String(standing.point_diff),
      rank: String(index + 1),
      updated_at: standing.updated_at,
    }));
}

function createEventLogRow(
  tournamentId: string,
  matchId: string | null,
  action: string,
  payload: Record<string, unknown>,
) {
  return {
    log_id: randomUUID(),
    tournament_id: tournamentId,
    match_id: matchId ?? "",
    action,
    payload: JSON.stringify(payload),
    created_at: nowIso(),
  };
}

function getTournamentRow(dataset: SheetDataset, tournamentId: string) {
  const row = dataset.tournaments.find(
    (entry) => entry.tournament_id === tournamentId,
  );

  if (!row) {
    throw new Error("找不到指定的賽事。");
  }

  return row;
}

function isMatchResolved(match: MatchRecord) {
  if (isInactiveGrandFinalResetMatch(match)) {
    return true;
  }

  if (!isReadyMatch(match)) {
    return false;
  }

  if (isByeMatch(match)) {
    return true;
  }

  return match.state === "completed";
}

function resolveCurrentMatchId(matches: MatchRecord[]) {
  const activeMatches = matches.filter(
    (match) => !isInactiveGrandFinalResetMatch(match),
  );
  const liveMatch = activeMatches.find((match) => match.state === "live");
  if (liveMatch) {
    return liveMatch.id;
  }

  const nextScheduled = activeMatches.find(
    (match) => match.state === "scheduled" && isReadyMatch(match) && !isByeMatch(match),
  );
  if (nextScheduled) {
    return nextScheduled.id;
  }

  const fallbackScheduled = activeMatches.find((match) => match.state === "scheduled");
  if (fallbackScheduled) {
    return fallbackScheduled.id;
  }

  return activeMatches.find((match) => match.state === "completed")?.id ?? "";
}

function resolveTournamentStatus(
  tournamentRow: RawSheetRow,
  matches: MatchRecord[],
  timestamp: string,
) {
  const allResolved = matches.length > 0 && matches.every(isMatchResolved);

  if (allResolved) {
    return {
      status: "completed",
      endedAt: tournamentRow.ended_at || timestamp,
    };
  }

  if (tournamentRow.status === "completed") {
    return {
      status: "live",
      endedAt: "",
    };
  }

  return {
    status: tournamentRow.status || "live",
    endedAt: tournamentRow.ended_at || "",
  };
}

function getTournamentMatchIds(dataset: SheetDataset, tournamentId: string) {
  return new Set(
    dataset.matches
      .filter((row) => row.tournament_id === tournamentId)
      .map((row) => row.match_id),
  );
}

function getResetSetCount(match: MatchRecord, config: TournamentConfig) {
  if (config.scoringMode === "set_total") {
    return Math.max(1, config.setCount ?? match.sets.length ?? 1);
  }

  return 1;
}

function createResetSets(
  match: MatchRecord,
  config: TournamentConfig,
  timestamp: string,
) {
  const count = getResetSetCount(match, config);

  return Array.from({ length: count }, (_, index): MatchSetRecord => ({
    id: `${match.id}-set-${index + 1}`,
    matchId: match.id,
    setNo: index + 1,
    player1Score: 0,
    player2Score: 0,
    note: null,
    updatedAt: timestamp,
  }));
}

function createAutoByeId(matchId: string, slot: 1 | 2) {
  return `bye:auto:${matchId}:${slot}`;
}

function resetFutureMatch(
  match: MatchRecord,
  config: TournamentConfig,
  timestamp: string,
) {
  return {
    ...match,
    player1Id: `pending:${match.id}:1`,
    player2Id: `pending:${match.id}:2`,
    state: "scheduled" as const,
    updatedAt: timestamp,
    sets: createResetSets(match, config, timestamp),
  };
}

function rebuildSingleEliminationMatches(
  matches: MatchRecord[],
  config: TournamentConfig,
  fromRoundOrder: number,
  timestamp: string,
) {
  const sorted = matches.toSorted(
    (left, right) =>
      left.roundOrder - right.roundOrder || left.matchOrder - right.matchOrder,
  );

  const rebuilt = sorted.map((match) =>
    match.roundOrder > fromRoundOrder
      ? resetFutureMatch(match, config, timestamp)
      : match,
  );

  for (const match of rebuilt) {
    match.state = getMatchState(match, config);
    match.updatedAt = timestamp;

    const winnerId = getResolvedWinnerId(match);
    const nextMatch = rebuilt.find(
      (candidate) =>
        candidate.roundOrder === match.roundOrder + 1 &&
        candidate.matchOrder === Math.ceil(match.matchOrder / 2),
    );

    if (!nextMatch || !winnerId) {
      continue;
    }

    if (match.matchOrder % 2 === 1) {
      nextMatch.player1Id = winnerId;
    } else {
      nextMatch.player2Id = winnerId;
    }
  }

  return rebuilt;
}

type DoubleEliminationMatchMeta =
  | { bracket: "wb"; roundOrder: number; matchOrder: number }
  | { bracket: "lb"; roundOrder: number; matchOrder: number }
  | { bracket: "gf"; roundOrder: 1 | 2; matchOrder: 1 };

function parseDoubleEliminationMatchMeta(matchId: string): DoubleEliminationMatchMeta | null {
  const wb = matchId.match(/-de-wb-r(\d+)-m(\d+)$/);
  if (wb) {
    return {
      bracket: "wb",
      roundOrder: Number(wb[1]),
      matchOrder: Number(wb[2]),
    };
  }

  const lb = matchId.match(/-de-lb-r(\d+)-m(\d+)$/);
  if (lb) {
    return {
      bracket: "lb",
      roundOrder: Number(lb[1]),
      matchOrder: Number(lb[2]),
    };
  }

  const gf = matchId.match(/-de-gf-(1|2)$/);
  if (gf) {
    return {
      bracket: "gf",
      roundOrder: Number(gf[1]) as 1 | 2,
      matchOrder: 1,
    };
  }

  return null;
}

function getResolvedLoserId(match: MatchRecord) {
  const totals = computeMatchTotals(match.sets);

  if (match.player1Id.startsWith("bye:") && !match.player2Id.startsWith("bye:")) {
    return match.player1Id;
  }

  if (match.player2Id.startsWith("bye:") && !match.player1Id.startsWith("bye:")) {
    return match.player2Id;
  }

  if (match.state !== "completed" || totals.player1Total === totals.player2Total) {
    return "";
  }

  return totals.player1Total > totals.player2Total
    ? match.player2Id
    : match.player1Id;
}

function resolveWinnerSlot(match: MatchRecord | undefined) {
  if (!match) {
    return "";
  }

  return getResolvedWinnerId(match);
}

function resolveLoserSlot(match: MatchRecord | undefined) {
  if (!match) {
    return "";
  }

  return getResolvedLoserId(match);
}

function applyParticipantsToMatch(
  match: MatchRecord,
  player1Candidate: string,
  player2Candidate: string,
  config: TournamentConfig,
  timestamp: string,
) {
  const player1Id = player1Candidate || `pending:${match.id}:1`;
  let player2Id = player2Candidate || `pending:${match.id}:2`;

  if (
    !player1Id.startsWith("pending:") &&
    !player2Id.startsWith("pending:") &&
    player1Id === player2Id
  ) {
    player2Id = createAutoByeId(match.id, 2);
  }

  const participantsChanged =
    player1Id !== match.player1Id || player2Id !== match.player2Id;

  const next: MatchRecord = {
    ...match,
    player1Id,
    player2Id,
    updatedAt: timestamp,
    sets: participantsChanged ? createResetSets(match, config, timestamp) : match.sets,
  };

  if (isInactiveGrandFinalResetMatch(next)) {
    next.state = "completed";
    return next;
  }

  if (!isReadyMatch(next)) {
    next.state = "scheduled";
    return next;
  }

  if (isByeMatch(next)) {
    const [head, ...tail] =
      next.sets.length > 0 ? next.sets : createResetSets(next, config, timestamp);

    next.sets = [
      {
        ...head,
        player1Score: next.player1Id.startsWith("bye:") ? 0 : 1,
        player2Score: next.player2Id.startsWith("bye:") ? 0 : 1,
        note: isInactiveGrandFinalResetMatch(next) ? "重置戰未啟用" : "輪空晉級",
        updatedAt: timestamp,
      },
      ...tail.map((set, index) => ({
        ...set,
        setNo: index + 2,
        player1Score: 0,
        player2Score: 0,
        note: null,
        updatedAt: timestamp,
      })),
    ];
    next.state = "completed";
    return next;
  }

  next.state = getMatchState(next, config);
  return next;
}

function rebuildDoubleEliminationMatches(
  matches: MatchRecord[],
  config: TournamentConfig,
  timestamp: string,
) {
  const clonedById = new Map(
    matches.map((match) => [
      match.id,
      {
        ...match,
        sets: match.sets.map((set) => ({ ...set })),
      },
    ]),
  );

  const wbRounds = new Map<number, MatchRecord[]>();
  const lbRounds = new Map<number, MatchRecord[]>();
  const gfRounds = new Map<1 | 2, MatchRecord[]>();

  for (const match of clonedById.values()) {
    const meta = parseDoubleEliminationMatchMeta(match.id);
    if (!meta) {
      continue;
    }

    if (meta.bracket === "wb") {
      const bucket = wbRounds.get(meta.roundOrder) ?? [];
      bucket.push(match);
      wbRounds.set(meta.roundOrder, bucket);
      continue;
    }

    if (meta.bracket === "lb") {
      const bucket = lbRounds.get(meta.roundOrder) ?? [];
      bucket.push(match);
      lbRounds.set(meta.roundOrder, bucket);
      continue;
    }

    const bucket = gfRounds.get(meta.roundOrder) ?? [];
    bucket.push(match);
    gfRounds.set(meta.roundOrder, bucket);
  }

  for (const bucket of [...wbRounds.values(), ...lbRounds.values(), ...gfRounds.values()]) {
    bucket.sort((left, right) => left.matchOrder - right.matchOrder);
  }

  const totalWbRounds = Math.max(0, ...wbRounds.keys());
  const wbRound1 = wbRounds.get(1) ?? [];
  const wbRound1Entrants = wbRound1.map((match) => [match.player1Id, match.player2Id] as const);

  wbRound1.forEach((match, index) => {
    const [player1Id, player2Id] = wbRound1Entrants[index] ?? [
      `pending:${match.id}:1`,
      `pending:${match.id}:2`,
    ];
    const next = applyParticipantsToMatch(
      match,
      player1Id,
      player2Id,
      config,
      timestamp,
    );
    clonedById.set(
      match.id,
      next,
    );
    wbRound1[index] = next;
  });

  for (let roundOrder = 2; roundOrder <= totalWbRounds; roundOrder += 1) {
    const prevRound = wbRounds.get(roundOrder - 1) ?? [];
    const currentRound = wbRounds.get(roundOrder) ?? [];

    currentRound.forEach((match, index) => {
      const leftSource = prevRound[index * 2];
      const rightSource = prevRound[index * 2 + 1];
      const next = applyParticipantsToMatch(
        match,
        resolveWinnerSlot(leftSource),
        resolveWinnerSlot(rightSource),
        config,
        timestamp,
      );
      clonedById.set(match.id, next);
      currentRound[index] = next;
    });
  }

  if (totalWbRounds > 1) {
    const totalLbRounds = (totalWbRounds - 1) * 2;

    for (let lbRoundOrder = 1; lbRoundOrder <= totalLbRounds; lbRoundOrder += 1) {
      const currentRound = lbRounds.get(lbRoundOrder) ?? [];

      currentRound.forEach((match, index) => {
        let player1Id = "";
        let player2Id = "";

        if (lbRoundOrder === 1) {
          const wbFirstRound = wbRounds.get(1) ?? [];
          player1Id = resolveLoserSlot(wbFirstRound[index * 2]);
          player2Id = resolveLoserSlot(wbFirstRound[index * 2 + 1]);
        } else if (lbRoundOrder % 2 === 0) {
          const phase = lbRoundOrder / 2;
          const previousLbRound = lbRounds.get(lbRoundOrder - 1) ?? [];
          const wbSourceRound = wbRounds.get(phase + 1) ?? [];
          player1Id = resolveWinnerSlot(previousLbRound[index]);
          player2Id = resolveLoserSlot(wbSourceRound[index]);
        } else {
          const previousLbRound = lbRounds.get(lbRoundOrder - 1) ?? [];
          player1Id = resolveWinnerSlot(previousLbRound[index * 2]);
          player2Id = resolveWinnerSlot(previousLbRound[index * 2 + 1]);
        }

        const next = applyParticipantsToMatch(
          match,
          player1Id,
          player2Id,
          config,
          timestamp,
        );
        clonedById.set(match.id, next);
        currentRound[index] = next;
      });
    }
  }

  const wbFinal = wbRounds.get(totalWbRounds)?.[0];
  const lbFinal =
    totalWbRounds > 1 ? lbRounds.get((totalWbRounds - 1) * 2)?.[0] : undefined;
  const gf1 = gfRounds.get(1)?.[0];

  if (gf1) {
    const gf1Updated = applyParticipantsToMatch(
      gf1,
      resolveWinnerSlot(wbFinal),
      totalWbRounds > 1 ? resolveWinnerSlot(lbFinal) : resolveLoserSlot(wbFinal),
      config,
      timestamp,
    );
    clonedById.set(gf1.id, gf1Updated);
    gfRounds.set(1, [gf1Updated]);
  }

  const gf2 = gfRounds.get(2)?.[0];
  const latestGf1 = gfRounds.get(1)?.[0];

  if (gf2 && latestGf1) {
    const needsReset =
      latestGf1.state === "completed" &&
      getResolvedWinnerId(latestGf1) === latestGf1.player2Id &&
      !latestGf1.player1Id.startsWith("pending:") &&
      !latestGf1.player2Id.startsWith("pending:") &&
      !latestGf1.player1Id.startsWith("bye:") &&
      !latestGf1.player2Id.startsWith("bye:");

    const gf2Updated = needsReset
      ? applyParticipantsToMatch(
          gf2,
          latestGf1.player1Id,
          latestGf1.player2Id,
          config,
          timestamp,
        )
      : applyParticipantsToMatch(
          gf2,
          "bye:gf2-inactive:1",
          "bye:gf2-inactive:2",
          config,
          timestamp,
        );

    clonedById.set(gf2.id, gf2Updated);
    gfRounds.set(2, [gf2Updated]);
  }

  return [...clonedById.values()].toSorted(
    (left, right) =>
      left.roundOrder - right.roundOrder || left.matchOrder - right.matchOrder,
  );
}

function buildHeroSummary(
  name: string,
  format: TournamentFormat,
  scoringMode: ScoringMode,
) {
  const formatLabel =
    format === "single_elimination"
      ? "單淘汰"
      : format === "double_elimination"
        ? "雙敗淘汰"
        : "循環賽";
  const scoringLabel = scoringMode === "target_score" ? "目標分制" : "分局加總制";
  return `${name} 採用 ${formatLabel}，並以 ${scoringLabel} 進行比賽。`;
}

function validateCreateInput(input: CreateTournamentInput) {
  if (!input.name.trim()) {
    throw new Error("請先輸入賽事名稱。");
  }

  const names = input.playerNames;

  if (names.length < 2) {
    throw new Error("至少需要 2 位參賽者。");
  }

  if (names.some((name) => !name.trim())) {
    throw new Error("參賽者名稱不能留白。");
  }

  if (new Set(names.map((name) => name.trim())).size !== names.length) {
    throw new Error("參賽者名稱不能重複。");
  }

  if (
    (input.format === "single_elimination" ||
      input.format === "double_elimination") &&
    names.length > 64
  ) {
    throw new Error("淘汰賽模式第一版最多支援 64 位參賽者。");
  }

  if (input.scoringMode === "target_score") {
    if (!input.targetScore || input.targetScore < 1) {
      throw new Error("目標分制必須設定勝利分數。");
    }
  }

  if (input.scoringMode === "set_total") {
    if (!input.setCount || input.setCount < 1 || input.setCount > 9) {
      throw new Error("分局加總制的局數必須介於 1 到 9。");
    }
  }
}

function getTournamentConfig(row: RawSheetRow, matches: MatchRecord[]): TournamentConfig {
  const maxSetCount =
    Math.max(0, ...matches.map((match) => match.sets.length)) || null;
  const scoringMode =
    row.scoring_mode === "target_score" || row.scoring_mode === "set_total"
      ? row.scoring_mode
      : maxSetCount && maxSetCount > 1
        ? "set_total"
        : "target_score";

  return {
    format:
      row.format === "round_robin"
        ? "round_robin"
        : row.format === "double_elimination"
          ? "double_elimination"
          : "single_elimination",
    scoringMode,
    targetScore:
      scoringMode === "target_score"
        ? parseNumber(row.target_score || row.win_score_rule, 0) || null
        : null,
    setCount:
      scoringMode === "set_total"
        ? parseNumber(row.set_count, 0) || maxSetCount || 1
        : null,
  };
}

function recalculateTournamentMatches(
  matches: MatchRecord[],
  config: TournamentConfig,
  timestamp: string,
  fromRoundOrder = 1,
) {
  if (config.format === "single_elimination") {
    return rebuildSingleEliminationMatches(matches, config, fromRoundOrder, timestamp);
  }

  if (config.format === "double_elimination") {
    return rebuildDoubleEliminationMatches(matches, config, timestamp);
  }

  return matches.map((match) => ({
    ...match,
    state: getMatchState(match, config),
    updatedAt: timestamp,
  }));
}

function getTournamentContext(dataset: SheetDataset, tournamentId: string) {
  const matchIds = getTournamentMatchIds(dataset, tournamentId);
  const players = parsePlayerRows(
    dataset.players.filter((row) => row.tournament_id === tournamentId),
  );
  const sets = parseMatchSetRows(
    dataset.matchSets.filter((row) => matchIds.has(row.match_id)),
  );
  const matches = parseMatchRows(
    dataset.matches.filter((row) => row.tournament_id === tournamentId),
    sets,
  );
  const tournamentRow = getTournamentRow(dataset, tournamentId);

  return {
    players,
    matches,
    matchIds,
    config: getTournamentConfig(tournamentRow, matches),
  };
}

async function persistTournamentContext(
  dataset: SheetDataset,
  tournamentId: string,
  context: ReturnType<typeof getTournamentContext>,
  eventLogRows: RawSheetRow[],
) {
  const timestamp = nowIso();
  const tournamentRow = getTournamentRow(dataset, tournamentId);
  const lifecycle = resolveTournamentStatus(tournamentRow, context.matches, timestamp);
  const currentMatchId = resolveCurrentMatchId(context.matches);
  const tournamentsRows = dataset.tournaments.map((row) =>
    row.tournament_id === tournamentId
      ? {
          ...row,
          status: lifecycle.status,
          current_match_id: currentMatchId,
          ended_at: lifecycle.endedAt,
          updated_at: timestamp,
        }
      : row,
  );
  const matchRows = [
    ...dataset.matches.filter((row) => row.tournament_id !== tournamentId),
    ...serializeMatches(context.matches),
  ];
  const setRows = [
    ...dataset.matchSets.filter((row) => !context.matchIds.has(row.match_id)),
    ...serializeMatchSets(context.matches),
  ];
  const standingsRows = [
    ...dataset.standings.filter((row) => row.tournament_id !== tournamentId),
    ...(context.config.format === "round_robin"
      ? buildStandingsRows(tournamentId, context.players, context.matches, nowIso())
      : []),
  ];

  await replaceMultipleSheetTabs([
    { tab: "tournaments", rows: tournamentsRows },
    { tab: "matches", rows: matchRows },
    { tab: "match_sets", rows: setRows },
    { tab: "standings", rows: standingsRows },
    { tab: "event_log", rows: eventLogRows },
  ]);
}

export async function createTournamentWithSchedule(input: CreateTournamentInput) {
  ensureWritableMode();
  validateCreateInput(input);

  const dataset = await loadDataset();
  const timestamp = nowIso();
  const existingSlugs = new Set(dataset.tournaments.map((row) => row.slug));
  const baseSlug = slugify(input.name);
  const slug = getUniqueSlug(baseSlug, existingSlugs);
  const tournamentId = slug;

  const players: PlayerRecord[] = input.playerNames.map((name, index) => ({
    id: `${tournamentId}-player-${index + 1}`,
    tournamentId,
    displayName: name.trim(),
    avatarUrl: null,
    seed: index + 1,
    status: "active",
    createdAt: timestamp,
  }));

  const config: TournamentConfig = {
    format: input.format,
    scoringMode: input.scoringMode,
    targetScore: input.scoringMode === "target_score" ? input.targetScore : null,
    setCount: input.scoringMode === "set_total" ? input.setCount : null,
  };

  const createdMatches =
    input.format === "single_elimination"
      ? generateSingleEliminationSchedule({
          tournamentId,
          players,
          scoringMode: config.scoringMode,
          setCount: config.setCount,
          randomize: input.randomize,
          startedAt: timestamp,
        })
      : input.format === "double_elimination"
        ? generateDoubleEliminationSchedule({
          tournamentId,
          players,
          scoringMode: config.scoringMode,
          setCount: config.setCount,
          randomize: input.randomize,
          startedAt: timestamp,
        })
        : generateRoundRobinSchedule({
            tournamentId,
            players,
            scoringMode: config.scoringMode,
            setCount: config.setCount,
            randomize: input.randomize,
            startedAt: timestamp,
          });

  const matches = recalculateTournamentMatches(
    createdMatches,
    config,
    timestamp,
    1,
  );

  const currentMatchId =
    matches.find((match) => match.isFeatured)?.id ?? matches[0]?.id ?? "";

  const tournaments = [
    ...dataset.tournaments,
    {
      tournament_id: tournamentId,
      slug,
      name: input.name.trim(),
      format: input.format,
      status: input.status,
      win_score_rule:
        input.scoringMode === "target_score" ? String(input.targetScore ?? "") : "",
      current_match_id: currentMatchId,
      theme:
        input.format === "single_elimination"
          ? "ember-grid"
          : input.format === "double_elimination"
            ? "gold-pulse"
            : "signal-cyan",
      venue: input.venue.trim() || "主舞台",
      hero_kicker: "主辦方建立的新賽事",
      hero_summary: buildHeroSummary(input.name, input.format, input.scoringMode),
      started_at: input.status === "live" ? timestamp : "",
      ended_at: "",
      created_at: timestamp,
      updated_at: timestamp,
      scoring_mode: input.scoringMode,
      target_score:
        input.scoringMode === "target_score" ? String(input.targetScore ?? "") : "",
      set_count:
        input.scoringMode === "set_total" ? String(input.setCount ?? "") : "",
    },
  ];

  const playersRows = [...dataset.players, ...players.map(playerRow)];
  const matchRows = [...dataset.matches, ...serializeMatches(matches)];
  const matchSetRows = [...dataset.matchSets, ...serializeMatchSets(matches)];
  const standingsRows = [
    ...dataset.standings.filter((row) => row.tournament_id !== tournamentId),
    ...(input.format === "round_robin"
      ? buildStandingsRows(tournamentId, players, matches, timestamp)
      : []),
  ];
  const eventLogRows = [
    ...dataset.eventLog,
    createEventLogRow(tournamentId, null, "tournament_created", {
      name: input.name,
      format: input.format,
      scoringMode: input.scoringMode,
      targetScore: input.targetScore,
      setCount: input.setCount,
      playerCount: players.length,
      randomize: input.randomize,
    }),
  ];

  await replaceMultipleSheetTabs([
    { tab: "tournaments", rows: tournaments },
    { tab: "players", rows: playersRows },
    { tab: "matches", rows: matchRows },
    { tab: "match_sets", rows: matchSetRows },
    { tab: "standings", rows: standingsRows },
    { tab: "event_log", rows: eventLogRows },
  ]);

  return { tournamentId, slug };
}

export async function setCurrentMatch(tournamentId: string, matchId: string) {
  ensureWritableMode();

  const dataset = await loadDataset();
  const timestamp = nowIso();

  const tournaments = dataset.tournaments.map((row) =>
    row.tournament_id === tournamentId
      ? { ...row, current_match_id: matchId, updated_at: timestamp }
      : row,
  );

  const matches = dataset.matches.map((row) =>
    row.tournament_id === tournamentId
      ? {
          ...row,
          is_featured: row.match_id === matchId ? "TRUE" : "FALSE",
          updated_at: row.match_id === matchId ? timestamp : row.updated_at,
        }
      : row,
  );

  const eventLog = [
    ...dataset.eventLog,
    createEventLogRow(tournamentId, matchId, "current_match_set", { matchId }),
  ];

  await replaceMultipleSheetTabs([
    { tab: "tournaments", rows: tournaments },
    { tab: "matches", rows: matches },
    { tab: "event_log", rows: eventLog },
  ]);
}

export async function adjustSetScore(input: AdjustSetScoreInput) {
  ensureWritableMode();

  const dataset = await loadDataset();
  const timestamp = nowIso();
  const context = getTournamentContext(dataset, input.tournamentId);
  const targetMatch = context.matches.find((match) => match.id === input.matchId);

  if (!targetMatch) {
    throw new Error("找不到指定的比賽。");
  }

  const targetSet = targetMatch.sets.find((set) => set.id === input.setId);

  if (!targetSet) {
    throw new Error("找不到指定的分局。");
  }

  if (input.side === "player1") {
    targetSet.player1Score = Math.max(0, targetSet.player1Score + input.delta);
  } else {
    targetSet.player2Score = Math.max(0, targetSet.player2Score + input.delta);
  }

  targetSet.updatedAt = timestamp;
  targetMatch.updatedAt = timestamp;

  context.matches = recalculateTournamentMatches(
    context.matches,
    context.config,
    timestamp,
    targetMatch.roundOrder,
  );

  const eventLogRows = [
    ...dataset.eventLog,
    createEventLogRow(input.tournamentId, input.matchId, "set_score_adjusted", {
      setId: input.setId,
      side: input.side,
      delta: input.delta,
    }),
  ];

  await persistTournamentContext(dataset, input.tournamentId, context, eventLogRows);
}

export async function setSetScore(input: SetSetScoreInput) {
  ensureWritableMode();

  const dataset = await loadDataset();
  const timestamp = nowIso();
  const context = getTournamentContext(dataset, input.tournamentId);
  const targetMatch = context.matches.find((match) => match.id === input.matchId);

  if (!targetMatch) {
    throw new Error("找不到指定的比賽。");
  }

  const targetSet = targetMatch.sets.find((set) => set.id === input.setId);

  if (!targetSet) {
    throw new Error("找不到指定的分局。");
  }

  targetSet.player1Score = Math.max(0, input.player1Score);
  targetSet.player2Score = Math.max(0, input.player2Score);
  targetSet.note = "手動輸入比分";
  targetSet.updatedAt = timestamp;
  targetMatch.updatedAt = timestamp;

  context.matches = recalculateTournamentMatches(
    context.matches,
    context.config,
    timestamp,
    targetMatch.roundOrder,
  );

  const eventLogRows = [
    ...dataset.eventLog,
    createEventLogRow(input.tournamentId, input.matchId, "set_score_replaced", {
      setId: input.setId,
      player1Score: input.player1Score,
      player2Score: input.player2Score,
    }),
  ];

  await persistTournamentContext(dataset, input.tournamentId, context, eventLogRows);
}

export async function addMatchSet(input: AddMatchSetInput) {
  ensureWritableMode();

  const dataset = await loadDataset();
  const timestamp = nowIso();
  const context = getTournamentContext(dataset, input.tournamentId);
  const targetMatch = context.matches.find((match) => match.id === input.matchId);

  if (!targetMatch) {
    throw new Error("找不到指定的比賽。");
  }

  if (targetMatch.state === "completed") {
    throw new Error("比賽已結束，無法再新增分局。");
  }

  const nextSetNo =
    Math.max(0, ...targetMatch.sets.map((set) => set.setNo)) + 1;
  const nextSetId = `${targetMatch.id}-set-${nextSetNo}`;

  targetMatch.sets.push({
    id: nextSetId,
    matchId: targetMatch.id,
    setNo: nextSetNo,
    player1Score: 0,
    player2Score: 0,
    note: "新增分局",
    updatedAt: timestamp,
  });
  targetMatch.updatedAt = timestamp;
  targetMatch.state = getMatchState(targetMatch, context.config);

  context.matches = recalculateTournamentMatches(
    context.matches,
    context.config,
    timestamp,
    targetMatch.roundOrder,
  );

  const eventLogRows = [
    ...dataset.eventLog,
    createEventLogRow(input.tournamentId, input.matchId, "set_added", {
      setId: nextSetId,
      setNo: nextSetNo,
    }),
  ];

  await persistTournamentContext(dataset, input.tournamentId, context, eventLogRows);
}

export async function overrideMatchTotal(input: OverrideMatchTotalInput) {
  ensureWritableMode();

  const dataset = await loadDataset();
  const timestamp = nowIso();
  const context = getTournamentContext(dataset, input.tournamentId);
  const targetMatch = context.matches.find((match) => match.id === input.matchId);

  if (!targetMatch) {
    throw new Error("找不到指定的比賽。");
  }

  targetMatch.sets = targetMatch.sets.map((set, index) => ({
    ...set,
    player1Score: index === 0 ? Math.max(0, input.player1Total) : 0,
    player2Score: index === 0 ? Math.max(0, input.player2Total) : 0,
    note: index === 0 ? "直接輸入最終總分" : "覆蓋總分保留局數",
    updatedAt: timestamp,
  }));
  targetMatch.updatedAt = timestamp;
  targetMatch.state = getMatchState(targetMatch, context.config, true);

  context.matches = recalculateTournamentMatches(
    context.matches,
    context.config,
    timestamp,
    targetMatch.roundOrder,
  ).map((match) =>
    match.id === targetMatch.id
      ? {
          ...match,
          state: getMatchState(match, context.config, true),
          updatedAt: timestamp,
        }
      : match,
  );

  const eventLogRows = [
    ...dataset.eventLog,
    createEventLogRow(input.tournamentId, input.matchId, "match_total_overridden", {
      player1Total: input.player1Total,
      player2Total: input.player2Total,
    }),
  ];

  await persistTournamentContext(dataset, input.tournamentId, context, eventLogRows);
}
