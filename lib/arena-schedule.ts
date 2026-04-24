import type { ChallengeCompetitionFormat } from "@/lib/arena-types";

type MatchInsertRow = {
  challenge_id: string;
  player_a_id: string;
  player_b_id: string;
  winner_player_id: string | null;
  status: "pending" | "completed";
  notes: string | null;
  settled_at: string | null;
};

type RankedParticipant = {
  playerId: string;
  displayName: string;
};

type ExistingMatch = {
  id: string;
  playerAId: string;
  playerBId: string;
  winnerPlayerId: string | null;
  status: "pending" | "completed" | "cancelled";
  notes: string | null;
};

export type ArenaMatchMeta = {
  format: ChallengeCompetitionFormat;
  round: number;
  matchOrder: number;
  stage?: "regular" | "playoff";
  autoBye?: boolean;
  player1Score?: number;
  player2Score?: number;
};

export type RoundRobinStanding = {
  playerId: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
};

function nextPowerOfTwo(value: number) {
  let current = 1;
  while (current < value) {
    current *= 2;
  }
  return current;
}

function createSeedOrder(bracketSize: number) {
  let order = [1, 2];

  while (order.length < bracketSize) {
    const nextSize = order.length * 2;
    const nextOrder: number[] = [];
    for (const seed of order) {
      nextOrder.push(seed, nextSize + 1 - seed);
    }
    order = nextOrder;
  }

  return order;
}

function parseMetaScore(
  meta: ArenaMatchMeta | null,
  playerId: string,
  match: ExistingMatch,
) {
  if (meta?.player1Score != null && meta?.player2Score != null) {
    if (playerId === match.playerAId) {
      return {
        pointsFor: meta.player1Score,
        pointsAgainst: meta.player2Score,
      };
    }
    if (playerId === match.playerBId) {
      return {
        pointsFor: meta.player2Score,
        pointsAgainst: meta.player1Score,
      };
    }
  }

  if (match.winnerPlayerId === playerId) {
    return {
      pointsFor: 1,
      pointsAgainst: 0,
    };
  }

  return {
    pointsFor: 0,
    pointsAgainst: 1,
  };
}

export function stringifyArenaMatchMeta(meta: ArenaMatchMeta) {
  return JSON.stringify(meta);
}

export function parseArenaMatchMeta(notes: string | null): ArenaMatchMeta | null {
  if (!notes) return null;

  try {
    const raw = JSON.parse(notes) as Partial<ArenaMatchMeta>;
    if (typeof raw.round !== "number" || typeof raw.matchOrder !== "number") {
      return null;
    }
    return {
      format: (raw.format ?? "manual_pool") as ChallengeCompetitionFormat,
      round: raw.round,
      matchOrder: raw.matchOrder,
      stage: raw.stage,
      autoBye: Boolean(raw.autoBye),
      player1Score: typeof raw.player1Score === "number" ? raw.player1Score : undefined,
      player2Score: typeof raw.player2Score === "number" ? raw.player2Score : undefined,
    };
  } catch {
    return null;
  }
}

export function generateRoundRobinMatches(
  challengeId: string,
  playerIds: string[],
): MatchInsertRow[] {
  if (playerIds.length < 2) return [];

  const entrants = [...playerIds];
  const hasBye = entrants.length % 2 === 1;
  if (hasBye) {
    entrants.push("__bye__");
  }

  let rotation = [...entrants];
  const rows: MatchInsertRow[] = [];

  for (let round = 0; round < entrants.length - 1; round += 1) {
    let roundMatchOrder = 1;

    for (let i = 0; i < rotation.length / 2; i += 1) {
      const left = rotation[i];
      const right = rotation[rotation.length - 1 - i];

      if (left === "__bye__" || right === "__bye__") {
        continue;
      }

      const [playerAId, playerBId] = round % 2 === 0 ? [left, right] : [right, left];
      rows.push({
        challenge_id: challengeId,
        player_a_id: playerAId,
        player_b_id: playerBId,
        winner_player_id: null,
        status: "pending",
        settled_at: null,
        notes: stringifyArenaMatchMeta({
          format: "round_robin",
          stage: "regular",
          round: round + 1,
          matchOrder: roundMatchOrder,
        }),
      });
      roundMatchOrder += 1;
    }

    const [fixed, ...moving] = rotation;
    moving.unshift(moving.pop()!);
    rotation = [fixed, ...moving];
  }

  return rows;
}

export function generateSingleEliminationFirstRound(
  challengeId: string,
  playerIds: string[],
): MatchInsertRow[] {
  if (playerIds.length < 2) return [];

  const bracketSize = nextPowerOfTwo(Math.max(2, playerIds.length));
  const seededEntrants = Array.from({ length: bracketSize }, (_, index) => playerIds[index] ?? null);
  const seedOrder = createSeedOrder(bracketSize);
  const seededOrder = seedOrder.map((seed) => seededEntrants[seed - 1]);

  const rows: MatchInsertRow[] = [];

  for (let index = 0; index < seededOrder.length; index += 2) {
    const playerA = seededOrder[index];
    const playerB = seededOrder[index + 1];
    const matchOrder = index / 2 + 1;

    if (!playerA && !playerB) {
      continue;
    }

    if (playerA && playerB) {
      rows.push({
        challenge_id: challengeId,
        player_a_id: playerA,
        player_b_id: playerB,
        winner_player_id: null,
        status: "pending",
        settled_at: null,
        notes: stringifyArenaMatchMeta({
          format: "single_elimination",
          round: 1,
          matchOrder,
        }),
      });
      continue;
    }

    const winnerId = playerA ?? playerB!;
    rows.push({
      challenge_id: challengeId,
      player_a_id: winnerId,
      player_b_id: winnerId,
      winner_player_id: winnerId,
      status: "completed",
      settled_at: new Date().toISOString(),
      notes: stringifyArenaMatchMeta({
        format: "single_elimination",
        round: 1,
        matchOrder,
        autoBye: true,
        player1Score: 1,
        player2Score: 0,
      }),
    });
  }

  return rows;
}

export function buildNextSingleEliminationRoundMatches(
  challengeId: string,
  currentRoundMatches: ExistingMatch[],
  nextRound: number,
): MatchInsertRow[] {
  const winners = [...currentRoundMatches]
    .sort((a, b) => {
      const aMeta = parseArenaMatchMeta(a.notes);
      const bMeta = parseArenaMatchMeta(b.notes);
      return (aMeta?.matchOrder ?? 999) - (bMeta?.matchOrder ?? 999);
    })
    .map((match) => match.winnerPlayerId)
    .filter((winner): winner is string => Boolean(winner));

  if (winners.length <= 1) {
    return [];
  }

  const rows: MatchInsertRow[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    const playerA = winners[i];
    const playerB = winners[i + 1] ?? null;
    const matchOrder = i / 2 + 1;

    if (playerB) {
      rows.push({
        challenge_id: challengeId,
        player_a_id: playerA,
        player_b_id: playerB,
        winner_player_id: null,
        status: "pending",
        settled_at: null,
        notes: stringifyArenaMatchMeta({
          format: "single_elimination",
          round: nextRound,
          matchOrder,
        }),
      });
    } else {
      rows.push({
        challenge_id: challengeId,
        player_a_id: playerA,
        player_b_id: playerA,
        winner_player_id: playerA,
        status: "completed",
        settled_at: new Date().toISOString(),
        notes: stringifyArenaMatchMeta({
          format: "single_elimination",
          round: nextRound,
          matchOrder,
          autoBye: true,
          player1Score: 1,
          player2Score: 0,
        }),
      });
    }
  }

  return rows;
}

export function calculateRoundRobinStandings(
  participants: RankedParticipant[],
  matches: ExistingMatch[],
): RoundRobinStanding[] {
  const table = new Map<string, RoundRobinStanding>();
  participants.forEach((player) => {
    table.set(player.playerId, {
      playerId: player.playerId,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
    });
  });

  matches.forEach((match) => {
    if (match.status !== "completed" || !match.winnerPlayerId) return;

    const playerA = table.get(match.playerAId);
    const playerB = table.get(match.playerBId);
    if (!playerA || !playerB) return;

    const meta = parseArenaMatchMeta(match.notes);
    const scoreA = parseMetaScore(meta, match.playerAId, match);
    const scoreB = parseMetaScore(meta, match.playerBId, match);

    playerA.pointsFor += scoreA.pointsFor;
    playerA.pointsAgainst += scoreA.pointsAgainst;
    playerA.pointDiff = playerA.pointsFor - playerA.pointsAgainst;

    playerB.pointsFor += scoreB.pointsFor;
    playerB.pointsAgainst += scoreB.pointsAgainst;
    playerB.pointDiff = playerB.pointsFor - playerB.pointsAgainst;

    if (match.winnerPlayerId === match.playerAId) {
      playerA.wins += 1;
      playerB.losses += 1;
    } else if (match.winnerPlayerId === match.playerBId) {
      playerB.wins += 1;
      playerA.losses += 1;
    }
  });

  const nameMap = new Map(participants.map((player) => [player.playerId, player.displayName]));
  return [...table.values()].sort((left, right) => {
    if (left.wins !== right.wins) return right.wins - left.wins;
    if (left.pointDiff !== right.pointDiff) return right.pointDiff - left.pointDiff;
    if (left.pointsFor !== right.pointsFor) return right.pointsFor - left.pointsFor;
    const leftName = nameMap.get(left.playerId) ?? left.playerId;
    const rightName = nameMap.get(right.playerId) ?? right.playerId;
    return leftName.localeCompare(rightName, "zh-Hant");
  });
}

function getLoserFromMatch(match: ExistingMatch) {
  if (!match.winnerPlayerId) return null;
  if (match.playerAId === match.playerBId) return null;
  if (match.winnerPlayerId === match.playerAId) return match.playerBId;
  if (match.winnerPlayerId === match.playerBId) return match.playerAId;
  return null;
}

function getLoserPerformance(match: ExistingMatch, loserId: string) {
  const meta = parseArenaMatchMeta(match.notes);
  if (meta?.player1Score != null && meta?.player2Score != null) {
    if (loserId === match.playerAId) {
      return {
        scoreFor: meta.player1Score,
        scoreAgainst: meta.player2Score,
      };
    }
    return {
      scoreFor: meta.player2Score,
      scoreAgainst: meta.player1Score,
    };
  }

  return {
    scoreFor: 0,
    scoreAgainst: 1,
  };
}

export function calculateSingleEliminationPodium(
  participants: RankedParticipant[],
  matches: ExistingMatch[],
) {
  const completed = matches.filter((match) => match.status === "completed" && match.winnerPlayerId);
  if (completed.length === 0) {
    return {
      first: null,
      second: null,
      third: null,
    };
  }

  const rounds = completed
    .map((match) => parseArenaMatchMeta(match.notes)?.round ?? 0)
    .filter((round) => round > 0);

  const finalRound = rounds.length > 0 ? Math.max(...rounds) : 1;
  const finalMatch = completed
    .filter((match) => (parseArenaMatchMeta(match.notes)?.round ?? 0) === finalRound)
    .sort((left, right) => {
      const leftOrder = parseArenaMatchMeta(left.notes)?.matchOrder ?? 999;
      const rightOrder = parseArenaMatchMeta(right.notes)?.matchOrder ?? 999;
      return leftOrder - rightOrder;
    })[0];

  if (!finalMatch || !finalMatch.winnerPlayerId) {
    return {
      first: null,
      second: null,
      third: null,
    };
  }

  const first = finalMatch.winnerPlayerId;
  const second = getLoserFromMatch(finalMatch);
  const nameMap = new Map(participants.map((player) => [player.playerId, player.displayName]));

  let third: string | null = null;
  if (finalRound > 1) {
    const semifinalLosers = completed
      .filter((match) => (parseArenaMatchMeta(match.notes)?.round ?? 0) === finalRound - 1)
      .map((match) => {
        const loserId = getLoserFromMatch(match);
        if (!loserId) return null;
        const perf = getLoserPerformance(match, loserId);
        return {
          loserId,
          scoreFor: perf.scoreFor,
          scoreAgainst: perf.scoreAgainst,
          diff: perf.scoreFor - perf.scoreAgainst,
          name: nameMap.get(loserId) ?? loserId,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    semifinalLosers.sort((left, right) => {
      if (left.diff !== right.diff) return right.diff - left.diff;
      if (left.scoreFor !== right.scoreFor) return right.scoreFor - left.scoreFor;
      return left.name.localeCompare(right.name, "zh-Hant");
    });

    third = semifinalLosers[0]?.loserId ?? null;
  }

  return {
    first,
    second,
    third,
  };
}
