import Link from "next/link";

import { SiteNav } from "@/components/site-nav";
import { formatDate, getStatusClasses } from "@/lib/formatters";
import {
  formatTournamentFormat,
  formatTournamentStatus,
} from "@/lib/score-utils";
import { getTournamentSummaries } from "@/lib/tournament-service";

export const metadata = {
  title: "Tournaments",
};

export default async function TournamentsPage() {
  const tournaments = await getTournamentSummaries();
  const live = tournaments.filter((tournament) => tournament.status === "live");
  const history = tournaments.filter((tournament) => tournament.status !== "live");

  return (
    <div className="min-h-screen pb-16">
      <SiteNav />

      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <section className="panel-strong rounded-[2rem] px-6 py-8 lg:px-10">
          <p className="eyebrow text-cyan-200">Tournament Directory</p>
          <h1 className="mt-3 font-display text-6xl uppercase tracking-[0.08em] text-white sm:text-7xl">
            Live now, plus the archive behind it.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-white/68">
            Browse current events, completed tournaments, and past showcases from
            a single public index. This is the front door for spectators and
            returning visitors.
          </p>
        </section>

        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow text-amber-200">Current Tournaments</p>
              <h2 className="mt-2 font-display text-4xl uppercase tracking-[0.08em] text-white">
                Active broadcast boards
              </h2>
            </div>
            <span className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/72">
              {live.length} live
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {live.map((tournament) => (
              <Link
                key={tournament.id}
                href={`/tournaments/${tournament.slug}`}
                className="panel group rounded-[1.75rem] p-6 transition hover:-translate-y-1"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-white/45">
                      {tournament.heroKicker}
                    </p>
                    <h3 className="mt-2 font-display text-4xl uppercase tracking-[0.08em] text-white">
                      {tournament.name}
                    </h3>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.22em] ${getStatusClasses(
                      tournament.status,
                    )}`}
                  >
                    {formatTournamentStatus(tournament.status)}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                      Format
                    </p>
                    <p className="mt-2 text-sm text-white">
                      {formatTournamentFormat(tournament.format)}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                      Players
                    </p>
                    <p className="mt-2 text-sm text-white">{tournament.playerCount}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                      Venue
                    </p>
                    <p className="mt-2 text-sm text-white">{tournament.venue}</p>
                  </div>
                </div>

                <p className="mt-5 text-sm leading-7 text-white/64">
                  {tournament.heroSummary}
                </p>

                <div className="mt-5 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-white/42">
                  <span>Started {formatDate(tournament.startedAt)}</span>
                  <span className="text-amber-200 transition group-hover:text-white">
                    Open Tournament
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow text-white/55">History</p>
              <h2 className="mt-2 font-display text-4xl uppercase tracking-[0.08em] text-white">
                Completed and archived events
              </h2>
            </div>
            <span className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/72">
              {history.length} total
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {history.map((tournament) => (
              <Link
                key={tournament.id}
                href={`/tournaments/${tournament.slug}`}
                className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-white/45">
                      {tournament.heroKicker}
                    </p>
                    <h3 className="mt-2 font-display text-3xl uppercase tracking-[0.08em] text-white">
                      {tournament.name}
                    </h3>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.22em] ${getStatusClasses(
                      tournament.status,
                    )}`}
                  >
                    {formatTournamentStatus(tournament.status)}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-7 text-white/64">
                  {tournament.heroSummary}
                </p>

                <div className="mt-5 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-white/42">
                  <span>{formatTournamentFormat(tournament.format)}</span>
                  <span>{formatDate(tournament.endedAt || tournament.startedAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
