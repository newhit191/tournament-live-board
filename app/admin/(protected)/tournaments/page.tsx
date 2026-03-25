import Link from "next/link";

import { formatDate, getStatusClasses } from "@/lib/formatters";
import {
  formatTournamentFormat,
  formatTournamentStatus,
} from "@/lib/score-utils";
import {
  getTournamentSetupState,
  getTournamentSummaries,
} from "@/lib/tournament-service";

export default async function AdminTournamentsPage() {
  const tournaments = await getTournamentSummaries();
  const setup = getTournamentSetupState();

  return (
    <>
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel-strong rounded-[2rem] px-6 py-8">
          <p className="eyebrow text-amber-200">Mission Control</p>
          <h2 className="mt-3 font-display text-5xl uppercase tracking-[0.08em] text-white">
            Run the show from one board.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-white/68">
            This is the operator-facing view for creating events, selecting the
            featured match, and managing score updates. The first version is set
            up to read from Google Sheets or fall back to mock data for design
            and demo work.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              ["Data source", setup.dataSource],
              ["Spreadsheet", setup.spreadsheetId ?? "not configured"],
              ["Admin gate", setup.adminPasswordConfigured ? "secured" : "demo mode"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-white/45">
                  {label}
                </p>
                <p className="mt-3 text-sm text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel rounded-[2rem] p-6">
          <p className="eyebrow text-cyan-200">Google Sheet Checklist</p>
          <div className="mt-5 space-y-3 text-sm leading-7 text-white/72">
            {[
              "Create tabs: tournaments, players, matches, match_sets, standings, event_log.",
              "Keep header names aligned with the design doc in docs/plans.",
              "Share the spreadsheet with the service account email from your env file.",
              "Set GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SHEETS_CLIENT_EMAIL, and GOOGLE_SHEETS_PRIVATE_KEY before switching off mock mode.",
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
      </section>

      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow text-white/55">Tournament List</p>
            <h2 className="mt-2 font-display text-4xl uppercase tracking-[0.08em] text-white">
              Available event boards
            </h2>
          </div>
          <span className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/72">
            {tournaments.length} total
          </span>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {tournaments.map((tournament) => (
            <Link
              key={tournament.id}
              href={`/admin/tournaments/${tournament.id}`}
              className="panel rounded-[1.75rem] p-6 transition hover:-translate-y-1"
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

              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                {[
                  ["Format", formatTournamentFormat(tournament.format)],
                  ["Players", tournament.playerCount.toString()],
                  ["Matches", tournament.matchCount.toString()],
                  ["Started", formatDate(tournament.startedAt)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-3xl border border-white/10 bg-black/20 p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                      {label}
                    </p>
                    <p className="mt-2 text-sm text-white">{value}</p>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
