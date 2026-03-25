import { notFound } from "next/navigation";

import { SiteNav } from "@/components/site-nav";
import { formatDateTime, getStatusClasses } from "@/lib/formatters";
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

  return (
    <div className="min-h-screen pb-16">
      <SiteNav />

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <section className="panel-strong rounded-[2rem] px-6 py-8 lg:px-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-amber-200">{tournament.name}</p>
              <h1 className="mt-3 font-display text-5xl uppercase tracking-[0.08em] text-white sm:text-6xl">
                {match.player1.displayName}
                <span className="mx-3 text-white/25">vs</span>
                {match.player2.displayName}
              </h1>
              <p className="mt-3 text-sm uppercase tracking-[0.24em] text-white/42">
                {match.roundName} · {match.scheduledLabel}
              </p>
            </div>
            <span
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.24em] ${getStatusClasses(
                match.state,
              )}`}
            >
              {match.state}
            </span>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-5 text-center">
              <p className="text-sm uppercase tracking-[0.22em] text-white/45">
                Player 1 Total
              </p>
              <p className="mt-3 font-display text-6xl uppercase tracking-[0.08em] text-white">
                {match.player1Total}
              </p>
            </div>
            <div className="font-display text-5xl uppercase tracking-[0.3em] text-white/24">
              vs
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-5 text-center">
              <p className="text-sm uppercase tracking-[0.22em] text-white/45">
                Player 2 Total
              </p>
              <p className="mt-3 font-display text-6xl uppercase tracking-[0.08em] text-white">
                {match.player2Total}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="panel rounded-[1.75rem] p-6">
            <p className="eyebrow text-cyan-200">Set Breakdown</p>
            <div className="mt-5 space-y-3">
              {match.sets.map((set) => (
                <div
                  key={set.id}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-4"
                >
                  <p className="font-display text-3xl uppercase tracking-[0.08em] text-amber-200">
                    {set.setNo}
                  </p>
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-white/42">
                      Set score
                    </p>
                    <p className="mt-2 font-display text-4xl uppercase tracking-[0.08em] text-white">
                      {set.player1Score}
                      <span className="mx-2 text-white/25">:</span>
                      {set.player2Score}
                    </p>
                  </div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/42">
                    {set.note ?? "logged"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="panel rounded-[1.75rem] p-6">
              <p className="eyebrow text-white/55">Result</p>
              <h2 className="mt-2 font-display text-4xl uppercase tracking-[0.08em] text-white">
                {match.winnerId
                  ? `Winner: ${
                      match.winnerId === match.player1.id
                        ? match.player1.displayName
                        : match.player2.displayName
                    }`
                  : "Match tied so far"}
              </h2>
              <p className="mt-4 text-base leading-7 text-white/68">
                The winner is determined by the total points across all sets in
                this match, which fits Beyblade and archery-style scoring.
              </p>
            </div>

            <div className="panel rounded-[1.75rem] p-6">
              <p className="eyebrow text-white/55">Timing</p>
              <div className="mt-5 space-y-3 text-sm text-white/72">
                <div className="flex items-center justify-between">
                  <span>Last update</span>
                  <span>{formatDateTime(match.updatedAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Rule target</span>
                  <span>{tournament.winScoreRule} pts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>State</span>
                  <span>{match.state}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
