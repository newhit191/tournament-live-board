import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArenaDetailControls } from "@/app/arena/[id]/arena-detail-controls";
import { SiteNav } from "@/components/site-nav";
import { loadAccountRole, loadArenaChallengeDetail, loadPlayersByOwner } from "@/lib/arena-service";
import type { ArenaParticipantResult, ChallengeCompetitionFormat } from "@/lib/arena-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ArenaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect(`/auth?next=${encodeURIComponent(`/arena/${id}`)}`);
  }
  const [challenge, ownPlayers, role] = await Promise.all([
    loadArenaChallengeDetail(id),
    loadPlayersByOwner(user.id),
    loadAccountRole(user.id),
  ]);

  if (!challenge) {
    notFound();
  }

  const canManage = challenge.createdByAccountId === user.id || role === "gm" || role === "admin";
  const viewerJoinedPlayerIds = challenge.participants
    .filter((participant) => participant.player?.ownerAccountId === user.id)
    .map((participant) => participant.playerId);

  const firstMatch = challenge.matches[0];
  const modeLabel = challenge.mode === "single_stake" ? "單場對賭" : "多人獎池";
  const formatLabel = formatCompetitionFormat(challenge.competitionFormat);

  return (
    <div className="min-h-screen pb-24 safe-bottom-pad">
      <SiteNav />

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="panel-strong rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-amber-200">
                {modeLabel} / {formatLabel}
              </p>
              <h1 className="mt-2 font-display text-4xl tracking-[0.08em] text-white sm:text-5xl">
                {challenge.title}
              </h1>
              <p className="mt-3 text-sm text-white/68">
                狀態：{formatChallengeStatus(challenge.status)} / 參賽：{challenge.participants.length}/
                {challenge.participantLimit}
              </p>
            </div>
            <Link
              href="/arena"
              className="rounded-full border border-white/14 px-4 py-2 text-sm tracking-[0.2em] text-white/80 transition hover:bg-white/8"
            >
              返回約戰中心
            </Link>
          </div>

          <div className="mt-5 grid gap-3 text-sm text-white/70 sm:grid-cols-3">
            <InfoCard label="城市" value={challenge.city || "未指定"} />
            <InfoCard label="場地" value={challenge.venue || "未指定"} />
            <InfoCard
              label="開始時間"
              value={challenge.startsAt ? new Date(challenge.startsAt).toLocaleString("zh-TW") : "未設定"}
            />
          </div>

          {challenge.description ? (
            <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-7 text-white/75">
              {challenge.description}
            </p>
          ) : null}
        </section>

        <section className="panel rounded-[1.5rem] p-5 sm:p-6">
          <p className="eyebrow text-cyan-200">參賽玩家</p>
          <h2 className="mt-2 font-display text-3xl tracking-[0.08em] text-white">目前名單</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {challenge.participants.map((participant) => (
              <article
                key={participant.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
              >
                <p className="text-xs tracking-[0.2em] text-white/45">
                  {participant.isHost ? "主辦玩家" : "參賽玩家"}
                </p>
                <p className="mt-2 font-display text-3xl tracking-[0.08em] text-white">
                  {participant.player?.displayName ?? "未知玩家"}
                </p>
                <p className="mt-2 text-sm text-white/68">
                  鎖定：{participant.lockedAmount} / 結果：{formatParticipantResult(participant.result)}
                  {getVisibleFinalRank(participant.finalRank)
                    ? ` / 名次：${getVisibleFinalRank(participant.finalRank)}`
                    : ""}
                </p>
              </article>
            ))}
            {challenge.participants.length === 0 ? (
              <p className="text-sm text-white/65">目前尚無參賽玩家。</p>
            ) : null}
          </div>
        </section>

        {firstMatch ? (
          <section className="panel rounded-[1.5rem] p-5">
            <p className="eyebrow text-amber-200">首場資訊</p>
            <h2 className="mt-2 font-display text-3xl tracking-[0.08em] text-white">預設首戰</h2>
            <p className="mt-3 text-base text-white/78">
              {challenge.participants.find((item) => item.playerId === firstMatch.playerAId)?.player
                ?.displayName ?? "玩家 A"}{" "}
              vs{" "}
              {challenge.participants.find((item) => item.playerId === firstMatch.playerBId)?.player
                ?.displayName ?? "玩家 B"}
            </p>
            <p className="mt-2 text-sm text-white/66">
              狀態：{firstMatch.status}
              {firstMatch.winnerPlayerId
                ? ` / 勝者：${
                    challenge.participants.find(
                      (item) => item.playerId === firstMatch.winnerPlayerId,
                    )?.player?.displayName ?? "未知"
                  }`
                : ""}
            </p>
          </section>
        ) : null}

        <ArenaDetailControls
          challenge={challenge}
          ownPlayers={ownPlayers}
          canManage={canManage}
          viewerJoinedPlayerIds={viewerJoinedPlayerIds}
        />
      </main>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="text-xs tracking-[0.22em] text-white/45">{label}</p>
      <p className="mt-2 text-sm text-white/85">{value}</p>
    </div>
  );
}

function getVisibleFinalRank(finalRank: number | null) {
  if (!finalRank || finalRank >= 900) {
    return null;
  }
  return finalRank;
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

function formatParticipantResult(result: ArenaParticipantResult) {
  switch (result) {
    case "pending":
      return "待結算";
    case "winner":
      return "勝者";
    case "loser":
      return "敗者";
    case "rank_1":
      return "第 1 名";
    case "rank_2":
      return "第 2 名";
    case "rank_3":
      return "第 3 名";
    case "rank_other":
      return "未進前三";
    case "cancelled":
      return "已取消";
    default:
      return result;
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
