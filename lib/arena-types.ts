export type ChallengeMode = "single_stake" | "prize_pool";
export type ChallengeStatus = "open" | "in_progress" | "completed" | "cancelled";
export type ChallengeCompetitionFormat =
  | "single_match"
  | "manual_pool"
  | "single_elimination"
  | "double_elimination"
  | "round_robin";

export type ArenaChallenge = {
  id: string;
  mode: ChallengeMode;
  competitionFormat: ChallengeCompetitionFormat;
  title: string;
  description: string | null;
  city: string | null;
  venue: string | null;
  startsAt: string | null;
  status: ChallengeStatus;
  createdByAccountId: string;
  hostPlayerId: string;
  participantLimit: number;
  entryFee: number;
  rewardFirst: number;
  rewardSecond: number;
  rewardThird: number;
  isPractice: boolean;
  countsForRanking: boolean;
  crossFamily: boolean;
  completedAt: string | null;
  createdAt: string;
  participants: ArenaParticipant[];
  matches: ArenaMatch[];
};

export type ArenaParticipantResult =
  | "pending"
  | "winner"
  | "loser"
  | "rank_1"
  | "rank_2"
  | "rank_3"
  | "rank_other"
  | "cancelled";

export type ArenaParticipant = {
  id: string;
  challengeId: string;
  playerId: string;
  joinedByAccountId: string;
  isHost: boolean;
  stakeOffer: number;
  lockedAmount: number;
  finalRank: number | null;
  result: ArenaParticipantResult;
  createdAt: string;
  player: ArenaPlayer | null;
};

export type ArenaMatch = {
  id: string;
  challengeId: string;
  playerAId: string;
  playerBId: string;
  winnerPlayerId: string | null;
  status: "pending" | "completed" | "cancelled";
  notes: string | null;
  settledAt: string | null;
  createdAt: string;
};

export type ArenaPlayer = {
  id: string;
  ownerAccountId: string;
  familyId: string;
  displayName: string;
  isChild: boolean;
  isActive: boolean;
  balance: number;
  lockedBalance: number;
};

export type LeaderboardEntry = {
  player: ArenaPlayer;
  wins: number;
  losses: number;
  totalMatches: number;
  crossFamilyWins: number;
  points: number;
  rank: number;
  equippedTitle: string | null;
  unlockedTitles: string[];
};
