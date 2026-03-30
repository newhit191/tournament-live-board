import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { DisplayAutoRefresh } from "@/components/display-auto-refresh";
import { MatchTransitionShell } from "@/components/match-transition-shell";
import { PlayerAvatar } from "@/components/player-avatar";
import { TournamentStructure } from "@/components/tournament-structure";
import { formatDateTime, getStatusClasses } from "@/lib/formatters";
import { formatScoringRule, formatTournamentStatus } from "@/lib/tournament-labels";
import { getTournamentBySlug } from "@/lib/tournament-service";

type DisplayPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function TournamentDisplayPage({ params }: DisplayPageProps) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);

  if (!tournament) {
    notFound();
  }

  const currentMatch = tournament.currentMatch;

  if (!currentMatch) {
    return (
      <div className="min-h-screen px-3 py-4 sm:px-6 lg:px-8">
        <DisplayAutoRefresh intervalMs={3000} />
        <main className="mx-auto flex w-full max-w-[1700px] flex-col gap-4">
          <section className="panel-strong rounded-[2rem] px-5 py-6 sm:px-7">
            <p className="eyebrow text-amber-200">賽事大螢幕展示</p>
            <h1 className="mt-3 font-display text-3xl tracking-[0.06em] text-white sm:text-5xl">
              目前尚無可展示場次
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70 sm:text-base">
              請到主辦方後台建立賽事，並指定目前進行中的場次。
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full border px-4 py-2 text-xs tracking-[0.24em] ${getStatusClasses(
                  tournament.status,
                )}`}
              >
                {formatTournamentStatus(tournament.status)}
              </span>
              <Link
                href={`/tournaments/${tournament.slug}`}
                className="rounded-full border border-white/14 px-4 py-2 text-xs tracking-[0.24em] text-white/76 transition hover:bg-white/8"
              >
                返回賽事頁
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const winnerId = currentMatch.state === "completed" ? currentMatch.winnerId : null;
  const nextMatch =
    tournament.matches.find(
      (match) =>
        match.id !== currentMatch.id &&
        match.state === "scheduled" &&
        !match.player1.id.startsWith("pending:") &&
        !match.player2.id.startsWith("pending:"),
    ) ??
    tournament.matches.find(
      (match) => match.id !== currentMatch.id && match.state === "scheduled",
    ) ??
    null;

  const completedMatchesByStage = tournament.matches
    .filter(
      (match) =>
        match.state === "completed" &&
        !match.player1.id.startsWith("bye:") &&
        !match.player2.id.startsWith("bye:"),
    )
    .toSorted(
      (left, right) =>
        right.roundOrder - left.roundOrder ||
        right.matchOrder - left.matchOrder ||
        right.updatedAt.localeCompare(left.updatedAt),
    );

  const latestCompletedMatch =
    completedMatchesByStage.find((match) => match.id !== currentMatch.id) ?? null;
  const recentResults = completedMatchesByStage.slice(0, 4);
  let latestWinnerName: string | null = null;

  if (latestCompletedMatch) {
    if (latestCompletedMatch.winnerId === latestCompletedMatch.player1.id) {
      latestWinnerName = latestCompletedMatch.player1.displayName;
    } else if (latestCompletedMatch.winnerId === latestCompletedMatch.player2.id) {
      latestWinnerName = latestCompletedMatch.player2.displayName;
    }
  }

  return (
    <div className="min-h-screen px-3 py-4 sm:px-6 lg:px-8">
      <DisplayAutoRefresh intervalMs={5000} />

      <main className="mx-auto flex w-full max-w-[1700px] min-w-0 flex-col gap-4 overflow-x-hidden">
        <section className="panel-strong rounded-[2rem] px-5 py-6 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow text-cyan-200">{tournament.heroKicker}</p>
              <h1 className="mt-2 break-words font-display text-[clamp(2rem,6vw,4rem)] tracking-[0.06em] text-white">
                {tournament.name}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full border px-4 py-2 text-xs tracking-[0.24em] ${getStatusClasses(
                  tournament.status,
                )}`}
              >
                {formatTournamentStatus(tournament.status)}
              </span>
              <Link
                href={`/tournaments/${tournament.slug}`}
                className="rounded-full border border-white/14 px-4 py-2 text-xs tracking-[0.24em] text-white/76 transition hover:bg-white/8"
              >
                返回賽事頁
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <TopInfoCard title="下一場預告">
              {nextMatch ? (
                <>
                  <p className="text-xs tracking-[0.22em] text-white/45">
                    {nextMatch.roundName} / {nextMatch.scheduledLabel}
                  </p>
                  <p className="mt-2 truncate font-display text-2xl tracking-[0.05em] text-white">
                    {nextMatch.player1.displayName}
                    <span className="mx-2 text-white/25">vs</span>
                    {nextMatch.player2.displayName}
                  </p>
                </>
              ) : (
                <p className="text-sm text-white/70">目前沒有可預告的下一場。</p>
              )}
            </TopInfoCard>

            <TopInfoCard title="最新完賽結果">
              {recentResults[0] ? (
                <>
                  <p className="text-xs tracking-[0.22em] text-white/45">
                    {recentResults[0].roundName}
                  </p>
                  <p className="mt-2 truncate font-display text-xl tracking-[0.05em] text-white">
                    {recentResults[0].player1.displayName}
                    <span className="mx-2 text-white/25">vs</span>
                    {recentResults[0].player2.displayName}
                  </p>
                  <p className="mt-2 font-display text-2xl tracking-[0.08em] text-amber-200">
                    {recentResults[0].player1Total}
                    <span className="mx-2 text-white/30">:</span>
                    {recentResults[0].player2Total}
                  </p>
                </>
              ) : (
                <p className="text-sm text-white/70">尚未有完賽結果。</p>
              )}
            </TopInfoCard>

            <TopInfoCard title="賽事統計">
              <div className="grid grid-cols-3 gap-2">
                <StatCell label="場地" value={tournament.venue} />
                <StatCell label="完賽場次" value={String(tournament.stats.completedMatches)} />
                <StatCell label="參賽人數" value={String(tournament.stats.playerCount)} />
              </div>
            </TopInfoCard>
          </div>
        </section>

        <section className="panel-strong score-rim scan-highlight rounded-[2rem] px-5 py-6 sm:px-7">
          <MatchTransitionShell key={currentMatch.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="eyebrow text-amber-200">目前賽事 LIVE</p>
                <h2 className="mt-2 font-display text-[clamp(1.8rem,4.5vw,3.2rem)] tracking-[0.06em] text-white">
                  {currentMatch.roundName}
                </h2>
                <p className="mt-2 text-xs tracking-[0.24em] text-white/42">
                  {currentMatch.scheduledLabel}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="live-pulse inline-flex h-4 w-4 rounded-full border border-amber-200/50 bg-amber-200" />
                <p className="text-xs tracking-[0.24em] text-white/42">
                  更新於 {formatDateTime(currentMatch.updatedAt)}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/72">
              {formatScoringRule(tournament)}
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:items-center">
              <ScorePanel
                sideLabel="選手 1"
                name={currentMatch.player1.displayName}
                score={currentMatch.player1Total}
                accentClass="text-amber-200"
                isWinner={winnerId === currentMatch.player1.id}
              />

              <div className="text-center">
                <p className="font-display text-4xl tracking-[0.3em] text-white/25 sm:text-5xl">
                  VS
                </p>
              </div>

              <ScorePanel
                sideLabel="選手 2"
                name={currentMatch.player2.displayName}
                score={currentMatch.player2Total}
                accentClass="text-cyan-200"
                isWinner={winnerId === currentMatch.player2.id}
              />
            </div>

            {tournament.scoringMode === "set_total" || currentMatch.sets.length > 1 ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {currentMatch.sets.map((set) => (
                  <div
                    key={set.id}
                    className="rounded-3xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <p className="text-xs tracking-[0.22em] text-white/42">第 {set.setNo} 局</p>
                    <p className="mt-2 font-display text-3xl tracking-[0.08em] text-white">
                      {set.player1Score}
                      <span className="mx-2 text-white/30">:</span>
                      {set.player2Score}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {latestCompletedMatch && latestWinnerName ? (
              <div className="winner-result-banner mt-6 rounded-2xl border border-amber-300/35 px-4 py-3">
                <p className="text-xs tracking-[0.24em] text-amber-100/85">
                  上一場完賽勝者
                </p>
                <p className="mt-1 font-display text-2xl tracking-[0.06em] text-amber-100">
                  WINNER ・ {latestWinnerName}
                </p>
                <p className="mt-1 text-xs text-white/55">
                  {latestCompletedMatch.roundName} / {latestCompletedMatch.scheduledLabel}
                </p>
              </div>
            ) : null}
          </MatchTransitionShell>
        </section>

        <section className="panel min-w-0 rounded-[1.75rem] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="eyebrow text-white/55">
                {tournament.format === "single_elimination"
                  ? "單淘汰賽程圖"
                  : tournament.format === "double_elimination"
                    ? "雙敗淘汰賽程圖"
                    : "循環賽賽程圖"}
              </p>
              <h3 className="mt-2 font-display text-3xl tracking-[0.08em] text-white sm:text-4xl">
                賽程與目前進度
              </h3>
            </div>
            <span className="text-xs tracking-[0.22em] text-white/42">每 5 秒自動更新</span>
          </div>

          <div className="mt-5 min-w-0 overflow-x-auto pb-2 bracket-stage">
            <TournamentStructure
              tournament={tournament}
              compact
              detailBasePath={`/tournaments/${tournament.slug}/matches`}
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="panel rounded-[1.5rem] p-5">
            <p className="eyebrow text-cyan-200">最新完賽結果</p>
            <div className="mt-4 space-y-3">
              {recentResults.length > 0 ? (
                recentResults.map((match) => (
                  <div
                    key={match.id}
                    className="rounded-3xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <p className="text-xs tracking-[0.22em] text-white/45">
                      {match.roundName}
                    </p>
                    <p className="mt-2 truncate font-display text-xl tracking-[0.05em] text-white">
                      {match.player1.displayName}
                      <span className="mx-2 text-white/25">vs</span>
                      {match.player2.displayName}
                    </p>
                    <p className="mt-2 font-display text-2xl tracking-[0.08em] text-amber-200">
                      {match.player1Total}
                      <span className="mx-2 text-white/30">:</span>
                      {match.player2Total}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                  尚未有完賽場次。
                </p>
              )}
            </div>
          </div>

          <div className="panel rounded-[1.5rem] p-5">
            <p className="eyebrow text-amber-200">賽事統計</p>
            <p className="mt-3 rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-7 text-white/72">
              {formatScoringRule(tournament)}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <StatCard label="總場次" value={String(tournament.stats.totalMatches)} />
              <StatCard label="進行中場次" value={String(tournament.stats.liveMatches)} />
              <StatCard label="已完賽場次" value={String(tournament.stats.completedMatches)} />
              <StatCard label="參賽人數" value={String(tournament.stats.playerCount)} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function ScorePanel({
  sideLabel,
  name,
  score,
  accentClass,
  isWinner,
}: {
  sideLabel: string;
  name: string;
  score: number;
  accentClass: string;
  isWinner: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-4 text-center sm:p-5 ${
        isWinner ? "winner-spotlight" : ""
      }`}
    >
      <p className="text-sm tracking-[0.24em] text-white/45">
        {sideLabel}
        {isWinner ? " ・ WINNER" : ""}
      </p>
      <div className="mt-3 flex items-center justify-center">
        <PlayerAvatar name={name} sizeClassName="h-14 w-14" />
      </div>
      <h3 className="mt-2 break-words font-display text-[clamp(1.8rem,3vw,3rem)] leading-tight tracking-[0.06em] text-white">
        {name}
      </h3>
      <p
        className={`score-glow mt-3 font-display text-[clamp(3.3rem,7vw,6.5rem)] leading-none tracking-[0.1em] ${accentClass}`}
      >
        {score}
      </p>
    </div>
  );
}

function TopInfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs tracking-[0.24em] text-white/45">{title}</p>
      <div className="mt-3 min-h-20">{children}</div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-center">
      <p className="text-[11px] tracking-[0.2em] text-white/45">{label}</p>
      <p className="mt-1 truncate text-sm text-white">{value}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-white/10 bg-white/[0.04] p-3 text-center">
      <p className="text-[11px] tracking-[0.2em] text-white/42">{label}</p>
      <p className="mt-1 text-base text-white">{value}</p>
    </div>
  );
}
