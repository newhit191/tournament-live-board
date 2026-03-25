import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteNav } from "@/components/site-nav";
import { formatDateTime, getStatusClasses } from "@/lib/formatters";
import {
  formatTournamentFormat,
  formatTournamentStatus,
  groupMatchesByRound,
} from "@/lib/score-utils";
import { getTournamentBySlug } from "@/lib/tournament-service";

type TournamentPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function TournamentDetailPage({
  params,
}: TournamentPageProps) {
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
            <div className="max-w-4xl">
              <p className="eyebrow text-amber-200">{tournament.heroKicker}</p>
              <h1 className="mt-3 font-display text-6xl uppercase tracking-[0.08em] text-white sm:text-7xl">
                {tournament.name}
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-white/68">
                {tournament.heroSummary}
              </p>
            </div>

            <span
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.24em] ${getStatusClasses(
                tournament.status,
              )}`}
            >
              {formatTournamentStatus(tournament.status)}
            </span>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {[
              ["Venue", tournament.venue],
              ["Format", formatTournamentFormat(tournament.format)],
              ["Players", tournament.stats.playerCount.toString()],
              ["Win target", `${tournament.winScoreRule} pts`],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-white/45">
                  {label}
                </p>
                <p className="mt-2 text-lg text-white">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            {tournament.currentMatch ? (
              <div className="panel rounded-[1.75rem] p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="eyebrow text-cyan-200">Featured Match</p>
                    <h2 className="mt-2 font-display text-4xl uppercase tracking-[0.08em] text-white">
                      {tournament.currentMatch.roundName}
                    </h2>
                  </div>
                  <Link
                    href={`/tournaments/${tournament.slug}/display`}
                    className="rounded-full border border-white/14 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/76 transition hover:bg-white/8"
                  >
                    Open display
                  </Link>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                      Player 1
                    </p>
                    <p className="mt-2 font-display text-4xl uppercase tracking-[0.08em] text-white">
                      {tournament.currentMatch.player1.displayName}
                    </p>
                  </div>
                  <div className="font-display text-6xl uppercase tracking-[0.16em] text-amber-200">
                    {tournament.currentMatch.player1Total}
                    <span className="mx-3 text-white/28">:</span>
                    {tournament.currentMatch.player2Total}
                  </div>
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                      Player 2
                    </p>
                    <p className="mt-2 font-display text-4xl uppercase tracking-[0.08em] text-white">
                      {tournament.currentMatch.player2.displayName}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3 text-xs uppercase tracking-[0.22em] text-white/45">
                  <span>{tournament.currentMatch.scheduledLabel}</span>
                  <span>Updated {formatDateTime(tournament.currentMatch.updatedAt)}</span>
                  <Link
                    href={`/tournaments/${tournament.slug}/matches/${tournament.currentMatch.id}`}
                    className="text-cyan-200 transition hover:text-white"
                  >
                    Open match detail
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="panel rounded-[1.75rem] p-6">
              <p className="eyebrow text-white/55">Schedule</p>
              <h2 className="mt-2 font-display text-4xl uppercase tracking-[0.08em] text-white">
                Match flow
              </h2>

              <div className="mt-6 space-y-4">
                {rounds.map((round) => (
                  <div
                    key={round.roundName}
                    className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-3xl uppercase tracking-[0.08em] text-white">
                        {round.roundName}
                      </h3>
                      <span className="text-xs uppercase tracking-[0.24em] text-white/42">
                        {round.matches.length} matches
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {round.matches.map((match) => (
                        <Link
                          key={match.id}
                          href={`/tournaments/${tournament.slug}/matches/${match.id}`}
                          className="rounded-3xl border border-white/10 bg-black/20 p-4 transition hover:border-white/20"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-display text-2xl uppercase tracking-[0.08em] text-white">
                                {match.player1.displayName}
                                <span className="mx-3 text-white/25">vs</span>
                                {match.player2.displayName}
                              </p>
                              <p className="mt-2 text-xs uppercase tracking-[0.22em] text-white/42">
                                {match.scheduledLabel}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-display text-4xl uppercase tracking-[0.12em] text-amber-200">
                                {match.player1Total}
                                <span className="mx-2 text-white/25">:</span>
                                {match.player2Total}
                              </p>
                              <span
                                className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${getStatusClasses(
                                  match.state,
                                )}`}
                              >
                                {match.state}
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
              <p className="eyebrow text-white/55">Participants</p>
              <h2 className="mt-2 font-display text-4xl uppercase tracking-[0.08em] text-white">
                Player board
              </h2>

              <div className="mt-5 grid gap-3">
                {tournament.players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3"
                  >
                    <div>
                      <p className="font-display text-2xl uppercase tracking-[0.08em] text-white">
                        {player.displayName}
                      </p>
                      <p className="text-xs uppercase tracking-[0.24em] text-white/42">
                        Seed {player.seed ?? "-"}
                      </p>
                    </div>
                    <span className="text-xs uppercase tracking-[0.22em] text-white/42">
                      {player.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {tournament.format === "round_robin" ? (
              <div className="panel rounded-[1.75rem] p-6">
                <p className="eyebrow text-cyan-200">Standings</p>
                <h2 className="mt-2 font-display text-4xl uppercase tracking-[0.08em] text-white">
                  Ranking snapshot
                </h2>

                <div className="mt-5 space-y-3">
                  {tournament.standings.map((standing) => (
                    <div
                      key={standing.playerId}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3"
                    >
                      <p className="font-display text-3xl uppercase tracking-[0.08em] text-amber-200">
                        {standing.rank}
                      </p>
                      <div>
                        <p className="font-display text-2xl uppercase tracking-[0.08em] text-white">
                          {standing.player.displayName}
                        </p>
                        <p className="text-xs uppercase tracking-[0.22em] text-white/42">
                          {standing.wins}W / {standing.losses}L
                        </p>
                      </div>
                      <div className="text-right text-sm text-white/72">
                        <p>{standing.pointsFor} PF</p>
                        <p>{standing.pointDiff} DIFF</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
