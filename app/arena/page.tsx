import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";

import { ArenaCreateForm } from "@/app/arena/arena-create-form";
import { SiteNav } from "@/components/site-nav";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import {
  loadArenaChallenges,
  loadArenaPlayerById,
  loadPlayersByOwner,
} from "@/lib/arena-service";
import type { ChallengeCompetitionFormat } from "@/lib/arena-types";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "約戰看板",
};

async function ArenaPageContent({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    hostPlayerId?: string;
    duelPlayerId?: string;
  }>;
}) {
  const query = await searchParams;
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    const nextQuery = new URLSearchParams();
    if (query.mode) nextQuery.set("mode", query.mode);
    if (query.hostPlayerId) nextQuery.set("hostPlayerId", query.hostPlayerId);
    if (query.duelPlayerId) nextQuery.set("duelPlayerId", query.duelPlayerId);
    const nextPath = nextQuery.size > 0 ? `/arena?${nextQuery.toString()}` : "/arena";
    redirect(`/auth?next=${encodeURIComponent(nextPath)}`);
  }

  const [players, challenges, duelPlayer] = await Promise.all([
    loadPlayersByOwner(user.id),
    loadArenaChallenges(),
    query.duelPlayerId ? loadArenaPlayerById(query.duelPlayerId) : Promise.resolve(null),
  ]);
  const initialMode = query.mode === "prize_pool" ? "prize_pool" : "single_stake";
  const initialHostPlayerId = query.hostPlayerId;
  const duelRequestedButMissing = Boolean(query.duelPlayerId) && !duelPlayer;

  const openList = challenges.filter((item) => item.status === "open");
  const runningList = challenges.filter((item) => item.status === "in_progress");
  const doneList = challenges.filter((item) => item.status === "completed");

  return (
    <div className="min-h-screen pb-24 safe-bottom-pad">
      <SiteNav />

      <main className="mx-auto flex max-w-7xl min-w-0 flex-col gap-6 overflow-x-hidden px-4 py-8 sm:px-6 lg:px-8">
        <section className="panel-strong rounded-[2rem] p-6 sm:p-8">
          <p className="eyebrow text-amber-200">戰鬥任務看板</p>
          <h1 className="mt-2 break-words font-display text-[clamp(2rem,6.4vw,4rem)] tracking-[0.06em] text-white">
            即時約戰與賽務控制
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70 sm:text-base">
            這裡是玩家日常開戰入口。你可以發起單場對賭、多人獎池賽，或透過 QR
            快速挑戰直接帶入對手。主辦方在賽事詳情頁可負責比分登記與完賽結算。
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <StatCard label="開放報名" value={`${openList.length} 場`} />
            <StatCard label="進行中" value={`${runningList.length} 場`} />
            <StatCard label="已完賽" value={`${doneList.length} 場`} />
          </div>

          {duelPlayer ? (
            <div className="mt-4 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">
              已啟用 QR 快速流程：本次會指定對手
              <span className="ml-1 font-semibold">{duelPlayer.displayName}</span>。
            </div>
          ) : null}

          {duelRequestedButMissing ? (
            <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/12 px-4 py-3 text-sm text-amber-100">
              這個 QR 連結中的玩家可能已停用或不存在。你仍可手動建立約戰，或請對方重新產生 QR。
            </div>
          ) : null}
        </section>

        <ArenaCreateForm
          players={players}
          initialMode={initialMode}
          initialHostPlayerId={initialHostPlayerId}
          initialDuelPlayer={duelPlayer ? { id: duelPlayer.id, displayName: duelPlayer.displayName } : null}
        />

        <section className="grid gap-4 xl:grid-cols-2">
          <ChallengePanel title="開放報名中的戰局" challenges={openList} emptyText="目前沒有開放報名的約戰。" />
          <ChallengePanel title="正在進行中的戰局" challenges={runningList} emptyText="目前沒有進行中的對戰。" />
        </section>

        <section className="panel rounded-[1.75rem] p-5 sm:p-6">
          <p className="eyebrow text-white/60">歷史紀錄</p>
          <h2 className="mt-2 font-display text-3xl tracking-[0.08em] text-white">最近完賽</h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {doneList.slice(0, 10).map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
            {doneList.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65">
                目前還沒有完賽紀錄。
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

export default async function ArenaPage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    hostPlayerId?: string;
    duelPlayerId?: string;
  }>;
}) {
  const config = getSupabaseConfig();
  if (!config.isReady || !config.isServiceReady) {
    return (
      <div className="min-h-screen pb-24 safe-bottom-pad">
        <SiteNav />
        <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <SupabaseSetupNotice
            title="約戰系統尚未就緒"
            description="約戰頁需要 Supabase 公開金鑰與 Service Role 金鑰，請先在 Vercel 補齊環境變數。"
            requireServiceRole
          />
        </main>
      </div>
    );
  }

  try {
    return await ArenaPageContent({ searchParams });
  } catch (error) {
    unstable_rethrow(error);
    const detail =
      error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
    return (
      <div className="min-h-screen pb-24 safe-bottom-pad">
        <SiteNav />
        <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <SupabaseSetupNotice
            title="約戰資料載入失敗"
            description="請確認 Supabase migration 已完成，並檢查 Vercel Runtime Logs 的第一個錯誤。"
            requireServiceRole
            debugMessage={detail}
          />
        </main>
      </div>
    );
  }
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3">
      <p className="text-xs tracking-[0.22em] text-white/45">{label}</p>
      <p className="mt-2 font-display text-3xl tracking-[0.08em] text-white">{value}</p>
    </article>
  );
}

function ChallengePanel({
  title,
  challenges,
  emptyText,
}: {
  title: string;
  challenges: Awaited<ReturnType<typeof loadArenaChallenges>>;
  emptyText: string;
}) {
  return (
    <section className="panel rounded-[1.5rem] p-5">
      <p className="eyebrow text-cyan-200">{title}</p>
      <div className="mt-4 grid gap-3">
        {challenges.length > 0 ? (
          challenges.slice(0, 12).map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} />
          ))
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65">
            {emptyText}
          </div>
        )}
      </div>
    </section>
  );
}

function ChallengeCard({
  challenge,
}: {
  challenge: Awaited<ReturnType<typeof loadArenaChallenges>>[number];
}) {
  const modeLabel = challenge.mode === "single_stake" ? "單場對賭" : "多人獎池";
  const formatLabel = formatCompetitionFormat(challenge.competitionFormat);
  const participantText = `${challenge.participants.length}/${challenge.participantLimit} 人`;
  const firstMatch = challenge.matches[0];
  const winner = challenge.participants.find(
    (item) => item.result === "winner" || item.result === "rank_1",
  );

  return (
    <Link
      href={`/arena/${challenge.id}`}
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.08]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs tracking-[0.2em] text-white/45">
            {modeLabel} / {formatLabel}
          </p>
          <h3 className="mt-2 break-words font-display text-3xl tracking-[0.08em] text-white">
            {challenge.title}
          </h3>
        </div>
        <span className="shrink-0 rounded-full border border-amber-300/35 bg-amber-300/14 px-3 py-1 text-xs tracking-[0.16em] text-amber-100">
          {formatChallengeStatus(challenge.status)}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-white/68 sm:grid-cols-2">
        <p>參賽：{participantText}</p>
        <p>{challenge.city || "未指定城市"}</p>
        {challenge.mode === "single_stake" ? (
          <p>
            總押注：
            {challenge.participants.reduce((sum, item) => sum + item.lockedAmount, 0)} 顆
          </p>
        ) : (
          <p>
            獎池：{challenge.participantLimit * challenge.entryFee} 顆 / 每人 {challenge.entryFee} 顆
          </p>
        )}
        <p>
          開始：
          {challenge.startsAt ? new Date(challenge.startsAt).toLocaleString("zh-TW") : "未設定"}
        </p>
      </div>

      {firstMatch ? (
        <p className="mt-3 text-sm text-white/78">
          首戰：{challenge.participants.find((item) => item.playerId === firstMatch.playerAId)?.player?.displayName ?? "玩家 A"} vs{" "}
          {challenge.participants.find((item) => item.playerId === firstMatch.playerBId)?.player?.displayName ?? "玩家 B"}
        </p>
      ) : null}

      {winner ? (
        <p className="mt-3 text-sm text-amber-100">勝者：{winner.player?.displayName ?? "未指定"}</p>
      ) : null}
    </Link>
  );
}

function formatChallengeStatus(status: "open" | "in_progress" | "completed" | "cancelled") {
  switch (status) {
    case "open":
      return "開放中";
    case "in_progress":
      return "進行中";
    case "completed":
      return "已完成";
    case "cancelled":
      return "已取消";
    default:
      return status;
  }
}

function formatCompetitionFormat(format: ChallengeCompetitionFormat) {
  switch (format) {
    case "single_match":
      return "單場";
    case "manual_pool":
      return "手動名次";
    case "single_elimination":
      return "單淘汰";
    case "double_elimination":
      return "雙敗淘汰";
    case "round_robin":
      return "循環賽";
    default:
      return format;
  }
}
