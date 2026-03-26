import { google } from "googleapis";

import { GOOGLE_SHEET_TABS } from "@/lib/google-sheet-schema";
import type {
  MatchRecord,
  MatchSetRecord,
  PlayerRecord,
  ScoringMode,
  TournamentRecord,
} from "@/lib/tournament-types";

const SHEET_TABS = {
  tournaments: "tournaments",
  players: "players",
  matches: "matches",
  matchSets: "match_sets",
  standings: "standings",
  eventLog: "event_log",
} as const;

export type SheetTabName = (typeof SHEET_TABS)[keyof typeof SHEET_TABS];
export type RawSheetRow = Record<string, string>;

const TAB_HEADERS = Object.fromEntries(
  GOOGLE_SHEET_TABS.map((tab) => [tab.name, tab.headers]),
) as Record<SheetTabName, string[]>;

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

function parseRows(values: string[][] | null | undefined): RawSheetRow[] {
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

function toValues(tab: SheetTabName, rows: RawSheetRow[]) {
  const headers = TAB_HEADERS[tab];

  return rows.map((row) => headers.map((header) => row[header] ?? ""));
}

function createEmptyTabRecord() {
  return {
    [SHEET_TABS.tournaments]: [],
    [SHEET_TABS.players]: [],
    [SHEET_TABS.matches]: [],
    [SHEET_TABS.matchSets]: [],
    [SHEET_TABS.standings]: [],
    [SHEET_TABS.eventLog]: [],
  } as Record<SheetTabName, RawSheetRow[]>;
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
    throw new Error("尚未完成 Google Sheets 連線設定。");
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

export async function readSheetRows(tab: SheetTabName) {
  const rowsByTab = await readMultipleSheetRows([tab]);
  return rowsByTab[tab];
}

export async function readMultipleSheetRows(tabs: SheetTabName[]) {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const requestedTabs = [...new Set(tabs)];
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: requestedTabs.map((tab) => `${tab}!A:Z`),
  });

  const result = createEmptyTabRecord();
  const valueRanges = response.data.valueRanges ?? [];

  for (let index = 0; index < requestedTabs.length; index += 1) {
    const tab = requestedTabs[index];
    const values = valueRanges[index]?.values;
    result[tab] = parseRows(values);
  }

  return result;
}

export async function replaceSheetRows(tab: SheetTabName, rows: RawSheetRow[]) {
  await replaceMultipleSheetTabs([{ tab, rows }]);
}

function getTailClearRange(tab: SheetTabName, rowCount: number) {
  if (rowCount <= 0) {
    return `${tab}!A2:Z`;
  }

  return `${tab}!A${rowCount + 2}:Z`;
}

export async function replaceMultipleSheetTabs(
  payload: Array<{ tab: SheetTabName; rows: RawSheetRow[] }>,
) {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const normalizedPayload = payload.map((entry) => ({
    tab: entry.tab,
    rows: entry.rows,
  }));
  const upsertPayload = normalizedPayload.filter((entry) => entry.rows.length > 0);

  if (upsertPayload.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: upsertPayload.map((entry) => ({
          range: `${entry.tab}!A2`,
          values: toValues(entry.tab, entry.rows),
        })),
      },
    });
  }

  await sheets.spreadsheets.values.batchClear({
    spreadsheetId,
    requestBody: {
      ranges: normalizedPayload.map((entry) =>
        getTailClearRange(entry.tab, entry.rows.length),
      ),
    },
  });
}

function mapPlayers(rows: RawSheetRow[]): PlayerRecord[] {
  return rows.map((row) => ({
    id: row.player_id,
    tournamentId: row.tournament_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || null,
    seed: row.seed ? parseNumber(row.seed, 0) : null,
    status:
      row.status === "eliminated" || row.status === "withdrawn"
        ? row.status
        : "active",
    createdAt: row.created_at || new Date().toISOString(),
  }));
}

function mapSets(rows: RawSheetRow[]): MatchSetRecord[] {
  return rows.map((row) => ({
    id: row.set_id,
    matchId: row.match_id,
    setNo: parseNumber(row.set_no, 1),
    player1Score: parseNumber(row.player1_score, 0),
    player2Score: parseNumber(row.player2_score, 0),
    note: row.note || null,
    updatedAt: row.updated_at || new Date().toISOString(),
  }));
}

function mapMatches(rows: RawSheetRow[], sets: MatchSetRecord[]): MatchRecord[] {
  return rows.map((row) => ({
    id: row.match_id,
    tournamentId: row.tournament_id,
    roundName: row.round_name || "未命名輪次",
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

function inferScoringMode(
  row: RawSheetRow,
  tournamentMatches: MatchRecord[],
): ScoringMode {
  if (row.scoring_mode === "target_score" || row.scoring_mode === "set_total") {
    return row.scoring_mode;
  }

  const maxSetCount = Math.max(
    0,
    ...tournamentMatches.map((match) => match.sets.length),
  );

  return maxSetCount > 1 ? "set_total" : "target_score";
}

export async function loadTournamentsFromSheets(): Promise<TournamentRecord[]> {
  const rowsByTab = await readMultipleSheetRows([
    SHEET_TABS.tournaments,
    SHEET_TABS.players,
    SHEET_TABS.matches,
    SHEET_TABS.matchSets,
  ]);
  const tournamentRows = rowsByTab[SHEET_TABS.tournaments];
  const playerRows = rowsByTab[SHEET_TABS.players];
  const matchRows = rowsByTab[SHEET_TABS.matches];
  const matchSetRows = rowsByTab[SHEET_TABS.matchSets];

  const players = mapPlayers(playerRows);
  const sets = mapSets(matchSetRows);
  const matches = mapMatches(matchRows, sets);

  return tournamentRows.map((row) => {
    const tournamentMatches = matches.filter(
      (match) => match.tournamentId === row.tournament_id,
    );
    const scoringMode = inferScoringMode(row, tournamentMatches);
    const inferredSetCount =
      Math.max(0, ...tournamentMatches.map((match) => match.sets.length)) || null;
    const targetScoreValue = parseNumber(
      row.target_score || row.win_score_rule,
      0,
    );
    const setCountValue = parseNumber(row.set_count, 0);

    return {
      id: row.tournament_id,
      slug: row.slug || toSlug(row.name || row.tournament_id),
      name: row.name,
      format:
        row.format === "round_robin"
          ? "round_robin"
          : row.format === "double_elimination"
            ? "double_elimination"
            : "single_elimination",
      status:
        row.status === "draft" ||
        row.status === "completed" ||
        row.status === "archived"
          ? row.status
          : "live",
      scoringMode,
      targetScore:
        scoringMode === "target_score" && targetScoreValue > 0
          ? targetScoreValue
          : null,
      setCount:
        scoringMode === "set_total"
          ? setCountValue > 0
            ? setCountValue
            : inferredSetCount
          : null,
      currentMatchId: row.current_match_id || null,
      theme: row.theme || "sheet-driven",
      venue: row.venue || "主舞台",
      heroKicker: row.hero_kicker || "Google Sheets 資料來源",
      heroSummary:
        row.hero_summary || "目前這場賽事直接由 Google Sheets 驅動展示。",
      startedAt: row.started_at || null,
      endedAt: row.ended_at || null,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
      players: players.filter((player) => player.tournamentId === row.tournament_id),
      matches: tournamentMatches,
    };
  });
}
