import type {
  MatchState,
  TournamentStatus,
} from "@/lib/tournament-types";

const SHORT_DATE_TIME = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const DAY_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatDateTime(value: string | null) {
  if (!value) {
    return "TBD";
  }

  return SHORT_DATE_TIME.format(new Date(value));
}

export function formatDate(value: string | null) {
  if (!value) {
    return "TBD";
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
