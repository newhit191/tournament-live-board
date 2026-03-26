import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addMatchSetAction,
  adjustSetScoreAction,
  overrideMatchTotalAction,
  setCurrentMatchAction,
  setSetScoreAction,
} from "@/app/admin/actions";
import { PlayerAvatar } from "@/components/player-avatar";
import { formatDateTime, getStatusClasses } from "@/lib/formatters";
import { formatMatchState, formatScoringRule } from "@/lib/tournament-labels";
import { getTournamentById } from "@/lib/tournament-service";

type AdminMatchPageProps = {
  params: Promise<{ id: string; matchId: string }>;
};

export default async function AdminMatchControlPage({
  params,
}: AdminMatchPageProps) {
  const { id, matchId } = await params;
  const tournament = await getTournamentById(id);

  if (!tournament) {
    notFound();
  }

  const match = tournament.matches.find((entry) => entry.id === matchId);

  if (!match) {
    notFound();
  }

  const isTargetMode = tournament.scoringMode === "target_score";
  const isCompleted = match.state === "completed";
  const disableSetEditing = isTargetMode && isCompleted;
  const orderedMatches = [...tournament.matches].sort(
    (left, right) =>
      left.roundOrder - right.roundOrder || left.matchOrder - right.matchOrder,
  );
  const currentIndex = orderedMatches.findIndex((entry) => entry.id === match.id);
  const nextMatch =
    orderedMatches
      .slice(currentIndex + 1)
      .find(
        (entry) =>
          entry.state !== "completed" &&
          !entry.player1.id.startsWith("pending:") &&
          !entry.player2.id.startsWith("pending:"),
      ) ??
    orderedMatches
      .slice(currentIndex + 1)
      .find((entry) => entry.state !== "completed") ??
    null;
  const isCurrentShowcase = tournament.currentMatch?.id === match.id;

  return (
    <>
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow text-amber-200">比分管理</p>
          <h2 className="mt-3 break-words font-display text-3xl tracking-[0.06em] text-white sm:text-4xl lg:text-5xl">
            {match.player1.displayName}
            <span className="mx-3 text-white/25">vs</span>
            {match.player2.displayName}
          </h2>
          <p className="mt-3 text-sm tracking-[0.24em] text-white/42">
            {match.roundName} / {match.scheduledLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form action={setCurrentMatchAction}>
            <input type="hidden" name="tournamentId" value={tournament.id} />
            <input type="hidden" name="matchId" value={match.id} />
            <input
              type="hidden"
              name="redirectTo"
              value={`/admin/tournaments/${tournament.id}/matches/${match.id}`}
            />
            <button
              type="submit"
              disabled={isCurrentShowcase}
              className="rounded-full border border-amber-300/30 bg-amber-300/14 px-4 py-2 text-xs tracking-[0.22em] text-amber-100 transition hover:bg-amber-300/22 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isCurrentShowcase ? "目前公開展示中" : "設為公開展示"}
            </button>
          </form>

          {nextMatch ? (
            <Link
              href={`/admin/tournaments/${tournament.id}/matches/${nextMatch.id}`}
              className="rounded-full border border-white/14 px-4 py-2 text-xs tracking-[0.22em] text-white/76 transition hover:bg-white/8"
            >
              前往下一場
            </Link>
          ) : null}

          <Link
            href={`/tournaments/${tournament.slug}/matches/${match.id}`}
            className="rounded-full border border-white/14 px-4 py-2 text-xs tracking-[0.24em] text-white/76 transition hover:bg-white/8"
          >
            查看公開詳情頁
          </Link>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel-strong rounded-[2rem] px-6 py-8">
          <div className="flex items-center justify-between">
            <p className="eyebrow text-cyan-200">目前狀態</p>
            <span
              className={`rounded-full border px-4 py-2 text-xs tracking-[0.24em] ${getStatusClasses(
                match.state,
              )}`}
            >
              {formatMatchState(match.state)}
            </span>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_auto_1fr] xl:items-center">
            <ScoreCard name={match.player1.displayName} score={match.player1Total} />
            <div className="text-center font-display text-4xl tracking-[0.2em] text-white/24 sm:text-5xl">
              VS
            </div>
            <ScoreCard name={match.player2.displayName} score={match.player2Total} />
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-7 text-white/72">
            {formatScoringRule(tournament)}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="eyebrow text-white/55">
              {isTargetMode ? "逐局記錄（目標分制）" : "逐局記錄（分局加總制）"}
            </p>
            {isTargetMode ? (
              <form action={addMatchSetAction}>
                <input type="hidden" name="tournamentId" value={tournament.id} />
                <input type="hidden" name="matchId" value={match.id} />
                <button
                  type="submit"
                  disabled={isCompleted}
                  className="rounded-full border border-white/12 px-4 py-2 text-xs tracking-[0.22em] text-white/78 transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  新增一局
                </button>
              </form>
            ) : null}
          </div>

          <div className="mt-4 space-y-4">
            {match.sets.map((set) => (
              <div
                key={set.id}
                className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-display text-3xl tracking-[0.08em] text-white">
                    第 {set.setNo} 局
                  </p>
                  <p className="text-xs tracking-[0.22em] text-white/42">
                    更新於 {formatDateTime(set.updatedAt)}
                  </p>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <SetQuickPanel
                    tournamentId={tournament.id}
                    matchId={match.id}
                    setId={set.id}
                    side="player1"
                    label={match.player1.displayName}
                    score={set.player1Score}
                    disabled={disableSetEditing}
                  />
                  <SetQuickPanel
                    tournamentId={tournament.id}
                    matchId={match.id}
                    setId={set.id}
                    side="player2"
                    label={match.player2.displayName}
                    score={set.player2Score}
                    disabled={disableSetEditing}
                  />
                </div>

                <form
                  action={setSetScoreAction}
                  className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]"
                >
                  <input type="hidden" name="tournamentId" value={tournament.id} />
                  <input type="hidden" name="matchId" value={match.id} />
                  <input type="hidden" name="setId" value={set.id} />
                  <label className="text-xs tracking-[0.22em] text-white/45">
                    {match.player1.displayName}
                    <input
                      type="number"
                      name="player1Score"
                      min="0"
                      defaultValue={set.player1Score}
                      disabled={disableSetEditing}
                      className="mt-2 w-full rounded-3xl border border-white/12 bg-white/[0.05] px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </label>
                  <label className="text-xs tracking-[0.22em] text-white/45">
                    {match.player2.displayName}
                    <input
                      type="number"
                      name="player2Score"
                      min="0"
                      defaultValue={set.player2Score}
                      disabled={disableSetEditing}
                      className="mt-2 w-full rounded-3xl border border-white/12 bg-white/[0.05] px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={disableSetEditing}
                    className="self-end rounded-full border border-white/12 px-4 py-3 text-sm tracking-[0.22em] text-white/78 transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    儲存本局
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel rounded-[1.75rem] p-6">
            <p className="eyebrow text-white/55">操作提醒</p>
            <div className="mt-5 space-y-3 text-sm leading-7 text-white/72">
              {isTargetMode
                ? [
                    "目標分制下，任一方達到或超過目標分數時會自動完賽。",
                    "可使用 +1、+2、+3 或自訂增減值快速調整。",
                    "完賽後快捷鍵會停用，如需修正可直接覆蓋最終總分。",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3"
                    >
                      {item}
                    </div>
                  ))
                : [
                    "分局加總制會以固定局數進行，完成所有局後再結算勝負。",
                    "每局都能 +1、+2、+3、-1，也可直接輸入該局最終比分。",
                    "全部局數完成且總分不同時，系統會自動更新為已結束。",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3"
                    >
                      {item}
                    </div>
                  ))}
            </div>
          </div>

          <div className="panel rounded-[1.75rem] p-6">
            <p className="eyebrow text-white/55">直接輸入最終比分</p>
            <form action={overrideMatchTotalAction} className="mt-5 grid gap-3">
              <input type="hidden" name="tournamentId" value={tournament.id} />
              <input type="hidden" name="matchId" value={match.id} />
              <label className="text-xs tracking-[0.22em] text-white/45">
                {match.player1.displayName}
                <input
                  type="number"
                  name="player1Total"
                  min="0"
                  defaultValue={match.player1Total}
                  className="mt-2 w-full rounded-3xl border border-white/12 bg-white/[0.05] px-4 py-4 text-white outline-none"
                />
              </label>

              <label className="text-xs tracking-[0.22em] text-white/45">
                {match.player2.displayName}
                <input
                  type="number"
                  name="player2Total"
                  min="0"
                  defaultValue={match.player2Total}
                  className="mt-2 w-full rounded-3xl border border-white/12 bg-white/[0.05] px-4 py-4 text-white outline-none"
                />
              </label>

              <button
                type="submit"
                className="rounded-full border border-amber-300/30 bg-amber-300/14 px-5 py-4 text-sm tracking-[0.28em] text-amber-100"
              >
                覆蓋最終比分
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}

function ScoreCard({
  name,
  score,
}: {
  name: string;
  score: number;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 text-center">
      <div className="flex items-center justify-center">
        <PlayerAvatar name={name} />
      </div>
      <p className="mt-2 truncate text-sm tracking-[0.22em] text-white/45">{name}</p>
      <p className="mt-3 font-display text-5xl tracking-[0.08em] text-white sm:text-6xl">
        {score}
      </p>
    </div>
  );
}

function SetQuickPanel({
  tournamentId,
  matchId,
  setId,
  side,
  label,
  score,
  disabled,
}: {
  tournamentId: string;
  matchId: string;
  setId: string;
  side: "player1" | "player2";
  label: string;
  score: number;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs tracking-[0.22em] text-white/45">{label}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-4xl tracking-[0.08em] text-white sm:text-5xl">
          {score}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {[-1, 1, 2, 3].map((delta) => (
            <form key={delta} action={adjustSetScoreAction}>
              <input type="hidden" name="tournamentId" value={tournamentId} />
              <input type="hidden" name="matchId" value={matchId} />
              <input type="hidden" name="setId" value={setId} />
              <input type="hidden" name="side" value={side} />
              <input type="hidden" name="delta" value={delta} />
              <button
                disabled={disabled}
                className="rounded-full border border-white/12 px-3 py-2 text-xs tracking-[0.2em] text-white/72 transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
