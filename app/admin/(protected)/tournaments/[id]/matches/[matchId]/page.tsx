import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDateTime, getStatusClasses } from "@/lib/formatters";
import { getTournamentById } from "@/lib/tournament-service";

type AdminMatchPageProps = {
  params: Promise<{ id: string; matchId: string }>;
};

export default async function AdminMatchControlPage({
  params,
}: AdminMatchPageProps) {
  const { id, matchId } = await params;
  const tournament = await getTournamentById(id);

  if (!tournament) {
    notFound();
  }

  const match = tournament.matches.find((entry) => entry.id === matchId);

  if (!match) {
    notFound();
  }

  return (
    <>
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow text-amber-200">Match Control</p>
          <h2 className="mt-3 font-display text-5xl uppercase tracking-[0.08em] text-white">
            {match.player1.displayName}
            <span className="mx-3 text-white/25">vs</span>
            {match.player2.displayName}
          </h2>
          <p className="mt-3 text-sm uppercase tracking-[0.24em] text-white/42">
            {match.roundName} · {match.scheduledLabel}
          </p>
        </div>

        <Link
          href={`/tournaments/${tournament.slug}/matches/${match.id}`}
          className="rounded-full border border-white/14 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/76 transition hover:bg-white/8"
        >
          Open public view
        </Link>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel-strong rounded-[2rem] px-6 py-8">
          <div className="flex items-center justify-between">
            <p className="eyebrow text-cyan-200">Score Desk</p>
            <span
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.24em] ${getStatusClasses(
                match.state,
              )}`}
            >
              {match.state}
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 text-center">
              <p className="text-sm uppercase tracking-[0.22em] text-white/45">
                {match.player1.displayName}
              </p>
              <p className="mt-3 font-display text-6xl uppercase tracking-[0.08em] text-white">
                {match.player1Total}
              </p>
            </div>
            <div className="font-display text-5xl uppercase tracking-[0.3em] text-white/24">
              vs
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 text-center">
              <p className="text-sm uppercase tracking-[0.22em] text-white/45">
                {match.player2.displayName}
              </p>
              <p className="mt-3 font-display text-6xl uppercase tracking-[0.08em] text-white">
                {match.player2Total}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {match.sets.map((set) => (
              <div
                key={set.id}
                className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="font-display text-3xl uppercase tracking-[0.08em] text-white">
                    Set {set.setNo}
                  </p>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/42">
                    Updated {formatDateTime(set.updatedAt)}
                  </p>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                      {match.player1.displayName}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <button className="rounded-full border border-white/12 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/72">
                        -1
                      </button>
                      <p className="font-display text-5xl uppercase tracking-[0.08em] text-white">
                        {set.player1Score}
                      </p>
                      <button className="rounded-full border border-white/12 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/72">
                        +1
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                      {match.player2.displayName}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <button className="rounded-full border border-white/12 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/72">
                        -1
                      </button>
                      <p className="font-display text-5xl uppercase tracking-[0.08em] text-white">
                        {set.player2Score}
                      </p>
                      <button className="rounded-full border border-white/12 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/72">
                        +1
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel rounded-[1.75rem] p-6">
            <p className="eyebrow text-white/55">Next wiring step</p>
            <div className="mt-5 space-y-3 text-sm leading-7 text-white/72">
              {[
                "Hook each +/- control to a server action that updates match_sets.",
                "Recompute match totals and winner_id after every write.",
                "Append an event_log row for auditability.",
                "Use tournaments.current_match_id to push the chosen match onto the display page.",
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

          <div className="panel rounded-[1.75rem] p-6">
            <p className="eyebrow text-white/55">Direct input</p>
            <div className="mt-5 grid gap-3">
              <label className="text-xs uppercase tracking-[0.22em] text-white/45">
                Final score override
                <input
                  type="text"
                  value={`${match.player1Total}:${match.player2Total}`}
                  readOnly
                  className="mt-2 w-full rounded-3xl border border-white/12 bg-white/[0.05] px-4 py-4 text-white outline-none"
                />
              </label>

              <button className="rounded-full border border-amber-300/30 bg-amber-300/14 px-5 py-4 text-sm uppercase tracking-[0.28em] text-amber-100">
                Wire save action next
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
