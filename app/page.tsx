import Link from "next/link";

import { SiteNav } from "@/components/site-nav";
import { formatTournamentStatus } from "@/lib/tournament-labels";
import { getTournamentSummaries } from "@/lib/tournament-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const tournaments = await getTournamentSummaries();
  const liveCount = tournaments.filter((item) => item.status === "live").length;
  const historyCount = tournaments.filter((item) => item.status !== "live").length;
  const latest = tournaments.slice(0, 3);

  return (
    <div className="min-h-screen pb-24 safe-bottom-pad">
      <SiteNav />

      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="panel-strong score-rim rounded-[2rem] px-6 py-8 sm:px-8">
          <p className="eyebrow text-amber-200">Beyblade 社群競技平台</p>
          <h1 className="mt-3 max-w-5xl font-display text-[clamp(2.2rem,8vw,4.8rem)] leading-[1.02] tracking-[0.04em] text-white">
            一個帳號管理全家玩家
            <br />
            即時對戰、星星結算、排行同步
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-white/72 sm:text-lg">
            支援直接註冊、家庭多玩家、GM 補星與不可逆帳本。你可以用同一支手機，帶著自己和小孩一起參賽，且每位玩家都有獨立戰績與星星資產。
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/auth"
              className="rounded-full border border-amber-300/30 bg-amber-300/14 px-6 py-3 text-sm tracking-[0.24em] text-amber-100 transition hover:bg-amber-300/22"
            >
              註冊 / 登入
            </Link>
            <Link
              href="/hub"
              className="rounded-full border border-white/14 bg-white/6 px-6 py-3 text-sm tracking-[0.24em] text-white/85 transition hover:bg-white/12"
            >
              前往玩家中心
            </Link>
            <Link
              href="/arena"
              className="rounded-full border border-white/14 bg-white/6 px-6 py-3 text-sm tracking-[0.24em] text-white/85 transition hover:bg-white/12"
            >
              開啟約戰看板
            </Link>
            <Link
              href="/rankings"
              className="rounded-full border border-white/14 bg-white/6 px-6 py-3 text-sm tracking-[0.24em] text-white/85 transition hover:bg-white/12"
            >
              查看排行榜
            </Link>
            <Link
              href="/tournaments"
              className="rounded-full border border-white/14 bg-white/6 px-6 py-3 text-sm tracking-[0.24em] text-white/85 transition hover:bg-white/12"
            >
              查看賽事列表
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard label="進行中賽事" value={`${liveCount}`} hint="可指定主舞台展示" />
          <StatCard label="歷史賽事" value={`${historyCount}`} hint="可回看結果與紀錄" />
          <StatCard label="帳號系統" value="直接註冊制" hint="Email + 密碼登入" />
        </section>

        <section className="panel rounded-[1.75rem] p-5 sm:p-6">
          <p className="eyebrow text-white/60">近期賽事</p>
          <h2 className="mt-2 font-display text-4xl tracking-[0.08em] text-white">快速入口</h2>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {latest.length > 0 ? (
              latest.map((item) => (
                <Link
                  key={item.id}
                  href={`/tournaments/${item.slug}`}
                  className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 transition hover:bg-white/[0.08]"
                >
                  <p className="text-xs tracking-[0.22em] text-white/45">{item.heroKicker}</p>
                  <h3 className="mt-2 line-clamp-2 font-display text-3xl tracking-[0.08em] text-white">
                    {item.name}
                  </h3>
                  <p className="mt-3 text-sm text-white/65">
                    {formatTournamentStatus(item.status)} / {item.playerCount} 人
                  </p>
                </Link>
              ))
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-sm text-white/70">
                目前沒有賽事資料，可從後台建立第一場比賽。
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="panel rounded-3xl p-4">
      <p className="text-xs tracking-[0.22em] text-white/45">{label}</p>
      <p className="mt-2 font-display text-4xl tracking-[0.08em] text-white">{value}</p>
      <p className="mt-2 text-sm text-white/65">{hint}</p>
    </article>
  );
}
