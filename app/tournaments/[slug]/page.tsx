import Link from "next/link";
import { notFound } from "next/navigation";

import { PlayerAvatar } from "@/components/player-avatar";
import { SiteNav } from "@/components/site-nav";
import { TournamentStructure } from "@/components/tournament-structure";
import { formatDateTime, getStatusClasses } from "@/lib/formatters";
import { groupMatchesByRound } from "@/lib/score-utils";
import {
  formatMatchState,
  formatPlayerStatus,
  formatScoringMode,
  formatScoringRule,
  formatTournamentFormat,
  formatTournamentStatus,
} from "@/lib/tournament-labels";
import { getTournamentBySlug } from "@/lib/tournament-service";

type TournamentPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function TournamentDetailPage({ params }: TournamentPageProps) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);

  if (!tournament) {
    notFound();
  }

  const rounds = groupMatchesByRound(tournament.matches);

  return (
    <div className="min-h-screen pb-16">
      <SiteNav />

      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <section className="panel-strong rounded-[2rem] px-6 py-8 lg:px-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-4xl min-w-0">
              <p className="eyebrow text-amber-200">{tournament.heroKicker}</p>
              <h1 className="mt-3 break-words font-display text-4xl tracking-[0.06em] text-white sm:text-5xl lg:text-6xl">
                {tournament.name}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-white/68 sm:text-lg sm:leading-8">
                {tournament.heroSummary}
              </p>
            </div>

            <span
              className={`rounded-full border px-4 py-2 text-xs tracking-[0.24em] ${getStatusClasses(
                tournament.status,
              )}`}
            >
              {formatTournamentStatus(tournament.status)}
            </span>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <InfoCard label="場地" value={tournament.venue} />
            <InfoCard label="賽制" value={formatTournamentFormat(tournament.format)} />
            <InfoCard label="計分方式" value={formatScoringMode(tournament.scoringMode)} />
            <InfoCard label="參賽人數" value={String(tournament.stats.playerCount)} />
            <InfoCard label="計分規則" value={formatScoringRule(tournament)} compact />
          </div>
        </section>

        <section className="panel min-w-0 overflow-x-hidden rounded-[1.75rem] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow text-cyan-200">
                {tournament.format === "single_elimination"
                  ? "單淘汰賽程圖"
                  : tournament.format === "double_elimination"
                    ? "雙敗淘汰賽程圖"
                    : "循環賽賽程圖"}
              </p>
              <h2 className="mt-2 font-display text-4xl tracking-[0.08em] text-white">
                賽事結構
              </h2>
            </div>
            <Link
              href={`/tournaments/${tournament.slug}/display`}
              className="rounded-full border border-white/14 px-4 py-2 text-xs tracking-[0.24em] text-white/76 transition hover:bg-white/8"
            >
              開啟大螢幕展示
            </Link>
          </div>

          <div className="mt-6 min-w-0">
            <TournamentStructure
              tournament={tournament}
              compact
              detailBasePath={`/tournaments/${tournament.slug}/matches`}
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="min-w-0 space-y-6">
            {tournament.currentMatch ? (
              <div className="panel rounded-[1.75rem] p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="eyebrow text-cyan-200">目前進行中的場次</p>
                    <h2 className="mt-2 font-display text-4xl tracking-[0.08em] text-white">
                      {tournament.currentMatch.roundName}
                    </h2>
                  </div>
                  <Link
                    href={`/tournaments/${tournament.slug}/display`}
                    className="rounded-full border border-white/14 px-4 py-2 text-xs tracking-[0.24em] text-white/76 transition hover:bg-white/8"
                  >
                    公開展示頁
                  </Link>
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_auto_1fr] xl:items-center">
                  <div className="min-w-0 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-xs tracking-[0.22em] text-white/45">選手 1</p>
                    <div className="mt-3 flex items-center gap-3">
                      <PlayerAvatar name={tournament.currentMatch.player1.displayName} />
                      <p className="break-words font-display text-3xl tracking-[0.06em] text-white sm:text-4xl">
                        {tournament.currentMatch.player1.displayName}
                      </p>
                    </div>
                  </div>
                  <div className="text-center font-display text-4xl tracking-[0.1em] text-amber-200 sm:text-5xl">
                    {tournament.currentMatch.player1Total}
                    <span className="mx-3 text-white/28">:</span>
                    {tournament.currentMatch.player2Total}
                  </div>
                  <div className="min-w-0 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-xs tracking-[0.22em] text-white/45">選手 2</p>
                    <div className="mt-3 flex items-center gap-3">
                      <PlayerAvatar name={tournament.currentMatch.player2.displayName} />
                      <p className="break-words font-display text-3xl tracking-[0.06em] text-white sm:text-4xl">
                        {tournament.currentMatch.player2.displayName}
                      </p>
                    </div>
                  </div>
                </div>

                {tournament.scoringMode === "set_total" ||
                tournament.currentMatch.sets.length > 1 ? (
                  <div className="mt-6 grid gap-3 md:grid-cols-3">
                    {tournament.currentMatch.sets.map((set) => (
                      <div
                        key={set.id}
                        className="rounded-3xl border border-white/10 bg-black/20 px-4 py-3"
                      >
                        <p className="text-xs tracking-[0.22em] text-white/42">
                          第 {set.setNo} 局
                        </p>
                        <p className="mt-2 font-display text-3xl tracking-[0.08em] text-white">
                          {set.player1Score}
                          <span className="mx-2 text-white/25">:</span>
                          {set.player2Score}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-6 rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/68">
                    {formatScoringRule(tournament)}
                  </p>
                )}

                <div className="mt-6 flex flex-wrap gap-3 text-xs tracking-[0.22em] text-white/45">
                  <span>{tournament.currentMatch.scheduledLabel}</span>
                  <span>更新於 {formatDateTime(tournament.currentMatch.updatedAt)}</span>
                  <Link
                    href={`/tournaments/${tournament.slug}/matches/${tournament.currentMatch.id}`}
                    className="text-cyan-200 transition hover:text-white"
                  >
                    查看場次詳情
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="panel rounded-[1.75rem] p-6">
              <p className="eyebrow text-white/55">輪次明細</p>
              <h2 className="mt-2 font-display text-4xl tracking-[0.08em] text-white">
                全部場次
              </h2>

              <div className="mt-6 space-y-4">
                {rounds.map((round) => (
                  <div
                    key={round.roundName}
                    className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-display text-3xl tracking-[0.08em] text-white">
                        {round.roundName}
                      </h3>
                      <span className="text-xs tracking-[0.24em] text-white/42">
                        {round.matches.length} 場
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {round.matches.map((match) => (
                        <Link
                          key={match.id}
                          href={`/tournaments/${tournament.slug}/matches/${match.id}`}
                          className="rounded-3xl border border-white/10 bg-black/20 p-4 transition hover:border-white/20"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="truncate font-display text-2xl tracking-[0.08em] text-white">
                                {match.player1.displayName}
                                <span className="mx-3 text-white/25">vs</span>
                                {match.player2.displayName}
                              </p>
                              <p className="mt-2 text-xs tracking-[0.22em] text-white/42">
                                {match.scheduledLabel}
                              </p>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="font-display text-4xl tracking-[0.12em] text-amber-200">
                                {match.player1Total}
                                <span className="mx-2 text-white/25">:</span>
                                {match.player2Total}
                              </p>
                              <span
                                className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[11px] tracking-[0.22em] ${getStatusClasses(
                                  match.state,
                                )}`}
                              >
                                {formatMatchState(match.state)}
                              </span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="panel rounded-[1.75rem] p-6">
              <p className="eyebrow text-white/55">參賽名單</p>
              <h2 className="mt-2 font-display text-4xl tracking-[0.08em] text-white">
                選手資訊
              </h2>

              <div className="mt-5 grid gap-3">
                {tournament.players.map((player) => (
                  <div
                    key={player.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <PlayerAvatar name={player.displayName} sizeClassName="h-11 w-11" />
                      <div className="min-w-0">
                        <p className="truncate font-display text-2xl tracking-[0.08em] text-white">
                          {player.displayName}
                        </p>
                        <p className="text-xs tracking-[0.24em] text-white/42">
                          種子順位 {player.seed ?? "-"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs tracking-[0.22em] text-white/42">
                      {formatPlayerStatus(player.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function InfoCard({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-xs tracking-[0.24em] text-white/45">{label}</p>
      <p className={`mt-2 text-white ${compact ? "text-sm leading-6" : "text-lg"}`}>
        {value}
      </p>
    </div>
  );
}
