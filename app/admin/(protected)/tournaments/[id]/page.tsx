import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDateTime, getStatusClasses } from "@/lib/formatters";
import { formatTournamentStatus } from "@/lib/score-utils";
import { getTournamentById } from "@/lib/tournament-service";

type AdminTournamentPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminTournamentDetailPage({
  params,
}: AdminTournamentPageProps) {
  const { id } = await params;
  const tournament = await getTournamentById(id);

  if (!tournament) {
    notFound();
  }

  return (
    <>
      <section className="panel-strong rounded-[2rem] px-6 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-amber-200">Tournament Control Room</p>
            <h2 className="mt-3 font-display text-5xl uppercase tracking-[0.08em] text-white">
              {tournament.name}
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-8 text-white/68">
              Use this page to manage the featured match, review score state, and
              move into match-specific editing. The current build focuses on the
              control room shell and data structure foundation.
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
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <div className="panel rounded-[1.75rem] p-6">
            <p className="eyebrow text-cyan-200">Players</p>
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
                    <p className="text-xs uppercase tracking-[0.22em] text-white/42">
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

          <div className="panel rounded-[1.75rem] p-6">
            <p className="eyebrow text-white/55">Sheet Mapping</p>
            <div className="mt-5 space-y-3 text-sm leading-7 text-white/72">
              {[
                "tournaments.current_match_id selects the public featured match.",
                "matches rows hold the match shell and top-level totals.",
                "match_sets rows store each set score that rolls up into totals.",
                "event_log will track every operator update when write actions are wired in.",
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
        </div>

        <div className="panel rounded-[1.75rem] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow text-white/55">Matches</p>
              <h3 className="mt-2 font-display text-4xl uppercase tracking-[0.08em] text-white">
                Operator jump list
              </h3>
            </div>
            {tournament.currentMatch ? (
              <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-amber-100">
                Featured: {tournament.currentMatch.player1.displayName}
              </span>
            ) : null}
          </div>

          <div className="mt-5 space-y-3">
            {tournament.matches.map((match) => (
              <Link
                key={match.id}
                href={`/admin/tournaments/${tournament.id}/matches/${match.id}`}
                className="block rounded-3xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-white/18 hover:bg-white/[0.06]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-2xl uppercase tracking-[0.08em] text-white">
                      {match.player1.displayName}
                      <span className="mx-2 text-white/25">vs</span>
                      {match.player2.displayName}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.22em] text-white/42">
                      {match.roundName} · {match.scheduledLabel}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-4xl uppercase tracking-[0.1em] text-amber-200">
                      {match.player1Total}
                      <span className="mx-2 text-white/25">:</span>
                      {match.player2Total}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.22em] text-white/42">
                      Updated {formatDateTime(match.updatedAt)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
