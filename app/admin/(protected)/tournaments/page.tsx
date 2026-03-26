import Link from "next/link";

import { CreateTournamentForm } from "@/app/admin/(protected)/tournaments/create-tournament-form";
import { formatDate, getStatusClasses } from "@/lib/formatters";
import {
  formatDataSource,
  formatScoringMode,
  formatScoringRule,
  formatTournamentFormat,
  formatTournamentStatus,
} from "@/lib/tournament-labels";
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
          <p className="eyebrow text-amber-200">控制台總覽</p>
          <h2 className="mt-3 max-w-3xl break-words font-display text-3xl leading-tight tracking-[0.05em] text-white sm:text-4xl lg:text-5xl">
            管理賽事、確認資料來源與系統狀態
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-white/68">
            這裡會顯示目前資料來源、後台密碼設定狀態，以及可進一步管理的賽事列表。
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatusCard label="資料來源" value={formatDataSource(setup.dataSource)} />
            <StatusCard
              label="Spreadsheet"
              value={setup.spreadsheetId ?? "尚未設定"}
              wrap
            />
            <StatusCard
              label="後台密碼"
              value={setup.adminPasswordConfigured ? "已設定" : "尚未設定"}
            />
          </div>
        </div>

        <div className="panel rounded-[2rem] p-5 sm:p-6">
          <p className="eyebrow text-cyan-200">快速建立賽事</p>
          <CreateTournamentForm />
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow text-white/55">賽事列表</p>
            <h2 className="mt-2 font-display text-3xl tracking-[0.06em] text-white sm:text-4xl">
              目前可管理的賽事
            </h2>
          </div>
          <span className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-xs tracking-[0.24em] text-white/72">
            共 {tournaments.length} 場
          </span>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {tournaments.map((tournament) => (
            <Link
              key={tournament.id}
              href={`/admin/tournaments/${tournament.id}`}
              className="panel rounded-[1.75rem] p-5 transition hover:-translate-y-1 sm:p-6"
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
                <MetaCard label="賽制" value={formatTournamentFormat(tournament.format)} />
                <MetaCard label="計分方式" value={formatScoringMode(tournament.scoringMode)} />
                <MetaCard label="參賽者" value={tournament.playerCount.toString()} />
                <MetaCard label="開始時間" value={formatDate(tournament.startedAt)} />
              </div>

              <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs tracking-[0.22em] text-white/45">規則</p>
                <p className="mt-2 text-sm text-white">
                  {formatScoringRule(tournament)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function StatusCard({
  label,
  value,
  wrap = false,
}: {
  label: string;
  value: string;
  wrap?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-xs tracking-[0.24em] text-white/45">{label}</p>
      <p
        className={`mt-3 text-sm leading-6 text-white ${wrap ? "break-all" : "break-words"}`}
      >
        {value}
      </p>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs tracking-[0.22em] text-white/45">{label}</p>
      <p className="mt-2 text-sm text-white">{value}</p>
    </div>
  );
}
