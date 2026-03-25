import { google } from "googleapis";

import type {
  MatchRecord,
  MatchSetRecord,
  PlayerRecord,
  TournamentRecord,
} from "@/lib/tournament-types";

const SHEET_TABS = {
  tournaments: "tournaments",
  players: "players",
  matches: "matches",
  matchSets: "match_sets",
} as const;

type RawRow = Record<string, string>;

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseNumber(value: string | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: string | undefined) {
  return value === "TRUE" || value === "true" || value === "1";
}

function parseRows(values: string[][] | null | undefined): RawRow[] {
  if (!values?.length) {
    return [];
  }

  const [header, ...rows] = values;

  return rows
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row) =>
      Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""])),
    );
}

export function isGoogleSheetsConfigured() {
  return Boolean(
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
      process.env.GOOGLE_SHEETS_CLIENT_EMAIL &&
      process.env.GOOGLE_SHEETS_PRIVATE_KEY,
  );
}

async function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (
    !process.env.GOOGLE_SHEETS_SPREADSHEET_ID ||
    !clientEmail ||
    !privateKey
  ) {
    throw new Error("Google Sheets is not configured.");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

async function readTab(tab: string) {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A:Z`,
  });

  return parseRows(response.data.values);
}

function mapPlayers(rows: RawRow[]): PlayerRecord[] {
  return rows.map((row) => ({
    id: row.player_id,
    tournamentId: row.tournament_id,
    displayName: row.display_name,
    seed: row.seed ? parseNumber(row.seed, 0) : null,
    status:
      row.status === "eliminated" || row.status === "withdrawn"
        ? row.status
        : "active",
    createdAt: row.created_at || new Date().toISOString(),
  }));
}

function mapSets(rows: RawRow[]): MatchSetRecord[] {
  return rows.map((row) => ({
    id: row.set_id,
    matchId: row.match_id,
    setNo: parseNumber(row.set_no, 0),
    player1Score: parseNumber(row.player1_score, 0),
    player2Score: parseNumber(row.player2_score, 0),
    note: row.note || null,
    updatedAt: row.updated_at || new Date().toISOString(),
  }));
}

function mapMatches(rows: RawRow[], sets: MatchSetRecord[]): MatchRecord[] {
  return rows.map((row) => ({
    id: row.match_id,
    tournamentId: row.tournament_id,
    roundName: row.round_name || "Main Bracket",
    roundOrder: parseNumber(row.round_order, 1),
    matchOrder: parseNumber(row.match_order, 1),
    player1Id: row.player1_id,
    player2Id: row.player2_id,
    state:
      row.state === "completed" || row.state === "live" ? row.state : "scheduled",
    isFeatured: parseBoolean(row.is_featured),
    scheduledLabel: row.scheduled_label || "",
    updatedAt: row.updated_at || new Date().toISOString(),
    sets: sets
      .filter((set) => set.matchId === row.match_id)
      .toSorted((left, right) => left.setNo - right.setNo),
  }));
}

export async function loadTournamentsFromSheets(): Promise<TournamentRecord[]> {
  const [tournamentRows, playerRows, matchRows, matchSetRows] = await Promise.all([
    readTab(SHEET_TABS.tournaments),
    readTab(SHEET_TABS.players),
    readTab(SHEET_TABS.matches),
    readTab(SHEET_TABS.matchSets),
  ]);

  const players = mapPlayers(playerRows);
  const sets = mapSets(matchSetRows);
  const matches = mapMatches(matchRows, sets);

  return tournamentRows.map((row) => ({
    id: row.tournament_id,
    slug: row.slug || toSlug(row.name || row.tournament_id),
    name: row.name,
    format: row.format === "round_robin" ? "round_robin" : "single_elimination",
    status:
      row.status === "draft" ||
      row.status === "completed" ||
      row.status === "archived"
        ? row.status
        : "live",
    winScoreRule: parseNumber(row.win_score_rule, 0),
    currentMatchId: row.current_match_id || null,
    theme: row.theme || "sheet-driven",
    venue: row.venue || "Google Sheets Source",
    heroKicker: row.hero_kicker || "Live Data / Google Sheets",
    heroSummary:
      row.hero_summary ||
      "This tournament is being read directly from the configured spreadsheet.",
    startedAt: row.started_at || null,
    endedAt: row.ended_at || null,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    players: players.filter((player) => player.tournamentId === row.tournament_id),
    matches: matches.filter((match) => match.tournamentId === row.tournament_id),
  }));
}
