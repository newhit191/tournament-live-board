import fs from "node:fs";
import path from "node:path";

import { google } from "googleapis";

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

async function main() {
  const config = resolveConfig();
  ensureConfig(config);

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: config.clientEmail,
      private_key: config.privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.batchClear({
    spreadsheetId: config.spreadsheetId,
    requestBody: {
      ranges: [
        "tournaments!A2:Z",
        "players!A2:Z",
        "matches!A2:Z",
        "match_sets!A2:Z",
        "standings!A2:Z",
        "event_log!A2:Z",
      ],
    },
  });

  console.log("已清除所有示範/測試資料（保留表頭）。");
}

main().catch((error) => {
  console.error("清除 Google Sheet 資料失敗。");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
