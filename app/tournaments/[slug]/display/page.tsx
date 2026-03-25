import Link from "next/link";
import { notFound } from "next/navigation";

import { DisplayAutoRefresh } from "@/components/display-auto-refresh";
import { formatDateTime, getStatusClasses } from "@/lib/formatters";
import { groupMatchesByRound } from "@/lib/score-utils";
import { getTournamentBySlug } from "@/lib/tournament-service";

type DisplayPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function TournamentDisplayPage({
  params,
}: DisplayPageProps) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);

  if (!tournament) {
    notFound();
  }

  const currentMatch = tournament.currentMatch;

  if (!currentMatch) {
    notFound();
  }

  const rounds = groupMatchesByRound(tournament.matches);

  return (
    <div className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <DisplayAutoRefresh intervalMs={5000} />

      <main className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1720px] flex-col gap-4">
        <section className="panel-strong rounded-[2rem] px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="eyebrow text-cyan-200">{tournament.heroKicker}</p>
              <h1 className="mt-2 font-display text-5xl uppercase tracking-[0.08em] text-white sm:text-6xl">
                {tournament.name}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.24em] ${getStatusClasses(
                  tournament.status,
                )}`}
              >
                {tournament.status}
              </span>
              <Link
                href={`/tournaments/${tournament.slug}`}
                className="rounded-full border border-white/14 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/76 transition hover:bg-white/8"
              >
                Overview
              </Link>
            </div>
          </div>
        </section>

        <section className="grid flex-1 gap-4 xl:grid-cols-[0.85fr_1.3fr_0.85fr]">
          <aside className="panel rounded-[1.75rem] p-5">
            <p className="eyebrow text-white/55">Schedule Rail</p>
            <div className="mt-4 space-y-4">
              {rounds.map((round) => (
                <div
                  key={round.roundName}
                  className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-3xl uppercase tracking-[0.08em] text-white">
                      {round.roundName}
                    </h2>
                    <span className="text-xs uppercase tracking-[0.22em] text-white/42">
                      {round.matches.length}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {round.matches.map((match) => (
                      <div
                        key={match.id}
                        className={`rounded-3xl border p-4 ${
                          match.id === currentMatch.id
                            ? "border-amber-300/35 bg-amber-300/10"
                            : "border-white/10 bg-black/20"
                        }`}
                      >
                        <p className="font-display text-2xl uppercase tracking-[0.08em] text-white">
                          {match.player1.displayName}
                          <span className="mx-2 text-white/25">vs</span>
                          {match.player2.displayName}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-white/42">
                          <span>{match.scheduledLabel}</span>
                          <span>
                            {match.player1Total}:{match.player2Total}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <section className="panel-strong score-rim rounded-[2rem] px-6 py-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow text-amber-200">Now Playing</p>
                <p className="mt-2 text-sm uppercase tracking-[0.28em] text-white/42">
                  {currentMatch.roundName} · {currentMatch.scheduledLabel}
                </p>
              </div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/42">
                Updated {formatDateTime(currentMatch.updatedAt)}
              </p>
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.05] p-6 text-center">
                <p className="text-sm uppercase tracking-[0.24em] text-white/45">
                  Player 1
                </p>
                <h2 className="mt-4 font-display text-6xl uppercase tracking-[0.08em] text-white">
                  {currentMatch.player1.displayName}
                </h2>
                <p className="mt-4 font-display text-[8rem] uppercase leading-none tracking-[0.12em] text-amber-200">
                  {currentMatch.player1Total}
                </p>
              </div>

              <div className="text-center">
                <p className="font-display text-6xl uppercase tracking-[0.4em] text-white/24">
                  vs
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.05] p-6 text-center">
                <p className="text-sm uppercase tracking-[0.24em] text-white/45">
                  Player 2
                </p>
                <h2 className="mt-4 font-display text-6xl uppercase tracking-[0.08em] text-white">
                  {currentMatch.player2.displayName}
                </h2>
                <p className="mt-4 font-display text-[8rem] uppercase leading-none tracking-[0.12em] text-cyan-200">
                  {currentMatch.player2Total}
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {currentMatch.sets.map((set) => (
                <div
                  key={set.id}
                  className="rounded-3xl border border-white/10 bg-black/20 px-5 py-4"
                >
                  <p className="text-xs uppercase tracking-[0.22em] text-white/42">
                    Set {set.setNo}
                  </p>
                  <p className="mt-2 font-display text-4xl uppercase tracking-[0.1em] text-white">
                    {set.player1Score}
                    <span className="mx-2 text-white/25">:</span>
                    {set.player2Score}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <aside className="panel rounded-[1.75rem] p-5">
            <p className="eyebrow text-white/55">Context Panel</p>
            <div className="mt-4 space-y-4">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-white/42">
                  Venue
                </p>
                <p className="mt-2 text-xl text-white">{tournament.venue}</p>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-white/42">
                  Live Rules
                </p>
                <p className="mt-2 text-base leading-7 text-white/72">
                  Total score across all sets decides the winner. Admin can add or
                  subtract points per set and designate the featured match.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-white/42">
                  Event Snapshot
                </p>
                <div className="mt-4 space-y-3 text-sm text-white/72">
                  <div className="flex items-center justify-between">
                    <span>Players</span>
                    <span>{tournament.stats.playerCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Matches completed</span>
                    <span>{tournament.stats.completedMatches}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Matches live</span>
                    <span>{tournament.stats.liveMatches}</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
