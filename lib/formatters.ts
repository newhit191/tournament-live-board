import type { MatchState, TournamentStatus } from "@/lib/tournament-types";

const SHORT_DATE_TIME = new Intl.DateTimeFormat("zh-TW", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DAY_DATE = new Intl.DateTimeFormat("zh-TW", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export function formatDateTime(value: string | null) {
  if (!value) {
    return "尚未設定";
  }

  return SHORT_DATE_TIME.format(new Date(value));
}

export function formatDate(value: string | null) {
  if (!value) {
    return "尚未設定";
  }

  return DAY_DATE.format(new Date(value));
}

export function getStatusClasses(status: TournamentStatus | MatchState) {
  switch (status) {
    case "live":
      return "border-emerald-300/30 bg-emerald-400/12 text-emerald-100";
    case "completed":
      return "border-sky-300/25 bg-sky-400/10 text-sky-100";
    case "archived":
      return "border-white/15 bg-white/8 text-white/72";
    case "draft":
    case "scheduled":
      return "border-amber-300/25 bg-amber-300/10 text-amber-100";
    default:
      return "border-white/15 bg-white/8 text-white/72";
  }
}
