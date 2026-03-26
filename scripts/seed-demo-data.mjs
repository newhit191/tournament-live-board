import fs from "node:fs";
import path from "node:path";

import { google } from "googleapis";

const tabHeaders = {
  tournaments: [
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
  players: [
    "player_id",
    "tournament_id",
    "display_name",
    "seed",
    "status",
    "created_at",
    "avatar_url",
  ],
  matches: [
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
  match_sets: [
    "set_id",
    "match_id",
    "set_no",
    "player1_score",
    "player2_score",
    "note",
    "updated_at",
  ],
  standings: [
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
  event_log: [
    "log_id",
    "tournament_id",
    "match_id",
    "action",
    "payload",
    "created_at",
  ],
};

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

function createPlayers(tournamentId, names, createdAt) {
  return names.map((displayName, index) => ({
    id: `${tournamentId}-player-${index + 1}`,
    tournamentId,
    displayName,
    avatarUrl: "",
    seed: index + 1,
    status: "active",
    createdAt,
  }));
}

function createSet(id, matchId, setNo, player1Score, player2Score, updatedAt, note = "") {
  return {
    id,
    matchId,
    setNo,
    player1Score,
    player2Score,
    note,
    updatedAt,
  };
}

function createMatch(match) {
  const totals = match.sets.reduce(
    (acc, set) => ({
      player1Total: acc.player1Total + set.player1Score,
      player2Total: acc.player2Total + set.player2Score,
    }),
    { player1Total: 0, player2Total: 0 },
  );

  const winnerId =
    match.state === "completed" && totals.player1Total !== totals.player2Total
      ? totals.player1Total > totals.player2Total
        ? match.player1Id
        : match.player2Id
      : "";

  return {
    ...match,
    player1Total: totals.player1Total,
    player2Total: totals.player2Total,
    winnerId,
  };
}

function buildDemoData() {
  const bladeCreatedAt = "2026-03-24T18:00:00+08:00";
  const bladePlayers = createPlayers(
    "blade-city-showdown",
    ["馬提", "假面 Z", "凱伊", "小諾", "露娜", "阿澤", "米可", "奧里安"],
    bladeCreatedAt,
  );
  const bladeMatches = [
    createMatch({
      id: "blade-qf-1",
      tournamentId: "blade-city-showdown",
      roundName: "八強",
      roundOrder: 1,
      matchOrder: 1,
      player1Id: bladePlayers[0].id,
      player2Id: bladePlayers[1].id,
      state: "completed",
      isFeatured: false,
      scheduledLabel: "第 1 輪 / 場次 1",
      updatedAt: "2026-03-25T18:26:00+08:00",
      sets: [createSet("blade-qf-1-set-1", "blade-qf-1", 1, 5, 4, "2026-03-25T18:26:00+08:00")],
    }),
    createMatch({
      id: "blade-qf-2",
      tournamentId: "blade-city-showdown",
      roundName: "八強",
      roundOrder: 1,
      matchOrder: 2,
      player1Id: bladePlayers[2].id,
      player2Id: bladePlayers[3].id,
      state: "completed",
      isFeatured: false,
      scheduledLabel: "第 1 輪 / 場次 2",
      updatedAt: "2026-03-25T18:31:00+08:00",
      sets: [createSet("blade-qf-2-set-1", "blade-qf-2", 1, 3, 5, "2026-03-25T18:31:00+08:00")],
    }),
    createMatch({
      id: "blade-sf-1",
      tournamentId: "blade-city-showdown",
      roundName: "四強",
      roundOrder: 2,
      matchOrder: 1,
      player1Id: bladePlayers[0].id,
      player2Id: bladePlayers[3].id,
      state: "live",
      isFeatured: true,
      scheduledLabel: "第 2 輪 / 場次 1",
      updatedAt: "2026-03-25T20:07:00+08:00",
      sets: [createSet("blade-sf-1-set-1", "blade-sf-1", 1, 3, 2, "2026-03-25T20:07:00+08:00")],
    }),
    createMatch({
      id: "blade-final",
      tournamentId: "blade-city-showdown",
      roundName: "冠軍賽",
      roundOrder: 3,
      matchOrder: 1,
      player1Id: "pending:blade-final:1",
      player2Id: "pending:blade-final:2",
      state: "scheduled",
      isFeatured: false,
      scheduledLabel: "第 3 輪 / 場次 1",
      updatedAt: "2026-03-25T20:10:00+08:00",
      sets: [createSet("blade-final-set-1", "blade-final", 1, 0, 0, "2026-03-25T20:10:00+08:00")],
    }),
  ];

  const archeryCreatedAt = "2026-03-20T15:00:00+08:00";
  const archeryPlayers = createPlayers(
    "archery-night-open",
    ["憟恩", "千夏", "塔洛", "瀨那"],
    archeryCreatedAt,
  );
  const archeryMatches = [
    createMatch({
      id: "archery-r1-m1",
      tournamentId: "archery-night-open",
      roundName: "第 1 輪",
      roundOrder: 1,
      matchOrder: 1,
      player1Id: archeryPlayers[0].id,
      player2Id: archeryPlayers[1].id,
      state: "completed",
      isFeatured: false,
      scheduledLabel: "第 1 輪 / 場次 1",
      updatedAt: "2026-03-20T15:26:00+08:00",
      sets: [
        createSet("archery-r1-m1-s1", "archery-r1-m1", 1, 28, 27, "2026-03-20T15:08:00+08:00"),
        createSet("archery-r1-m1-s2", "archery-r1-m1", 2, 29, 26, "2026-03-20T15:15:00+08:00"),
        createSet("archery-r1-m1-s3", "archery-r1-m1", 3, 27, 28, "2026-03-20T15:26:00+08:00"),
      ],
    }),
    createMatch({
      id: "archery-r1-m2",
      tournamentId: "archery-night-open",
      roundName: "第 1 輪",
      roundOrder: 1,
      matchOrder: 2,
      player1Id: archeryPlayers[2].id,
      player2Id: archeryPlayers[3].id,
      state: "completed",
      isFeatured: false,
      scheduledLabel: "第 1 輪 / 場次 2",
      updatedAt: "2026-03-20T15:30:00+08:00",
      sets: [
        createSet("archery-r1-m2-s1", "archery-r1-m2", 1, 26, 30, "2026-03-20T15:09:00+08:00"),
        createSet("archery-r1-m2-s2", "archery-r1-m2", 2, 29, 28, "2026-03-20T15:19:00+08:00"),
        createSet("archery-r1-m2-s3", "archery-r1-m2", 3, 30, 29, "2026-03-20T15:30:00+08:00"),
      ],
    }),
  ];

  const tournaments = [
    {
      id: "blade-city-showdown",
      slug: "blade-city-showdown",
      name: "測試示範賽",
      format: "single_elimination",
      status: "live",
      scoringMode: "target_score",
      targetScore: 4,
      setCount: null,
      currentMatchId: "blade-sf-1",
      theme: "ember-grid",
      venue: "主舞台 / A 台",
      heroKicker: "主辦方建立的新賽事",
      heroSummary: "目標分制示範賽，先達到或超過 4 分即獲勝。",
      startedAt: "2026-03-25T19:00:00+08:00",
      endedAt: "",
      createdAt: bladeCreatedAt,
      updatedAt: "2026-03-25T20:07:00+08:00",
      players: bladePlayers,
      matches: bladeMatches,
    },
    {
      id: "archery-night-open",
      slug: "archery-night-open",
      name: "夜間射箭公開賽",
      format: "round_robin",
      status: "completed",
      scoringMode: "set_total",
      targetScore: null,
      setCount: 3,
      currentMatchId: "",
      theme: "signal-cyan",
      venue: "西館練習場",
      heroKicker: "作品展示 / 分局加總制",
      heroSummary: "固定 3 局，以所有分局總分判定勝負。",
      startedAt: "2026-03-20T15:00:00+08:00",
      endedAt: "2026-03-20T16:30:00+08:00",
      createdAt: archeryCreatedAt,
      updatedAt: "2026-03-20T16:30:00+08:00",
      players: archeryPlayers,
      matches: archeryMatches,
    },
  ];

  return { tournaments };
}

function buildStandingsRows(tournament) {
  if (tournament.format !== "round_robin") {
    return [];
  }

  const standings = new Map(
    tournament.players.map((player) => [
      player.id,
      {
        tournamentId: tournament.id,
        playerId: player.id,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDiff: 0,
        rank: 0,
        updatedAt: tournament.updatedAt,
      },
    ]),
  );

  for (const match of tournament.matches) {
    if (match.state !== "completed") {
      continue;
    }

    const left = standings.get(match.player1Id);
    const right = standings.get(match.player2Id);

    if (!left || !right) {
      continue;
    }

    left.pointsFor += match.player1Total;
    left.pointsAgainst += match.player2Total;
    left.pointDiff = left.pointsFor - left.pointsAgainst;

    right.pointsFor += match.player2Total;
    right.pointsAgainst += match.player1Total;
    right.pointDiff = right.pointsFor - right.pointsAgainst;

    if (match.winnerId === match.player1Id) {
      left.wins += 1;
      right.losses += 1;
    } else if (match.winnerId === match.player2Id) {
      right.wins += 1;
      left.losses += 1;
    }
  }

  return [...standings.values()]
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
      return b.pointsFor - a.pointsFor;
    })
    .map((standing, index) => ({
      ...standing,
      rank: index + 1,
    }));
}

function objectToRow(headers, data) {
  return headers.map((header) => {
    const value = data[header];
    if (typeof value === "boolean") {
      return value ? "TRUE" : "FALSE";
    }
    return value ?? "";
  });
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

async function clearBodyRows(sheets, spreadsheetId) {
  await sheets.spreadsheets.values.batchClear({
    spreadsheetId,
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
}

async function writeTabRows(sheets, spreadsheetId, tabName, rows) {
  if (rows.length === 0) {
    return;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A2`,
    valueInputOption: "RAW",
    requestBody: {
      values: rows,
    },
  });
}

async function main() {
  const config = resolveConfig();
  ensureConfig(config);

  const sheets = await createSheetsClient(config);
  const { tournaments } = buildDemoData();

  const tournamentRows = tournaments.map((tournament) =>
    objectToRow(tabHeaders.tournaments, {
      tournament_id: tournament.id,
      slug: tournament.slug,
      name: tournament.name,
      format: tournament.format,
      status: tournament.status,
      win_score_rule:
        tournament.scoringMode === "target_score" ? tournament.targetScore : "",
      current_match_id: tournament.currentMatchId,
      theme: tournament.theme,
      venue: tournament.venue,
      hero_kicker: tournament.heroKicker,
      hero_summary: tournament.heroSummary,
      started_at: tournament.startedAt,
      ended_at: tournament.endedAt,
      created_at: tournament.createdAt,
      updated_at: tournament.updatedAt,
      scoring_mode: tournament.scoringMode,
      target_score: tournament.targetScore,
      set_count: tournament.setCount,
    }),
  );

  const playerRows = tournaments.flatMap((tournament) =>
    tournament.players.map((player) =>
      objectToRow(tabHeaders.players, {
        player_id: player.id,
        tournament_id: player.tournamentId,
        display_name: player.displayName,
        seed: player.seed,
        status: player.status,
        avatar_url: player.avatarUrl,
        created_at: player.createdAt,
      }),
    ),
  );

  const matchRows = tournaments.flatMap((tournament) =>
    tournament.matches.map((match) =>
      objectToRow(tabHeaders.matches, {
        match_id: match.id,
        tournament_id: match.tournamentId,
        round_name: match.roundName,
        round_order: match.roundOrder,
        match_order: match.matchOrder,
        player1_id: match.player1Id,
        player2_id: match.player2Id,
        player1_total: match.player1Total,
        player2_total: match.player2Total,
        winner_id: match.winnerId,
        state: match.state,
        is_featured: match.isFeatured,
        scheduled_label: match.scheduledLabel,
        updated_at: match.updatedAt,
      }),
    ),
  );

  const setRows = tournaments.flatMap((tournament) =>
    tournament.matches.flatMap((match) =>
      match.sets.map((set) =>
        objectToRow(tabHeaders.match_sets, {
          set_id: set.id,
          match_id: set.matchId,
          set_no: set.setNo,
          player1_score: set.player1Score,
          player2_score: set.player2Score,
          note: set.note,
          updated_at: set.updatedAt,
        }),
      ),
    ),
  );

  const standingRows = tournaments.flatMap((tournament) =>
    buildStandingsRows(tournament).map((standing) =>
      objectToRow(tabHeaders.standings, {
        tournament_id: standing.tournamentId,
        player_id: standing.playerId,
        wins: standing.wins,
        losses: standing.losses,
        points_for: standing.pointsFor,
        points_against: standing.pointsAgainst,
        point_diff: standing.pointDiff,
        rank: standing.rank,
        updated_at: standing.updatedAt,
      }),
    ),
  );

  await clearBodyRows(sheets, config.spreadsheetId);
  await writeTabRows(sheets, config.spreadsheetId, "tournaments", tournamentRows);
  await writeTabRows(sheets, config.spreadsheetId, "players", playerRows);
  await writeTabRows(sheets, config.spreadsheetId, "matches", matchRows);
  await writeTabRows(sheets, config.spreadsheetId, "match_sets", setRows);
  await writeTabRows(sheets, config.spreadsheetId, "standings", standingRows);

  console.log("已將示範資料寫入 Google Sheet。");
  console.log(`賽事數量：${tournamentRows.length}`);
  console.log(`選手數量：${playerRows.length}`);
  console.log(`比賽數量：${matchRows.length}`);
  console.log(`分局數量：${setRows.length}`);
}

main().catch((error) => {
  console.error("寫入示範資料失敗。");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
