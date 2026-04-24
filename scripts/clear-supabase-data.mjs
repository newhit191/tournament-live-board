import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function resolveConfig() {
  const root = process.cwd();
  const env = {
    ...parseEnvFile(path.join(root, ".env")),
    ...parseEnvFile(path.join(root, ".env.local")),
    ...process.env,
  };

  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  };
}

async function countRows(client, table, idColumn) {
  const { count, error } = await client
    .from(table)
    .select(idColumn, { count: "exact", head: true });
  if (error) {
    throw new Error(`[count] ${table}: ${error.message}`);
  }
  return count ?? 0;
}

async function deleteAll(client, table, idColumn, matcher = "notNull") {
  let query = client.from(table).delete();

  if (matcher === "gteZero") {
    query = query.gte(idColumn, 0);
  } else {
    query = query.not(idColumn, "is", null);
  }

  const { error } = await query;
  if (error) {
    throw new Error(`[delete] ${table}: ${error.message}`);
  }
}

async function main() {
  const config = resolveConfig();
  if (!config.url || !config.serviceRoleKey) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY，無法清理 Supabase 資料。");
  }

  const client = createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 依外鍵關係自上而下刪除，避免 restrict/cascade 衝突。
  const plan = [
    { table: "match_stakes", idColumn: "id", matcher: "gteZero" },
    { table: "matches", idColumn: "id" },
    { table: "challenge_participants", idColumn: "id" },
    { table: "challenges", idColumn: "id" },
    { table: "player_titles", idColumn: "id" },
    { table: "wallet_ledger", idColumn: "id", matcher: "gteZero" },
    { table: "player_wallets", idColumn: "player_id" },
    { table: "players", idColumn: "id" },
  ];

  console.log("=== Supabase 清理開始 ===");
  for (const step of plan) {
    const before = await countRows(client, step.table, step.idColumn);
    await deleteAll(client, step.table, step.idColumn, step.matcher);
    const after = await countRows(client, step.table, step.idColumn);
    console.log(`${step.table}: ${before} -> ${after}`);
  }
  console.log("=== Supabase 清理完成 ===");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

