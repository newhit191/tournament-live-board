import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";

import { HubControls } from "@/app/hub/hub-controls";
import { logoutFromHubAction } from "@/app/hub/actions";
import { SiteNav } from "@/components/site-nav";
import { PlayerQuickQr } from "@/components/player-quick-qr";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { bootstrapAccountAndPrimaryPlayer } from "@/lib/account-bootstrap";
import { loadLeaderboard } from "@/lib/arena-service";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PlayerRow = {
  id: string;
  display_name: string;
  is_child: boolean;
  player_wallets:
    | {
        balance: number;
        locked_balance: number;
      }
    | {
        balance: number;
        locked_balance: number;
      }[]
    | null;
};

type PlayerTitleRow = {
  player_id: string;
  is_equipped: boolean;
  title_definition_id: string;
};

type TitleDefinitionRow = {
  id: string;
  name: string;
};

type WalletLedgerRow = {
  id: number;
  player_id: string;
  counterparty_player_id: string | null;
  movement: "credit" | "debit" | "lock" | "unlock" | "adjust";
  amount: number;
  event_type: string;
  reason: string | null;
  created_at: string;
};

type PlayerNameRow = {
  id: string;
  display_name: string;
};

const ledgerEventLabels: Record<string, string> = {
  family_transfer: "家庭轉帳",
  gm_adjust: "GM 補正",
  challenge_stake_lock: "對賭鎖定",
  prize_pool_entry_lock: "獎池報名鎖定",
  challenge_stake_cancel_refund: "取消退回",
  prize_pool_cancel_refund: "取消退回",
  challenge_stake_settlement: "對賭結算",
  challenge_loser_unlock: "敗方解鎖",
  challenge_winner_payout: "勝方入帳",
  prize_pool_settlement_rank_1: "第一名獎勵",
  prize_pool_settlement_rank_2: "第二名獎勵",
  prize_pool_settlement_rank_3: "第三名獎勵",
  prize_pool_refund: "獎池退回",
};

function formatLedgerAmount(entry: WalletLedgerRow) {
  if (entry.movement === "credit" || entry.movement === "unlock") {
    return `+${entry.amount}`;
  }
  if (entry.movement === "debit" || entry.movement === "lock") {
    return `-${entry.amount}`;
  }
  return `${entry.amount > 0 ? "+" : ""}${entry.amount}`;
}

function getLedgerAmountClass(entry: WalletLedgerRow) {
  if (entry.movement === "credit" || entry.movement === "unlock") {
    return "text-emerald-200";
  }
  if (entry.movement === "debit" || entry.movement === "lock") {
    return "text-amber-100";
  }
  return "text-cyan-100";
}

function formatLedgerCounterparty(entry: WalletLedgerRow, name: string | null) {
  if (!entry.counterparty_player_id) {
    return "無對手";
  }
  return `對手：${name ?? "外部玩家"}`;
}

function formatLedgerEvent(entry: WalletLedgerRow) {
  return ledgerEventLabels[entry.event_type] ?? entry.event_type;
}

async function HubPageContent() {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  await bootstrapAccountAndPrimaryPlayer({
    userId: user.id,
    email: user.email ?? null,
    displayName: (user.user_metadata as { display_name?: string } | null)?.display_name ?? null,
  });

  // 即時同步總榜與跨家庭榜，讓玩家中心直接顯示全服資訊
  const [overallLeaderboard, crossFamilyLeaderboard] = await Promise.all([
    loadLeaderboard("overall"),
    loadLeaderboard("cross_family"),
  ]);
  const leaderboardByPlayer = new Map(
    overallLeaderboard.map((entry) => [entry.player.id, entry]),
  );

  const { data: account } = await client
    .from("accounts")
    .select("display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const { data: playersRaw } = await client
    .from("players")
    .select("id, display_name, is_child, player_wallets(balance, locked_balance)")
    .eq("owner_account_id", user.id)
    .order("created_at", { ascending: true });

  const playerIds = ((playersRaw as PlayerRow[] | null) ?? []).map((item) => item.id);

  const { data: titleDefinitionsRaw } = await client
    .from("title_definitions")
    .select("id, name")
    .eq("is_active", true);

  const { data: playerTitlesRaw } = playerIds.length
    ? await client
        .from("player_titles")
        .select("player_id, is_equipped, title_definition_id")
        .in("player_id", playerIds)
    : { data: [] as PlayerTitleRow[] };

  const titleNameMap = new Map(
    ((titleDefinitionsRaw as TitleDefinitionRow[] | null) ?? []).map((item) => [item.id, item.name]),
  );
  const titleByPlayer = new Map<
    string,
    { unlocked: { id: string; name: string }[]; equipped: string | null }
  >();

  ((playerTitlesRaw as PlayerTitleRow[] | null) ?? []).forEach((row) => {
    const titleName = titleNameMap.get(row.title_definition_id);
    if (!titleName) {
      return;
    }
    const snapshot = titleByPlayer.get(row.player_id) ?? {
      unlocked: [],
      equipped: null,
    };
    snapshot.unlocked.push({ id: row.title_definition_id, name: titleName });
    if (row.is_equipped) {
      snapshot.equipped = titleName;
    }
    titleByPlayer.set(row.player_id, snapshot);
  });

  const basePlayers =
    (playersRaw as PlayerRow[] | null)?.map((player) => {
      const wallet = Array.isArray(player.player_wallets)
        ? player.player_wallets[0]
        : player.player_wallets;

      return {
        id: player.id,
        displayName: player.display_name,
        isChild: player.is_child,
        balance: wallet?.balance ?? 0,
        lockedBalance: wallet?.locked_balance ?? 0,
        unlockedTitles: titleByPlayer.get(player.id)?.unlocked ?? [],
        equippedTitle: titleByPlayer.get(player.id)?.equipped ?? null,
      };
    }) ?? [];

  const { data: ledgerRaw } = playerIds.length
    ? await client
        .from("wallet_ledger")
        .select("id, player_id, counterparty_player_id, movement, amount, event_type, reason, created_at")
        .in("player_id", playerIds)
        .order("created_at", { ascending: false })
        .limit(160)
    : { data: [] as WalletLedgerRow[] };

  const ledgerByPlayer = new Map<string, WalletLedgerRow[]>();
  ((ledgerRaw as WalletLedgerRow[] | null) ?? []).forEach((entry) => {
    const list = ledgerByPlayer.get(entry.player_id) ?? [];
    list.push(entry);
    ledgerByPlayer.set(entry.player_id, list);
  });

  const knownPlayerNameMap = new Map(basePlayers.map((item) => [item.id, item.displayName]));
  const counterpartyIds = Array.from(
    new Set(
      ((ledgerRaw as WalletLedgerRow[] | null) ?? [])
        .map((entry) => entry.counterparty_player_id)
        .filter((id): id is string => id !== null)
        .filter((id) => !knownPlayerNameMap.has(id)),
    ),
  );

  const { data: counterpartyRows } = counterpartyIds.length
    ? await client.from("players").select("id, display_name").in("id", counterpartyIds)
    : { data: [] as PlayerNameRow[] };

  ((counterpartyRows as PlayerNameRow[] | null) ?? []).forEach((row) => {
    knownPlayerNameMap.set(row.id, row.display_name);
  });

  const players = basePlayers.map((player) => ({
    ...player,
    recentLedger: (ledgerByPlayer.get(player.id) ?? []).slice(0, 6),
    leaderboard: leaderboardByPlayer.get(player.id) ?? null,
  }));

  const accountName = account?.display_name ?? user.email ?? "玩家";
  const role = (account?.role ?? "user").toUpperCase();
  const totalBalance = players.reduce((sum, item) => sum + item.balance, 0);
  const totalLocked = players.reduce((sum, item) => sum + item.lockedBalance, 0);
  const totalWins = players.reduce((sum, item) => sum + (item.leaderboard?.wins ?? 0), 0);
  const totalMatches = players.reduce((sum, item) => sum + (item.leaderboard?.totalMatches ?? 0), 0);
  const activePlayer =
    players.find((item) => !item.isChild) ?? players[0] ?? null;
  const latestFamilyLedger = players
    .flatMap((item) => item.recentLedger)
    .toSorted((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, 6);
  const topOverall = overallLeaderboard.slice(0, 5);
  const topCrossFamily = crossFamilyLeaderboard.slice(0, 5);

  return (
    <div className="min-h-screen pb-24 safe-bottom-pad">
      <SiteNav />

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="panel-strong rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow text-amber-200">玩家中心</p>
              <h1 className="mt-2 font-display text-4xl tracking-[0.08em] text-white sm:text-5xl">
                戰士資料總覽
              </h1>
              <p className="mt-3 text-sm leading-7 text-white/68 sm:text-base">
                你好，{accountName}。目前角色權限：
                <span className="ml-2 rounded-full border border-white/18 px-2 py-1 text-xs tracking-[0.16em] text-cyan-100">
                  {role}
                </span>
              </p>
              {["GM", "ADMIN"].includes(role) ? (
                <p className="mt-2 text-xs text-amber-100/90">
                  你現在看到的是「玩家畫面」。若要進入 GM 補星，請到網址 <span className="font-semibold">/gm</span>。
                </p>
              ) : null}
            </div>

            <form action={logoutFromHubAction}>
              <button
                type="submit"
                className="rounded-full border border-white/14 px-5 py-2.5 text-sm tracking-[0.2em] text-white/82 transition hover:bg-white/8"
              >
                登出
              </button>
            </form>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <InfoBlock label="家庭玩家" value={`${players.length} 位`} />
            <InfoBlock label="可用星星" value={`${totalBalance} 顆`} />
            <InfoBlock label="鎖定星星" value={`${totalLocked} 顆`} />
            <InfoBlock label="總勝場" value={`${totalWins} 場`} />
            <InfoBlock label="總對戰" value={`${totalMatches} 場`} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <LinkChip href="/arena" label="進入約戰看板" tone="cyan" />
            <LinkChip href="/rankings" label="查看總排行榜" tone="amber" />
            <LinkChip href="/tournaments" label="查看賽事列表" tone="slate" />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <article className="panel rounded-[1.5rem] p-5 sm:p-6">
            <p className="eyebrow text-amber-200">玩家主戰卡</p>
            {activePlayer ? (
              <div className="mt-4 rounded-3xl border border-amber-300/20 bg-gradient-to-br from-amber-300/12 via-black/20 to-cyan-300/8 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs tracking-[0.22em] text-white/45">
                      {activePlayer.isChild ? "家庭成員角色" : "主帳號角色"}
                    </p>
                    <h2 className="mt-2 break-words font-display text-4xl tracking-[0.08em] text-white">
                      {activePlayer.displayName}
                    </h2>
                    <p className="mt-2 text-sm text-white/70">
                      稱號：{activePlayer.equippedTitle ?? "尚未佩戴"}
                    </p>
                  </div>
                  {activePlayer.leaderboard ? (
                    <span className="rounded-full border border-amber-300/35 bg-amber-300/14 px-3 py-1 text-xs tracking-[0.18em] text-amber-100">
                      全服 #{activePlayer.leaderboard.rank}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <MiniStat label="可用星星" value={`${activePlayer.balance}`} accent="text-amber-100" />
                  <MiniStat label="鎖定星星" value={`${activePlayer.lockedBalance}`} accent="text-cyan-100" />
                  <MiniStat
                    label="勝場"
                    value={`${activePlayer.leaderboard?.wins ?? 0}`}
                    accent="text-white"
                  />
                  <MiniStat
                    label="勝率"
                    value={formatWinRate(
                      activePlayer.leaderboard?.wins ?? 0,
                      activePlayer.leaderboard?.totalMatches ?? 0,
                    )}
                    accent="text-emerald-200"
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <LinkChip href="/arena" label="立即發起約戰" tone="amber" />
                  <LinkChip href="/rankings" label="查看全服排行" tone="cyan" />
                </div>
              </div>
            ) : (
              <p className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/65">
                尚未建立玩家，請先到下方建立第一位角色。
              </p>
            )}
          </article>

          <article className="panel rounded-[1.5rem] p-5 sm:p-6">
            <p className="eyebrow text-cyan-200">全服競技榜</p>
            <div className="mt-4 grid gap-3">
              <LeaderboardPreviewCard title="總榜 Top 5" rows={topOverall} tone="amber" />
              <LeaderboardPreviewCard title="跨家庭榜 Top 5" rows={topCrossFamily} tone="cyan" />
            </div>
          </article>
        </section>

        <section className="panel rounded-[1.5rem] p-5 sm:p-6">
          <p className="eyebrow text-white/60">戰鬥日誌</p>
          <h2 className="mt-2 font-display text-3xl tracking-[0.08em] text-white">家庭最近紀錄</h2>

          {latestFamilyLedger.length > 0 ? (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {latestFamilyLedger.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-white/55">
                    <p>{formatLedgerEvent(entry)}</p>
                    <p>
                      {new Date(entry.created_at).toLocaleString("zh-TW", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className={`text-base font-semibold ${getLedgerAmountClass(entry)}`}>
                      {formatLedgerAmount(entry)}
                    </p>
                    <p className="text-xs text-white/55">
                      {formatLedgerCounterparty(
                        entry,
                        entry.counterparty_player_id
                          ? knownPlayerNameMap.get(entry.counterparty_player_id) ?? null
                          : null,
                      )}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/65">
              目前尚無家庭帳本紀錄。
            </p>
          )}
        </section>

        <section className="panel rounded-[1.5rem] p-5 sm:p-6">
          <p className="eyebrow text-white/60">家庭玩家</p>
          <h2 className="mt-2 font-display text-3xl tracking-[0.08em] text-white">玩家檔案卡</h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {players.length > 0 ? (
              players.map((player) => (
                <article
                  key={player.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.24)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs tracking-[0.22em] text-white/45">
                        {player.isChild ? "小孩玩家" : "主要玩家"}
                      </p>
                      <p className="mt-2 font-display text-3xl tracking-[0.08em] text-white break-all">
                        {player.displayName}
                      </p>
                    </div>
                    {player.leaderboard ? (
                      <span className="rounded-full border border-amber-300/35 bg-amber-300/14 px-3 py-1 text-xs tracking-[0.16em] text-amber-100">
                        #{player.leaderboard.rank}
                      </span>
                    ) : null}
                  </div>
                  <dl className="mt-3 space-y-1 text-sm text-white/70">
                    <div className="flex items-center justify-between">
                      <dt>可用星星</dt>
                      <dd className="text-amber-100">{player.balance}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt>鎖定星星</dt>
                      <dd className="text-cyan-100">{player.lockedBalance}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt>戰績</dt>
                      <dd className="text-white/85">
                        {player.leaderboard
                          ? `${player.leaderboard.wins}W / ${player.leaderboard.losses}L`
                          : "尚無紀錄"}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-white/60">
                    稱號：{player.equippedTitle ?? "尚未佩戴"} / 已解鎖 {player.unlockedTitles.length}
                  </p>
                  <div className="mt-3 border-t border-white/8 pt-3">
                    <p className="text-xs tracking-[0.2em] text-white/45">近期帳本</p>
                    {player.recentLedger.length > 0 ? (
                      <ul className="mt-2 space-y-2">
                        {player.recentLedger.map((entry) => (
                          <li
                            key={entry.id}
                            className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-2 text-[11px] text-white/55">
                              <span>{formatLedgerEvent(entry)}</span>
                              <span>
                                {new Date(entry.created_at).toLocaleString("zh-TW", {
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <span className={`text-sm font-semibold ${getLedgerAmountClass(entry)}`}>
                                {formatLedgerAmount(entry)}
                              </span>
                              <span className="text-[11px] text-white/55">
                                {formatLedgerCounterparty(
                                  entry,
                                  entry.counterparty_player_id
                                    ? knownPlayerNameMap.get(entry.counterparty_player_id) ?? null
                                    : null,
                                )}
                              </span>
                            </div>
                            {entry.reason ? (
                              <p className="mt-1 line-clamp-2 text-[11px] text-white/45">{entry.reason}</p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-white/45">目前尚無帳本紀錄。</p>
                    )}
                  </div>
                  <div className="mt-3 border-t border-white/8 pt-3">
                    <PlayerQuickQr playerId={player.id} playerName={player.displayName} />
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-white/70">目前尚未建立任何玩家。</p>
            )}
          </div>
        </section>

        <HubControls players={players} />
      </main>
    </div>
  );
}

export default async function HubPage() {
  const config = getSupabaseConfig();
  if (!config.isReady || !config.isServiceReady) {
    return (
      <div className="min-h-screen pb-24 safe-bottom-pad">
        <SiteNav />
        <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <SupabaseSetupNotice
            title="玩家中心尚未就緒"
            description="玩家中心需要 Supabase 公開金鑰與 Service Role 金鑰，請在 Vercel 環境變數補齊後重新整理。"
            requireServiceRole
          />
        </main>
      </div>
    );
  }

  try {
    return await HubPageContent();
  } catch (error) {
    unstable_rethrow(error);
    const detail =
      error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
    return (
      <div className="min-h-screen pb-24 safe-bottom-pad">
        <SiteNav />
        <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <SupabaseSetupNotice
            title="玩家中心資料尚未完成初始化"
            description="目前可進入首頁，但玩家中心讀取失敗。請確認 Supabase migration 已完整執行，並檢查 Vercel Runtime Logs。"
            requireServiceRole
            debugMessage={detail}
          />
        </main>
      </div>
    );
  }
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3">
      <p className="text-xs tracking-[0.2em] text-white/45">{label}</p>
      <p className="mt-2 font-display text-3xl tracking-[0.08em] text-white">{value}</p>
    </article>
  );
}

function LinkChip({
  href,
  label,
  tone,
}: {
  href: string;
  label: string;
  tone: "amber" | "cyan" | "slate";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-300/35 bg-amber-300/14 text-amber-100 hover:bg-amber-300/22"
      : tone === "cyan"
        ? "border-cyan-300/35 bg-cyan-300/14 text-cyan-100 hover:bg-cyan-300/22"
        : "border-white/14 bg-white/[0.06] text-white/85 hover:bg-white/[0.12]";

  return (
    <Link
      href={href}
      className={`rounded-full border px-4 py-2 text-xs tracking-[0.16em] transition sm:text-sm sm:tracking-[0.2em] ${toneClass}`}
    >
      {label}
    </Link>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
      <p className="text-[11px] tracking-[0.2em] text-white/45">{label}</p>
      <p className={`mt-1 font-display text-2xl tracking-[0.06em] ${accent}`}>{value}</p>
    </div>
  );
}

function LeaderboardPreviewCard({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: {
    rank: number;
    points: number;
    wins: number;
    losses: number;
    player: { id: string; displayName: string };
  }[];
  tone: "amber" | "cyan";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
      : "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <p className={`inline-flex rounded-full border px-2.5 py-1 text-xs tracking-[0.2em] ${toneClass}`}>
        {title}
      </p>
      <div className="mt-3 space-y-2">
        {rows.length > 0 ? (
          rows.map((row) => (
            <div
              key={row.player.id}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
            >
              <p className="font-display text-2xl tracking-[0.06em] text-white/86">#{row.rank}</p>
              <p className="truncate text-sm text-white/82">{row.player.displayName}</p>
              <p className="text-xs tracking-[0.16em] text-white/55">
                {row.wins}W {row.losses}L / {row.points} 分
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/60">
            目前尚無可顯示的排名資料。
          </p>
        )}
      </div>
    </div>
  );
}

function formatWinRate(wins: number, totalMatches: number) {
  if (totalMatches <= 0) {
    return "--";
  }
  return `${Math.round((wins / totalMatches) * 100)}%`;
}
