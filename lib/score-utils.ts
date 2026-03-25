import type {
  MatchSetRecord,
  ResolvedMatch,
  ResolvedStanding,
  TournamentFormat,
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

export function resolveMatchWinnerId(match: {
  player1Id: string;
  player2Id: string;
  player1Total: number;
  player2Total: number;
}) {
  if (match.player1Total === match.player2Total) {
    return null;
  }

  return match.player1Total > match.player2Total
    ? match.player1Id
    : match.player2Id;
}

export function buildTournamentView(record: TournamentRecord): TournamentView {
  const playersById = new Map(record.players.map((player) => [player.id, player]));

  const matches = record.matches
    .map<ResolvedMatch>((match) => {
      const player1 = playersById.get(match.player1Id);
      const player2 = playersById.get(match.player2Id);

      if (!player1 || !player2) {
        throw new Error(`Match ${match.id} references an unknown player.`);
      }

      const totals = computeMatchTotals(match.sets);

      return {
        ...match,
        player1,
        player2,
        player1Total: totals.player1Total,
        player2Total: totals.player2Total,
        winnerId: resolveMatchWinnerId({
          player1Id: player1.id,
          player2Id: player2.id,
          player1Total: totals.player1Total,
          player2Total: totals.player2Total,
        }),
      };
    })
    .toSorted(
      (left, right) =>
        left.roundOrder - right.roundOrder || left.matchOrder - right.matchOrder,
    );

  const currentMatch =
    matches.find((match) => match.id === record.currentMatchId) ||
    matches.find((match) => match.isFeatured) ||
    matches.find((match) => match.state === "live") ||
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
    if (match.state !== "completed") {
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
      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }

      if (right.pointDiff !== left.pointDiff) {
        return right.pointDiff - left.pointDiff;
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

export function formatTournamentFormat(format: TournamentFormat) {
  return format === "single_elimination" ? "Single Elimination" : "Round Robin";
}

export function formatTournamentStatus(status: TournamentStatus) {
  switch (status) {
    case "live":
      return "Live";
    case "draft":
      return "Draft";
    case "completed":
      return "Completed";
    case "archived":
      return "Archived";
    default:
      return status;
  }
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

  return [...groups.entries()].map(([roundName, roundMatches]) => ({
    roundName,
    matches: roundMatches.toSorted(
      (left, right) => left.matchOrder - right.matchOrder,
    ),
  }));
}
