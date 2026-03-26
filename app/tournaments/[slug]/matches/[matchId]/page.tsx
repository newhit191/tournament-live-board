import { notFound } from "next/navigation";

import { PlayerAvatar } from "@/components/player-avatar";
import { SiteNav } from "@/components/site-nav";
import { formatDateTime, getStatusClasses } from "@/lib/formatters";
import {
  formatMatchState,
  formatScoringRule,
} from "@/lib/tournament-labels";
import { getTournamentBySlug } from "@/lib/tournament-service";

type MatchPageProps = {
  params: Promise<{ slug: string; matchId: string }>;
};

export default async function TournamentMatchPage({ params }: MatchPageProps) {
  const { slug, matchId } = await params;
  const tournament = await getTournamentBySlug(slug);

  if (!tournament) {
    notFound();
  }

  const match = tournament.matches.find((entry) => entry.id === matchId);

  if (!match) {
    notFound();
  }

  const winnerName =
    match.winnerId === match.player1.id
      ? match.player1.displayName
      : match.winnerId === match.player2.id
        ? match.player2.displayName
        : null;

  return (
    <div className="min-h-screen pb-16">
      <SiteNav />

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <section className="panel-strong rounded-[2rem] px-6 py-8 lg:px-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow text-amber-200">{tournament.name}</p>
              <h1 className="mt-3 break-words font-display text-3xl tracking-[0.06em] text-white sm:text-4xl lg:text-5xl">
                {match.player1.displayName}
                <span className="mx-3 text-white/25">vs</span>
                {match.player2.displayName}
              </h1>
              <p className="mt-3 text-sm tracking-[0.24em] text-white/42">
                {match.roundName} / {match.scheduledLabel}
              </p>
            </div>
            <span
              className={`rounded-full border px-4 py-2 text-xs tracking-[0.24em] ${getStatusClasses(
                match.state,
              )}`}
            >
              {formatMatchState(match.state)}
            </span>
          </div>

          <div className="mt-8 grid gap-4 xl:grid-cols-[1fr_auto_1fr] xl:items-center">
            <ScoreBox label={match.player1.displayName} score={match.player1Total} />
            <div className="text-center font-display text-4xl tracking-[0.2em] text-white/24 sm:text-5xl">
              VS
            </div>
            <ScoreBox label={match.player2.displayName} score={match.player2Total} />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="panel rounded-[1.75rem] p-6">
            <p className="eyebrow text-cyan-200">分局詳情</p>
            <div className="mt-5 space-y-3">
              {match.sets.length > 0 ? (
                match.sets.map((set) => (
                  <div
                    key={set.id}
                    className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                  >
                    <p className="font-display text-3xl tracking-[0.08em] text-amber-200">
                      {set.setNo}
                    </p>
                    <div>
                      <p className="text-xs tracking-[0.22em] text-white/42">第 {set.setNo} 局</p>
                      <p className="mt-2 font-display text-4xl tracking-[0.08em] text-white">
                        {set.player1Score}
                        <span className="mx-2 text-white/25">:</span>
                        {set.player2Score}
                      </p>
                    </div>
                    <p className="text-xs tracking-[0.22em] text-white/42">
                      {set.note ?? "正常記錄"}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-base leading-8 text-white/70">
                  尚未建立分局資料。
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="panel rounded-[1.75rem] p-6">
              <p className="eyebrow text-white/55">結果判定</p>
              <h2 className="mt-2 font-display text-4xl tracking-[0.08em] text-white">
                {winnerName ? `勝方：${winnerName}` : "目前尚未分出勝負"}
              </h2>
              <p className="mt-4 text-base leading-7 text-white/68">
                {formatScoringRule(tournament)}
              </p>
            </div>

            <div className="panel rounded-[1.75rem] p-6">
              <p className="eyebrow text-white/55">比賽資訊</p>
              <div className="mt-5 space-y-3 text-sm text-white/72">
                <div className="flex items-center justify-between gap-4">
                  <span>最後更新</span>
                  <span>{formatDateTime(match.updatedAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>規則</span>
                  <span className="text-right">{formatScoringRule(tournament)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>狀態</span>
                  <span>{formatMatchState(match.state)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function ScoreBox({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-5 text-center">
      <div className="flex items-center justify-center">
        <PlayerAvatar name={label} />
      </div>
      <p className="mt-2 truncate text-sm tracking-[0.22em] text-white/45">{label}</p>
      <p className="mt-3 font-display text-5xl tracking-[0.08em] text-white sm:text-6xl">
        {score}
      </p>
    </div>
  );
}
