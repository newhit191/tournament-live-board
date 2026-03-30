import Link from "next/link";

import { SiteNav } from "@/components/site-nav";
import { formatDateTime, getStatusClasses } from "@/lib/formatters";
import {
  formatScoringRule,
  formatTournamentFormat,
  formatTournamentStatus,
} from "@/lib/tournament-labels";
import { getTournamentSummaries } from "@/lib/tournament-service";

export const dynamic = "force-dynamic";

export default async function Home() {
  const tournaments = await getTournamentSummaries();
  const liveTournament =
    tournaments.find((tournament) => tournament.status === "live") ??
    tournaments[0];
  const history = tournaments.filter((tournament) => tournament.status !== "live");

  return (
    <div className="min-h-screen pb-16">
      <SiteNav />

      <main className="mx-auto flex max-w-7xl flex-col gap-10 px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <section className="panel-strong score-rim grid gap-8 rounded-[2rem] px-6 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:py-12">
          <div className="space-y-6">
            <p className="eyebrow text-amber-200">賽事管理與即時展示平台</p>
            <div className="space-y-4">
              <h1 className="max-w-4xl break-words font-display text-[clamp(2.2rem,10vw,4.2rem)] leading-[1.02] tracking-[0.04em] text-white sm:tracking-[0.05em]">
                專業賽事資訊中樞
                <br />
                即時比分與賽程同步
                <br />
                主辦方操作一體化
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-white/72">
                專為 1 對 1 賽事打造，整合主辦方後台、公開展示頁與大螢幕模式，
                支援單淘汰、雙敗淘汰與循環賽，可將比賽資料固定寫入 Google Sheets。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={
                  liveTournament
                    ? `/tournaments/${liveTournament.slug}/display`
                    : "/tournaments"
                }
                className="rounded-full border border-amber-300/30 bg-amber-300/14 px-6 py-3 text-sm tracking-[0.24em] text-amber-100 transition hover:bg-amber-300/22"
              >
                開啟大螢幕展示
              </Link>
              <Link
                href="/admin/tournaments"
                className="rounded-full border border-white/14 bg-white/6 px-6 py-3 text-sm tracking-[0.24em] text-white/85 transition hover:bg-white/12"
              >
                進入主辦方後台
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[
                { label: "系統定位", value: "後台 + 公開展示頁" },
                { label: "操作人數", value: "1 到 2 人" },
                { label: "資料來源", value: "Google Sheets" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"
                >
                  <p className="text-xs tracking-[0.26em] text-white/45">{item.label}</p>
                  <p className="mt-3 font-display text-2xl tracking-[0.08em] text-white">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel rounded-[1.75rem] p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <p className="eyebrow text-cyan-200">目前主打賽事</p>
              {liveTournament ? (
                <span
                  className={`rounded-full border px-3 py-1 text-xs tracking-[0.24em] ${getStatusClasses(
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
                  <p className="text-sm tracking-[0.28em] text-white/45">
                    {liveTournament.heroKicker}
                  </p>
                  <h2 className="mt-2 break-words font-display text-3xl tracking-[0.06em] text-white sm:text-4xl sm:tracking-[0.08em]">
                    {liveTournament.name}
                  </h2>
                  <p className="mt-3 text-base leading-7 text-white/68">
                    {liveTournament.heroSummary}
                  </p>
                </div>

                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfoCard label="場地" value={liveTournament.venue} />
                  <InfoCard
                    label="賽制"
                    value={formatTournamentFormat(liveTournament.format)}
                  />
                  <InfoCard label="參賽人數" value={String(liveTournament.playerCount)} />
                  <InfoCard label="開始時間" value={formatDateTime(liveTournament.startedAt)} />
                </dl>

                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs tracking-[0.24em] text-white/45">計分規則</p>
                  <p className="mt-2 text-base text-white">
                    {formatScoringRule(liveTournament)}
                  </p>
                </div>

                <Link
                  href={`/tournaments/${liveTournament.slug}`}
                  className="inline-flex rounded-full border border-white/14 px-5 py-3 text-sm tracking-[0.24em] text-white/85 transition hover:bg-white/8"
                >
                  查看賽事詳情
                </Link>
              </div>
            ) : (
              <p className="mt-6 text-white/68">
                目前沒有進行中的賽事，建立新賽事後會出現在這裡。
              </p>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="panel rounded-[1.75rem] p-5 sm:p-6">
            <div>
              <p className="eyebrow text-white/55">操作流程</p>
              <h2 className="mt-2 font-display text-4xl tracking-[0.08em] text-white">
                從建立到展示一次完成
              </h2>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                "建立賽事與參賽名單，選擇賽制與計分方式。",
                "一鍵產生賽程，主辦方可指定目前公開展示場次。",
                "比賽中可逐局記錄分數，系統自動推進賽程與排名。",
                "公開頁同步更新即時比分、樹狀圖與完賽結果。",
              ].map((step, index) => (
                <div
                  key={step}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
                >
                  <p className="font-display text-4xl tracking-[0.08em] text-amber-200">
                    0{index + 1}
                  </p>
                  <p className="mt-3 text-base leading-7 text-white/72">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel rounded-[1.75rem] p-5 sm:p-6">
            <p className="eyebrow text-white/55">歷史賽事</p>
            <h2 className="mt-2 font-display text-4xl tracking-[0.08em] text-white">
              過往結果查詢
            </h2>

            <div className="mt-6 space-y-4">
              {history.slice(0, 3).map((tournament) => (
                <Link
                  key={tournament.id}
                  href={`/tournaments/${tournament.slug}`}
                  className="block rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 transition hover:border-white/18 hover:bg-white/[0.06]"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs tracking-[0.24em] text-white/45">
                        {tournament.heroKicker}
                      </p>
                      <h3 className="mt-2 font-display text-3xl tracking-[0.08em] text-white">
                        {tournament.name}
                      </h3>
                      <p className="mt-2 max-w-lg text-sm leading-7 text-white/64">
                        {tournament.heroSummary}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs tracking-[0.22em] ${getStatusClasses(
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <dt className="text-xs tracking-[0.24em] text-white/45">{label}</dt>
      <dd className="mt-2 text-lg text-white">{value}</dd>
    </div>
  );
}
