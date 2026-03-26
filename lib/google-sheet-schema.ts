export type SheetTabDefinition = {
  name: string;
  headers: string[];
};

export const GOOGLE_SHEET_TABS: SheetTabDefinition[] = [
  {
    name: "tournaments",
    headers: [
      "tournament_id",
      "slug",
      "name",
      "format",
      "status",
      "win_score_rule",
      "current_match_id",
      "theme",
      "venue",
      "hero_kicker",
      "hero_summary",
      "started_at",
      "ended_at",
      "created_at",
      "updated_at",
      "scoring_mode",
      "target_score",
      "set_count",
    ],
  },
  {
    name: "players",
    headers: [
      "player_id",
      "tournament_id",
      "display_name",
      "seed",
      "status",
      "created_at",
      "avatar_url",
    ],
  },
  {
    name: "matches",
    headers: [
      "match_id",
      "tournament_id",
      "round_name",
      "round_order",
      "match_order",
      "player1_id",
      "player2_id",
      "player1_total",
      "player2_total",
      "winner_id",
      "state",
      "is_featured",
      "scheduled_label",
      "updated_at",
    ],
  },
  {
    name: "match_sets",
    headers: [
      "set_id",
      "match_id",
      "set_no",
      "player1_score",
      "player2_score",
      "note",
      "updated_at",
    ],
  },
  {
    name: "standings",
    headers: [
      "tournament_id",
      "player_id",
      "wins",
      "losses",
      "points_for",
      "points_against",
      "point_diff",
      "rank",
      "updated_at",
    ],
  },
  {
    name: "event_log",
    headers: [
      "log_id",
      "tournament_id",
      "match_id",
      "action",
      "payload",
      "created_at",
    ],
  },
];
