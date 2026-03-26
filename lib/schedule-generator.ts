import type {
  MatchRecord,
  MatchSetRecord,
  PlayerRecord,
  ScoringMode,
} from "@/lib/tournament-types";

type ScheduleOptions = {
  tournamentId: string;
  players: PlayerRecord[];
  scoringMode: ScoringMode;
  setCount: number | null;
  randomize: boolean;
  startedAt: string;
};

function shuffle<T>(items: T[]) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function nextPowerOfTwo(value: number) {
  let current = 1;

  while (current < value) {
    current *= 2;
  }

  return current;
}

function createSetRows(
  matchId: string,
  scoringMode: ScoringMode,
  setCount: number | null,
  timestamp: string,
) {
  const count = scoringMode === "set_total" ? Math.max(1, setCount ?? 1) : 1;

  return Array.from({ length: count }, (_, index): MatchSetRecord => ({
    id: `${matchId}-set-${index + 1}`,
    matchId,
    setNo: index + 1,
    player1Score: 0,
    player2Score: 0,
    note: null,
    updatedAt: timestamp,
  }));
}

function getEliminationRoundName(matchCount: number) {
  switch (matchCount) {
    case 1:
      return "冠軍賽";
    case 2:
      return "四強";
    case 4:
      return "八強";
    case 8:
      return "16 強";
    case 16:
      return "32 強";
    default:
      return `第 ${matchCount} 輪`;
  }
}

function createPendingId(matchId: string, slot: 1 | 2) {
  return `pending:${matchId}:${slot}`;
}

function createByeId(matchId: string, slot: 1 | 2) {
  return `bye:${matchId}:${slot}`;
}

function createInactiveResetByeId(slot: 1 | 2) {
  return `bye:gf2-inactive:${slot}`;
}

function getDoubleEliminationLbMatchCount(bracketSize: number, lbRoundOrder: number) {
  const phase = Math.ceil(lbRoundOrder / 2);
  return Math.max(1, bracketSize / 2 ** (phase + 1));
}

function createDoubleEliminationRoundName(
  bracket: "wb" | "lb" | "gf",
  roundOrder: number,
) {
  if (bracket === "wb") {
    return `勝部第 ${roundOrder} 輪`;
  }

  if (bracket === "lb") {
    return `敗部第 ${roundOrder} 輪`;
  }

  return roundOrder === 1 ? "總決賽" : "總決賽重置戰";
}

export function isInactiveGrandFinalResetMatch(match: Pick<MatchRecord, "id" | "player1Id" | "player2Id">) {
  return (
    match.id.endsWith("-de-gf-2") &&
    match.player1Id.startsWith("bye:gf2-inactive:") &&
    match.player2Id.startsWith("bye:gf2-inactive:")
  );
}

export function generateSingleEliminationSchedule({
  tournamentId,
  players,
  scoringMode,
  setCount,
  randomize,
  startedAt,
}: ScheduleOptions): MatchRecord[] {
  const orderedPlayers = randomize ? shuffle(players) : [...players];
  const bracketSize = nextPowerOfTwo(Math.max(2, orderedPlayers.length));
  const paddedEntrants = [
    ...orderedPlayers.map((player) => player.id),
    ...Array.from({ length: bracketSize - orderedPlayers.length }, (_, index) =>
      createByeId(`${tournamentId}-entry-${index + 1}`, 2),
    ),
  ];

  const totalRounds = Math.log2(bracketSize);
  const matches: MatchRecord[] = [];

  for (let roundOrder = 1; roundOrder <= totalRounds; roundOrder += 1) {
    const matchCount = bracketSize / 2 ** roundOrder;
    const roundName = getEliminationRoundName(matchCount);

    for (let matchOrder = 1; matchOrder <= matchCount; matchOrder += 1) {
      const matchId = `${tournamentId}-r${roundOrder}-m${matchOrder}`;
      const sets = createSetRows(matchId, scoringMode, setCount, startedAt);
      const player1Id =
        roundOrder === 1
          ? paddedEntrants[(matchOrder - 1) * 2]
          : createPendingId(matchId, 1);
      const player2Id =
        roundOrder === 1
          ? paddedEntrants[(matchOrder - 1) * 2 + 1]
          : createPendingId(matchId, 2);

      const isByeMatch = player1Id.startsWith("bye:") || player2Id.startsWith("bye:");

      if (isByeMatch) {
        sets[0] = {
          ...sets[0],
          player1Score: player1Id.startsWith("bye:") ? 0 : 1,
          player2Score: player2Id.startsWith("bye:") ? 0 : 1,
          note: "輪空晉級",
        };
      }

      matches.push({
        id: matchId,
        tournamentId,
        roundName,
        roundOrder,
        matchOrder,
        player1Id,
        player2Id,
        state: isByeMatch ? "completed" : "scheduled",
        isFeatured: roundOrder === 1 && matchOrder === 1,
        scheduledLabel: `第 ${roundOrder} 輪 / 場次 ${matchOrder}`,
        updatedAt: startedAt,
        sets,
      });
    }
  }

  return matches;
}

export function generateDoubleEliminationSchedule({
  tournamentId,
  players,
  scoringMode,
  setCount,
  randomize,
  startedAt,
}: ScheduleOptions): MatchRecord[] {
  const orderedPlayers = randomize ? shuffle(players) : [...players];
  const bracketSize = nextPowerOfTwo(Math.max(2, orderedPlayers.length));
  const paddedEntrants = [
    ...orderedPlayers.map((player) => player.id),
    ...Array.from({ length: bracketSize - orderedPlayers.length }, (_, index) =>
      createByeId(`${tournamentId}-de-entry-${index + 1}`, 2),
    ),
  ];

  const totalWbRounds = Math.log2(bracketSize);
  const matches: MatchRecord[] = [];

  for (let wbRoundOrder = 1; wbRoundOrder <= totalWbRounds; wbRoundOrder += 1) {
    const matchCount = bracketSize / 2 ** wbRoundOrder;

    for (let matchOrder = 1; matchOrder <= matchCount; matchOrder += 1) {
      const matchId = `${tournamentId}-de-wb-r${wbRoundOrder}-m${matchOrder}`;
      const sets = createSetRows(matchId, scoringMode, setCount, startedAt);
      const player1Id =
        wbRoundOrder === 1
          ? paddedEntrants[(matchOrder - 1) * 2]
          : createPendingId(matchId, 1);
      const player2Id =
        wbRoundOrder === 1
          ? paddedEntrants[(matchOrder - 1) * 2 + 1]
          : createPendingId(matchId, 2);

      const isByeMatch = player1Id.startsWith("bye:") || player2Id.startsWith("bye:");

      if (isByeMatch) {
        sets[0] = {
          ...sets[0],
          player1Score: player1Id.startsWith("bye:") ? 0 : 1,
          player2Score: player2Id.startsWith("bye:") ? 0 : 1,
          note: "輪空晉級",
        };
      }

      matches.push({
        id: matchId,
        tournamentId,
        roundName: createDoubleEliminationRoundName("wb", wbRoundOrder),
        roundOrder: 100 + wbRoundOrder,
        matchOrder,
        player1Id,
        player2Id,
        state: isByeMatch ? "completed" : "scheduled",
        isFeatured: wbRoundOrder === 1 && matchOrder === 1,
        scheduledLabel: `勝部第 ${wbRoundOrder} 輪 / 場次 ${matchOrder}`,
        updatedAt: startedAt,
        sets,
      });
    }
  }

  if (totalWbRounds > 1) {
    const totalLbRounds = Math.max(0, (totalWbRounds - 1) * 2);

    for (let lbRoundOrder = 1; lbRoundOrder <= totalLbRounds; lbRoundOrder += 1) {
      const matchCount = getDoubleEliminationLbMatchCount(bracketSize, lbRoundOrder);

      for (let matchOrder = 1; matchOrder <= matchCount; matchOrder += 1) {
        const matchId = `${tournamentId}-de-lb-r${lbRoundOrder}-m${matchOrder}`;
        matches.push({
          id: matchId,
          tournamentId,
          roundName: createDoubleEliminationRoundName("lb", lbRoundOrder),
          roundOrder: 300 + lbRoundOrder,
          matchOrder,
          player1Id: createPendingId(matchId, 1),
          player2Id: createPendingId(matchId, 2),
          state: "scheduled",
          isFeatured: false,
          scheduledLabel: `敗部第 ${lbRoundOrder} 輪 / 場次 ${matchOrder}`,
          updatedAt: startedAt,
          sets: createSetRows(matchId, scoringMode, setCount, startedAt),
        });
      }
    }
  }

  const grandFinalId = `${tournamentId}-de-gf-1`;
  matches.push({
    id: grandFinalId,
    tournamentId,
    roundName: createDoubleEliminationRoundName("gf", 1),
    roundOrder: 500,
    matchOrder: 1,
    player1Id: createPendingId(grandFinalId, 1),
    player2Id: createPendingId(grandFinalId, 2),
    state: "scheduled",
    isFeatured: false,
    scheduledLabel: "總決賽 / 場次 1",
    updatedAt: startedAt,
    sets: createSetRows(grandFinalId, scoringMode, setCount, startedAt),
  });

  const grandFinalResetId = `${tournamentId}-de-gf-2`;
  const resetSets = createSetRows(grandFinalResetId, scoringMode, setCount, startedAt);
  resetSets[0] = {
    ...resetSets[0],
    note: "重置戰未啟用",
  };

  matches.push({
    id: grandFinalResetId,
    tournamentId,
    roundName: createDoubleEliminationRoundName("gf", 2),
    roundOrder: 501,
    matchOrder: 1,
    player1Id: createInactiveResetByeId(1),
    player2Id: createInactiveResetByeId(2),
    state: "completed",
    isFeatured: false,
    scheduledLabel: "總決賽重置戰 / 場次 1",
    updatedAt: startedAt,
    sets: resetSets,
  });

  return matches;
}

function getRoundRobinRounds(playerIds: string[]) {
  const entrants = [...playerIds];

  if (entrants.length % 2 === 1) {
    entrants.push("__bye__");
  }

  const rounds: Array<Array<[string, string]>> = [];
  let rotation = [...entrants];

  for (let round = 0; round < entrants.length - 1; round += 1) {
    const pairs: Array<[string, string]> = [];

    for (let index = 0; index < rotation.length / 2; index += 1) {
      const left = rotation[index];
      const right = rotation[rotation.length - 1 - index];

      if (left !== "__bye__" && right !== "__bye__") {
        pairs.push(round % 2 === 0 ? [left, right] : [right, left]);
      }
    }

    rounds.push(pairs);

    const [fixed, ...moving] = rotation;
    moving.unshift(moving.pop()!);
    rotation = [fixed, ...moving];
  }

  return rounds;
}

export function generateRoundRobinSchedule({
  tournamentId,
  players,
  scoringMode,
  setCount,
  randomize,
  startedAt,
}: ScheduleOptions): MatchRecord[] {
  const orderedPlayers = randomize ? shuffle(players) : [...players];
  const rounds = getRoundRobinRounds(orderedPlayers.map((player) => player.id));

  return rounds.flatMap((pairs, roundIndex) =>
    pairs.map(([player1Id, player2Id], matchIndex): MatchRecord => {
      const matchId = `${tournamentId}-rr-r${roundIndex + 1}-m${matchIndex + 1}`;

      return {
        id: matchId,
        tournamentId,
        roundName: `第 ${roundIndex + 1} 輪`,
        roundOrder: roundIndex + 1,
        matchOrder: matchIndex + 1,
        player1Id,
        player2Id,
        state: "scheduled",
        isFeatured: roundIndex === 0 && matchIndex === 0,
        scheduledLabel: `第 ${roundIndex + 1} 輪 / 場次 ${matchIndex + 1}`,
        updatedAt: startedAt,
        sets: createSetRows(matchId, scoringMode, setCount, startedAt),
      };
    }),
  );
}
