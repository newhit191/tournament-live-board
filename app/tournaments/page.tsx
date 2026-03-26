import Link from "next/link";

import { SiteNav } from "@/components/site-nav";
import { formatDate, getStatusClasses } from "@/lib/formatters";
import {
  formatScoringMode,
  formatTournamentFormat,
  formatTournamentStatus,
} from "@/lib/tournament-labels";
import { getTournamentSummaries } from "@/lib/tournament-service";

export const metadata = {
  title: "賽事列表",
};

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const tournaments = await getTournamentSummaries();
  const live = tournaments.filter((tournament) => tournament.status === "live");
  const history = tournaments.filter((tournament) => tournament.status !== "live");

  return (
    <div className="min-h-screen pb-16">
      <SiteNav />

      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <section className="panel-strong rounded-[2rem] px-6 py-8 lg:px-10">
          <p className="eyebrow text-cyan-200">賽事總覽</p>
          <h1 className="mt-3 font-display text-4xl tracking-[0.06em] text-white sm:text-5xl lg:text-6xl">
            進行中與歷史賽事都在這裡
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-white/68 sm:text-lg sm:leading-8">
            可快速查看目前正在進行的賽事，也能回查過往賽事結果與對戰細節。
          </p>
        </section>

        <TournamentSection
          title="進行中賽事"
          subtitle={`目前共有 ${live.length} 場`}
          items={live}
        />
        <TournamentSection
          title="歷史賽事"
          subtitle={`目前共有 ${history.length} 場`}
          items={history}
        />
      </main>
    </div>
  );
}

function TournamentSection({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Awaited<ReturnType<typeof getTournamentSummaries>>;
}) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow text-amber-200">{title}</p>
          <h2 className="mt-2 font-display text-3xl tracking-[0.06em] text-white sm:text-4xl">
            {subtitle}
          </h2>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((tournament) => (
          <Link
            key={tournament.id}
            href={`/tournaments/${tournament.slug}`}
            className="panel group rounded-[1.75rem] p-5 transition hover:-translate-y-1 sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs tracking-[0.24em] text-white/45">
                  {tournament.heroKicker}
                </p>
                <h3 className="mt-2 break-words font-display text-3xl tracking-[0.06em] text-white sm:text-4xl">
                  {tournament.name}
                </h3>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs tracking-[0.22em] ${getStatusClasses(
                  tournament.status,
                )}`}
              >
                {formatTournamentStatus(tournament.status)}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card label="賽制" value={formatTournamentFormat(tournament.format)} />
              <Card label="計分方式" value={formatScoringMode(tournament.scoringMode)} />
              <Card label="參賽人數" value={String(tournament.playerCount)} />
              <Card label="場地" value={tournament.venue} />
            </div>

            <p className="mt-5 text-sm leading-7 text-white/64">
              {tournament.heroSummary}
            </p>

            <div className="mt-5 flex items-center justify-between text-xs tracking-[0.24em] text-white/42">
              <span>開始時間 {formatDate(tournament.startedAt)}</span>
              <span className="text-amber-200 transition group-hover:text-white">
                查看賽事
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs tracking-[0.22em] text-white/45">{label}</p>
      <p className="mt-2 text-sm text-white">{value}</p>
    </div>
  );
}
