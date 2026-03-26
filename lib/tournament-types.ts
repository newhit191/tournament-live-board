export type TournamentFormat =
  | "single_elimination"
  | "double_elimination"
  | "round_robin";
export type TournamentStatus = "draft" | "live" | "completed" | "archived";
export type MatchState = "scheduled" | "live" | "completed";
export type PlayerStatus = "active" | "eliminated" | "withdrawn";
export type ScoringMode = "target_score" | "set_total";

export type PlayerRecord = {
  id: string;
  tournamentId: string;
  displayName: string;
  avatarUrl: string | null;
  seed: number | null;
  status: PlayerStatus;
  createdAt: string;
};

export type MatchSetRecord = {
  id: string;
  matchId: string;
  setNo: number;
  player1Score: number;
  player2Score: number;
  note: string | null;
  updatedAt: string;
};

export type MatchRecord = {
  id: string;
  tournamentId: string;
  roundName: string;
  roundOrder: number;
  matchOrder: number;
  player1Id: string;
  player2Id: string;
  state: MatchState;
  isFeatured: boolean;
  scheduledLabel: string;
  updatedAt: string;
  sets: MatchSetRecord[];
};

export type StandingRecord = {
  tournamentId: string;
  playerId: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  rank: number;
  updatedAt: string;
};

export type TournamentRecord = {
  id: string;
  slug: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  scoringMode: ScoringMode;
  targetScore: number | null;
  setCount: number | null;
  currentMatchId: string | null;
  theme: string;
  venue: string;
  heroKicker: string;
  heroSummary: string;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  players: PlayerRecord[];
  matches: MatchRecord[];
  standings?: StandingRecord[];
};

export type ResolvedMatch = Omit<MatchRecord, "player1Id" | "player2Id"> & {
  player1: PlayerRecord;
  player2: PlayerRecord;
  player1Total: number;
  player2Total: number;
  winnerId: string | null;
  recordedSetCount: number;
};

export type ResolvedStanding = StandingRecord & {
  player: PlayerRecord;
};

export type TournamentView = Omit<TournamentRecord, "matches" | "standings"> & {
  matches: ResolvedMatch[];
  standings: ResolvedStanding[];
  currentMatch: ResolvedMatch | null;
  stats: {
    playerCount: number;
    totalMatches: number;
    completedMatches: number;
    liveMatches: number;
  };
};

export type TournamentSummary = Pick<
  TournamentView,
  | "id"
  | "slug"
  | "name"
  | "format"
  | "status"
  | "theme"
  | "venue"
  | "heroKicker"
  | "heroSummary"
  | "startedAt"
  | "endedAt"
  | "scoringMode"
  | "targetScore"
  | "setCount"
> & {
  currentMatchId: string | null;
  playerCount: number;
  matchCount: number;
  liveMatchCount: number;
};
