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
      return "歷史賽事";
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
      return "未上場";
    default:
      return status;
  }
}

export function formatDataSource(source: "google-sheets" | "mock-data") {
  return source === "google-sheets" ? "Google Sheets" : "內建展示資料";
}

export function formatScoringMode(mode: ScoringMode) {
  return mode === "target_score" ? "目標分制" : "分局加總制";
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
    return `先達到 ${targetScore ?? "-"} 分即獲勝`;
  }

  return `固定 ${setCount ?? "-"} 局，全部打完後加總比分`;
}
