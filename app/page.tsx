import Link from "next/link";

import { SiteNav } from "@/components/site-nav";
import { formatDateTime, getStatusClasses } from "@/lib/formatters";
import {
  formatTournamentFormat,
  formatTournamentStatus,
} from "@/lib/score-utils";
import { getTournamentSummaries } from "@/lib/tournament-service";

export default async function Home() {
  const tournaments = await getTournamentSummaries();
  const liveTournament =
    tournaments.find((tournament) => tournament.status === "live") ||
    tournaments[0];
  const history = tournaments.filter((tournament) => tournament.status !== "live");

  return (
    <div className="min-h-screen pb-16">
      <SiteNav />

      <main className="mx-auto flex max-w-7xl flex-col gap-10 px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <section className="panel-strong score-rim grid gap-8 rounded-[2rem] px-6 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:py-12">
          <div className="space-y-6">
            <p className="eyebrow text-amber-200">Tournament Broadcast OS</p>
            <div className="space-y-4">
              <h1 className="max-w-4xl font-display text-6xl uppercase leading-[0.9] tracking-[0.06em] text-white sm:text-7xl lg:text-[6.8rem]">
                Built for the screen. Fast enough for the desk.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-white/72">
                A tournament website that gives you a cinematic public display,
                a focused control room, and a Google Sheets-driven workflow that
                stays practical for real operators.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={liveTournament ? `/tournaments/${liveTournament.slug}/display` : "/tournaments"}
                className="rounded-full border border-amber-300/30 bg-amber-300/14 px-6 py-3 text-sm uppercase tracking-[0.28em] text-amber-100 transition hover:bg-amber-300/22"
              >
                Open Display Mode
              </Link>
              <Link
                href="/admin/tournaments"
                className="rounded-full border border-white/14 bg-white/6 px-6 py-3 text-sm uppercase tracking-[0.28em] text-white/85 transition hover:bg-white/12"
              >
                Enter Admin Console
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Public display", value: "Live scoreboard + schedule" },
                { label: "Admin control", value: "Shared password backstage" },
                { label: "Data source", value: "Google Sheets first" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"
                >
                  <p className="text-xs uppercase tracking-[0.26em] text-white/45">
                    {item.label}
                  </p>
                  <p className="mt-3 font-display text-2xl uppercase tracking-[0.08em] text-white">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel rounded-[1.75rem] p-6">
            <div className="flex items-center justify-between">
              <p className="eyebrow text-cyan-200">Featured Tournament</p>
              {liveTournament ? (
                <span
                  className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.24em] ${getStatusClasses(
                    liveTournament.status,
                  )}`}
                >
                  {formatTournamentStatus(liveTournament.status)}
                </span>
              ) : null}
            </div>

            {liveTournament ? (
              <div className="mt-6 space-y-5">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-white/45">
                    {liveTournament.heroKicker}
                  </p>
                  <h2 className="mt-2 font-display text-5xl uppercase tracking-[0.08em] text-white">
                    {liveTournament.name}
                  </h2>
                  <p className="mt-3 text-base leading-7 text-white/68">
                    {liveTournament.heroSummary}
                  </p>
                </div>

                <dl className="grid grid-cols-2 gap-3">
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <dt className="text-xs uppercase tracking-[0.24em] text-white/45">
                      Venue
                    </dt>
                    <dd className="mt-2 text-lg text-white">{liveTournament.venue}</dd>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <dt className="text-xs uppercase tracking-[0.24em] text-white/45">
                      Format
                    </dt>
                    <dd className="mt-2 text-lg text-white">
                      {formatTournamentFormat(liveTournament.format)}
                    </dd>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <dt className="text-xs uppercase tracking-[0.24em] text-white/45">
                      Players
                    </dt>
                    <dd className="mt-2 text-lg text-white">
                      {liveTournament.playerCount}
                    </dd>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <dt className="text-xs uppercase tracking-[0.24em] text-white/45">
                      Started
                    </dt>
                    <dd className="mt-2 text-lg text-white">
                      {formatDateTime(liveTournament.startedAt)}
                    </dd>
                  </div>
                </dl>

                <Link
                  href={`/tournaments/${liveTournament.slug}`}
                  className="inline-flex rounded-full border border-white/14 px-5 py-3 text-sm uppercase tracking-[0.24em] text-white/85 transition hover:bg-white/8"
                >
                  View Tournament Overview
                </Link>
              </div>
            ) : (
              <p className="mt-6 text-white/68">
                No tournament is marked as live yet. Start from the admin console
                to prepare the first event.
              </p>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="panel rounded-[1.75rem] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow text-white/55">Operator Flow</p>
                <h2 className="mt-2 font-display text-4xl uppercase tracking-[0.08em] text-white">
                  Small crew, full production feel
                </h2>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                "Create a tournament and add players in the admin console.",
                "Generate or prepare matches, then choose the featured live match.",
                "Update each set score manually or punch in final totals directly.",
                "Let the display page refresh itself every few seconds on the big screen.",
              ].map((step, index) => (
                <div key={step} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="font-display text-4xl uppercase tracking-[0.08em] text-amber-200">
                    0{index + 1}
                  </p>
                  <p className="mt-3 text-base leading-7 text-white/72">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel rounded-[1.75rem] p-6">
            <p className="eyebrow text-white/55">History Ready</p>
            <h2 className="mt-2 font-display text-4xl uppercase tracking-[0.08em] text-white">
              Past tournaments stay browseable
            </h2>

            <div className="mt-6 space-y-4">
              {history.slice(0, 3).map((tournament) => (
                <Link
                  key={tournament.id}
                  href={`/tournaments/${tournament.slug}`}
                  className="block rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 transition hover:border-white/18 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-white/45">
                        {tournament.heroKicker}
                      </p>
                      <h3 className="mt-2 font-display text-3xl uppercase tracking-[0.08em] text-white">
                        {tournament.name}
                      </h3>
                      <p className="mt-2 max-w-lg text-sm leading-7 text-white/64">
                        {tournament.heroSummary}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.22em] ${getStatusClasses(
                        tournament.status,
                      )}`}
                    >
                      {formatTournamentStatus(tournament.status)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
