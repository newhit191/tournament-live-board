import type {
  MatchState,
  PlayerStatus,
  ScoringMode,
  TournamentFormat,
  TournamentStatus,
} from "@/lib/tournament-types";

export function formatTournamentFormat(format: TournamentFormat) {
  switch (format) {
    case "single_elimination":
      return "單淘汰賽";
    case "double_elimination":
      return "雙敗淘汰賽";
    case "round_robin":
      return "循環賽";
    default:
      return format;
  }
}

export function formatTournamentStatus(status: TournamentStatus) {
  switch (status) {
    case "live":
      return "進行中";
    case "draft":
      return "草稿";
    case "completed":
      return "已完賽";
    case "archived":
      return "已封存";
    default:
      return status;
  }
}

export function formatMatchState(state: MatchState) {
  switch (state) {
    case "live":
      return "進行中";
    case "completed":
      return "已結束";
    case "scheduled":
      return "待開始";
    default:
      return state;
  }
}

export function formatPlayerStatus(status: PlayerStatus) {
  switch (status) {
    case "active":
      return "參賽中";
    case "eliminated":
      return "已淘汰";
    case "withdrawn":
      return "已退賽";
    default:
      return status;
  }
}

export function formatDataSource(source: "google-sheets" | "mock-data") {
  return source === "google-sheets" ? "Google Sheets" : "本機示範資料";
}

export function formatScoringMode(mode: ScoringMode) {
  return mode === "target_score" ? "目標分制" : "局數加總制";
}

export function formatScoringRule({
  scoringMode,
  targetScore,
  setCount,
}: {
  scoringMode: ScoringMode;
  targetScore: number | null;
  setCount: number | null;
}) {
  if (scoringMode === "target_score") {
    return `先達到 ${targetScore ?? "-"} 分者獲勝`;
  }

  return `共 ${setCount ?? "-"} 局，最終以各局分數加總決定勝負`;
}
