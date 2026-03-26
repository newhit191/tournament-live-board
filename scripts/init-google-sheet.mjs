import fs from "node:fs";
import path from "node:path";

import { google } from "googleapis";

const tabDefinitions = [
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

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, "utf8");
  const result = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function resolveConfig() {
  const cwd = process.cwd();
  const env = {
    ...parseEnvFile(path.join(cwd, ".env.local")),
    ...process.env,
  };

  return {
    spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
    clientEmail: env.GOOGLE_SHEETS_CLIENT_EMAIL,
    privateKey: env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  };
}

function ensureConfig(config) {
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`請先在 .env.local 補齊：${missing.join(", ")}`);
  }
}

async function createSheetsClient(config) {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: config.clientEmail,
      private_key: config.privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

async function getSpreadsheet(sheets, spreadsheetId) {
  const response = await sheets.spreadsheets.get({ spreadsheetId });
  return response.data;
}

async function ensureTabs(sheets, spreadsheetId, existingTitles) {
  const missingTabs = tabDefinitions
    .filter((tab) => !existingTitles.has(tab.name))
    .map((tab) => ({
      addSheet: {
        properties: {
          title: tab.name,
        },
      },
    }));

  if (missingTabs.length === 0) {
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: missingTabs,
    },
  });
}

async function writeHeaders(sheets, spreadsheetId) {
  for (const tab of tabDefinitions) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab.name}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [tab.headers],
      },
    });
  }
}

async function freezeHeaderRows(sheets, spreadsheetId, sheetsMeta) {
  const requests = sheetsMeta
    .filter((sheet) =>
      tabDefinitions.some((tab) => tab.name === sheet.properties?.title),
    )
    .map((sheet) => ({
      updateSheetProperties: {
        properties: {
          sheetId: sheet.properties.sheetId,
          gridProperties: {
            frozenRowCount: 1,
          },
        },
        fields: "gridProperties.frozenRowCount",
      },
    }));

  if (requests.length === 0) {
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests,
    },
  });
}

async function main() {
  const config = resolveConfig();
  ensureConfig(config);

  const sheets = await createSheetsClient(config);
  const before = await getSpreadsheet(sheets, config.spreadsheetId);
  const existingTitles = new Set(
    (before.sheets ?? []).map((sheet) => sheet.properties?.title).filter(Boolean),
  );

  await ensureTabs(sheets, config.spreadsheetId, existingTitles);
  await writeHeaders(sheets, config.spreadsheetId);

  const after = await getSpreadsheet(sheets, config.spreadsheetId);
  await freezeHeaderRows(sheets, config.spreadsheetId, after.sheets ?? []);

  console.log("Google Sheet 結構已完成初始化。");
  console.log(`Spreadsheet ID: ${config.spreadsheetId}`);
  console.log(
    `已確認分頁：${tabDefinitions.map((tab) => tab.name).join(", ")}`,
  );
}

main().catch((error) => {
  console.error("Google Sheet 初始化失敗。");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
