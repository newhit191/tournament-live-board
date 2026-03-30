import {
  isInactiveGrandFinalResetMatch,
  isRoundRobinPlayoffMatch,
} from "@/lib/schedule-generator";
import type {
  MatchSetRecord,
  PlayerRecord,
  ResolvedMatch,
  ResolvedStanding,
  TournamentRecord,
  TournamentStatus,
  TournamentView,
} from "@/lib/tournament-types";

const STATUS_ORDER: Record<TournamentStatus, number> = {
  live: 4,
  draft: 3,
  completed: 2,
  archived: 1,
};

export function computeMatchTotals(sets: MatchSetRecord[]) {
  return sets.reduce(
    (totals, set) => ({
      player1Total: totals.player1Total + set.player1Score,
      player2Total: totals.player2Total + set.player2Score,
    }),
    { player1Total: 0, player2Total: 0 },
  );
}

export function countRecordedSets(sets: MatchSetRecord[]) {
  return sets.filter(
    (set) =>
      set.player1Score > 0 ||
      set.player2Score > 0 ||
      Boolean(set.note && set.note.trim().length > 0),
  ).length;
}

function resolveCompletedWinnerId(match: {
  player1Id: string;
  player2Id: string;
  player1Total: number;
  player2Total: number;
  state: string;
}) {
  if (match.player1Id.startsWith("bye:")) {
    return match.player2Id;
  }

  if (match.player2Id.startsWith("bye:")) {
    return match.player1Id;
  }

  if (match.state !== "completed" || match.player1Total === match.player2Total) {
    return null;
  }

  return match.player1Total > match.player2Total
    ? match.player1Id
    : match.player2Id;
}

export function buildTournamentView(record: TournamentRecord): TournamentView {
  const playersById = new Map(record.players.map((player) => [player.id, player]));

  const matches = record.matches
    .filter((match) => !isInactiveGrandFinalResetMatch(match))
    .map<ResolvedMatch>((match) => {
      const player1 =
        playersById.get(match.player1Id) ??
        createVirtualPlayer(record.id, match.player1Id);
      const player2 =
        playersById.get(match.player2Id) ??
        createVirtualPlayer(record.id, match.player2Id);
      const totals = computeMatchTotals(match.sets);

      return {
        ...match,
        player1,
        player2,
        player1Total: totals.player1Total,
        player2Total: totals.player2Total,
        winnerId: resolveCompletedWinnerId({
          player1Id: player1.id,
          player2Id: player2.id,
          player1Total: totals.player1Total,
          player2Total: totals.player2Total,
          state: match.state,
        }),
        recordedSetCount: countRecordedSets(match.sets),
      };
    })
    .toSorted(
      (left, right) =>
        left.roundOrder - right.roundOrder || left.matchOrder - right.matchOrder,
    );

  const currentMatch =
    matches.find((match) => match.id === record.currentMatchId) ??
    matches.find((match) => match.isFeatured) ??
    matches.find((match) => match.state === "live") ??
    matches.find((match) => match.state === "scheduled") ??
    null;

  return {
    ...record,
    matches,
    standings: buildStandings(record, matches),
    currentMatch,
    stats: {
      playerCount: record.players.length,
      totalMatches: matches.length,
      completedMatches: matches.filter((match) => match.state === "completed")
        .length,
      liveMatches: matches.filter((match) => match.state === "live").length,
    },
  };
}

function createVirtualPlayer(
  tournamentId: string,
  playerId: string | null | undefined,
): PlayerRecord {
  const normalizedId = playerId?.trim();

  if (!normalizedId || normalizedId.startsWith("pending:")) {
    return {
      id: normalizedId || `pending:${tournamentId}:unknown`,
      tournamentId,
      displayName: "待定",
      avatarUrl: null,
      seed: null,
      status: "active",
      createdAt: new Date().toISOString(),
    };
  }

  if (normalizedId.startsWith("bye:")) {
    return {
      id: normalizedId,
      tournamentId,
      displayName: "輪空",
      avatarUrl: null,
      seed: null,
      status: "withdrawn",
      createdAt: new Date().toISOString(),
    };
  }

  return {
    id: normalizedId,
    tournamentId,
    displayName: "未命名選手",
    avatarUrl: null,
    seed: null,
    status: "withdrawn",
    createdAt: new Date().toISOString(),
  };
}

function buildStandings(
  record: TournamentRecord,
  matches: ResolvedMatch[],
): ResolvedStanding[] {
  const standings = new Map(
    record.players.map((player) => [
      player.id,
      {
        tournamentId: record.id,
        playerId: player.id,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDiff: 0,
        rank: 0,
        updatedAt: record.updatedAt,
        player,
      },
    ]),
  );

  for (const match of matches) {
    if (
      match.state !== "completed" ||
      match.player1.id.startsWith("pending:") ||
      match.player2.id.startsWith("pending:") ||
      match.player1.id.startsWith("bye:") ||
      match.player2.id.startsWith("bye:") ||
      (record.format === "round_robin" && isRoundRobinPlayoffMatch(match))
    ) {
      continue;
    }

    const player1 = standings.get(match.player1.id);
    const player2 = standings.get(match.player2.id);

    if (!player1 || !player2) {
      continue;
    }

    player1.pointsFor += match.player1Total;
    player1.pointsAgainst += match.player2Total;
    player1.pointDiff = player1.pointsFor - player1.pointsAgainst;

    player2.pointsFor += match.player2Total;
    player2.pointsAgainst += match.player1Total;
    player2.pointDiff = player2.pointsFor - player2.pointsAgainst;

    if (match.winnerId === match.player1.id) {
      player1.wins += 1;
      player2.losses += 1;
    }

    if (match.winnerId === match.player2.id) {
      player2.wins += 1;
      player1.losses += 1;
    }
  }

  return [...standings.values()]
    .toSorted((left, right) => {
      const leftPointRatio =
        left.pointsAgainst === 0
          ? left.pointsFor === 0
            ? 0
            : Number.POSITIVE_INFINITY
          : left.pointsFor / left.pointsAgainst;
      const rightPointRatio =
        right.pointsAgainst === 0
          ? right.pointsFor === 0
            ? 0
            : Number.POSITIVE_INFINITY
          : right.pointsFor / right.pointsAgainst;

      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }

      if (right.pointDiff !== left.pointDiff) {
        return right.pointDiff - left.pointDiff;
      }

      if (rightPointRatio !== leftPointRatio) {
        return rightPointRatio - leftPointRatio;
      }

      if (right.pointsFor !== left.pointsFor) {
        return right.pointsFor - left.pointsFor;
      }

      return left.player.displayName.localeCompare(right.player.displayName);
    })
    .map((standing, index) => ({
      ...standing,
      rank: index + 1,
    }));
}

export function sortTournamentsByStatus<T extends { status: TournamentStatus }>(
  tournaments: T[],
) {
  return tournaments.toSorted(
    (left, right) => STATUS_ORDER[right.status] - STATUS_ORDER[left.status],
  );
}

export function groupMatchesByRound(matches: ResolvedMatch[]) {
  const groups = new Map<string, ResolvedMatch[]>();

  for (const match of matches) {
    const bucket = groups.get(match.roundName) ?? [];
    bucket.push(match);
    groups.set(match.roundName, bucket);
  }

  return [...groups.entries()]
    .map(([roundName, roundMatches]) => ({
      roundName,
      matches: roundMatches.toSorted(
        (left, right) => left.matchOrder - right.matchOrder,
      ),
      roundOrder: roundMatches[0]?.roundOrder ?? 0,
    }))
    .toSorted((left, right) => left.roundOrder - right.roundOrder);
}
