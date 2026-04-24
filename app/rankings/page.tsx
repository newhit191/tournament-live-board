import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteNav } from "@/components/site-nav";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { loadLeaderboard } from "@/lib/arena-service";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "排行榜",
};

async function RankingsPageContent({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { scope: rawScope } = await searchParams;
  const scope = rawScope === "cross" ? "cross_family" : "overall";
  const [overallRows, crossRows] = await Promise.all([
    loadLeaderboard("overall"),
    loadLeaderboard("cross_family"),
  ]);
  const rows = scope === "cross_family" ? crossRows : overallRows;

  return (
    <div className="min-h-screen pb-24 safe-bottom-pad">
      <SiteNav />

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="panel-strong rounded-[2rem] p-6 sm:p-8">
          <p className="eyebrow text-amber-200">排行榜</p>
          <h1 className="mt-2 font-display text-4xl tracking-[0.08em] text-white sm:text-5xl">
            戰士排行榜
          </h1>
          <p className="mt-3 text-sm leading-7 text-white/70 sm:text-base">
            依據完賽結果、跨家庭勝場與現有星星綜合計分。你可以切換總榜與跨家庭榜檢視不同競爭面向。
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/rankings?scope=overall"
              className={`rounded-full border px-4 py-2 text-sm tracking-[0.2em] transition ${
                scope === "overall"
                  ? "border-amber-300/35 bg-amber-300/14 text-amber-100"
                  : "border-white/12 text-white/70 hover:bg-white/8"
              }`}
            >
              總榜
            </Link>
            <Link
              href="/rankings?scope=cross"
              className={`rounded-full border px-4 py-2 text-sm tracking-[0.2em] transition ${
                scope === "cross_family"
                  ? "border-cyan-300/35 bg-cyan-300/14 text-cyan-100"
                  : "border-white/12 text-white/70 hover:bg-white/8"
              }`}
            >
              跨家庭榜
            </Link>
          </div>
        </section>

        <section className="panel rounded-[1.75rem] p-5 sm:p-6">
          <div className="grid gap-3">
            {rows.map((entry) => (
              <article
                key={entry.player.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs tracking-[0.22em] text-white/45">#{entry.rank}</p>
                    <p className="mt-2 break-all font-display text-3xl tracking-[0.08em] text-white">
                      {entry.player.displayName}
                    </p>
                    <p className="mt-2 text-sm text-white/68">
                      {entry.equippedTitle ? `稱號：${entry.equippedTitle}` : "尚未佩戴稱號"}
                    </p>
                  </div>
                  <p className="rounded-full border border-amber-300/30 bg-amber-300/14 px-3 py-1 text-sm tracking-[0.16em] text-amber-100">
                    積分 {entry.points}
                  </p>
                </div>

                <div className="mt-3 grid gap-2 text-sm text-white/70 sm:grid-cols-4">
                  <p>勝場：{entry.wins}</p>
                  <p>敗場：{entry.losses}</p>
                  <p>總場次：{entry.totalMatches}</p>
                  <p>跨家庭勝場：{entry.crossFamilyWins}</p>
                </div>

                <p className="mt-3 text-sm text-white/65">
                  可用星星：{entry.player.balance} / 鎖定星星：{entry.player.lockedBalance}
                </p>
              </article>
            ))}
            {rows.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/65">
                目前還沒有可計算的排行榜資料。
              </p>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const config = getSupabaseConfig();
  if (!config.isReady || !config.isServiceReady) {
    return (
      <div className="min-h-screen pb-24 safe-bottom-pad">
        <SiteNav />
        <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <SupabaseSetupNotice
            title="排行榜尚未就緒"
            description="排行榜需要 Supabase 公開金鑰與 Service Role 金鑰，請先完成 Vercel 環境變數。"
            requireServiceRole
          />
        </main>
      </div>
    );
  }

  try {
    return await RankingsPageContent({ searchParams });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
    return (
      <div className="min-h-screen pb-24 safe-bottom-pad">
        <SiteNav />
        <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <SupabaseSetupNotice
            title="排行榜資料載入失敗"
            description="請確認 Supabase migration 已完成，並檢查 Vercel Runtime Logs。"
            requireServiceRole
            debugMessage={detail}
          />
        </main>
      </div>
    );
  }
}
