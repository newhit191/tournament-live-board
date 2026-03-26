import Link from "next/link";
import { notFound } from "next/navigation";

import { setCurrentMatchAction } from "@/app/admin/actions";
import { PlayerAvatar } from "@/components/player-avatar";
import { formatDateTime, getStatusClasses } from "@/lib/formatters";
import {
  formatPlayerStatus,
  formatScoringMode,
  formatScoringRule,
  formatTournamentStatus,
} from "@/lib/tournament-labels";
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
          <div className="min-w-0">
            <p className="eyebrow text-amber-200">賽事控制台</p>
            <h2 className="mt-3 break-words font-display text-3xl tracking-[0.06em] text-white sm:text-4xl lg:text-5xl">
              {tournament.name}
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-8 text-white/68">
              這裡可查看參賽名單、切換目前展示中的場次，並進入各場比賽控制頁更新比分。
            </p>
          </div>

          <span
            className={`rounded-full border px-4 py-2 text-xs tracking-[0.24em] ${getStatusClasses(
              tournament.status,
            )}`}
          >
            {formatTournamentStatus(tournament.status)}
          </span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <PanelInfo label="場地" value={tournament.venue} />
          <PanelInfo label="計分方式" value={formatScoringMode(tournament.scoringMode)} />
          <PanelInfo label="規則" value={formatScoringRule(tournament)} compact />
          <PanelInfo
            label="目前展示場次"
            value={tournament.currentMatch?.player1.displayName ?? "尚未指定"}
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <div className="panel rounded-[1.75rem] p-6">
            <p className="eyebrow text-cyan-200">參賽者名單</p>
            <div className="mt-5 grid gap-3">
              {tournament.players.map((player) => (
                <div
                  key={player.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <PlayerAvatar name={player.displayName} sizeClassName="h-11 w-11" />
                    <div className="min-w-0">
                      <p className="truncate font-display text-2xl tracking-[0.08em] text-white">
                        {player.displayName}
                      </p>
                      <p className="text-xs tracking-[0.22em] text-white/42">
                        種子序 {player.seed ?? "-"}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs tracking-[0.22em] text-white/42">
                    {formatPlayerStatus(player.status)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel rounded-[1.75rem] p-6">
            <p className="eyebrow text-white/55">資料寫入說明</p>
            <div className="mt-5 space-y-3 text-sm leading-7 text-white/72">
              {[
                "指定主舞台場次時，會更新 tournaments.current_match_id 與 matches.is_featured。",
                "比分更新會同步寫入 matches、match_sets、standings 與 event_log。",
                "目標分制達標會自動完賽；分局加總制在固定局數完成後自動結算。",
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
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="eyebrow text-white/55">場次列表</p>
              <h3 className="mt-2 font-display text-4xl tracking-[0.08em] text-white">
                準備進入比分管理
              </h3>
            </div>
            {tournament.currentMatch ? (
              <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-xs tracking-[0.24em] text-amber-100">
                目前展示：{tournament.currentMatch.player1.displayName}
              </span>
            ) : null}
          </div>

          <div className="mt-5 space-y-3">
            {tournament.matches.map((match) => (
              <div
                key={match.id}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/tournaments/${tournament.id}/matches/${match.id}`}
                      className="block transition hover:opacity-85"
                    >
                      <p className="truncate font-display text-2xl tracking-[0.08em] text-white">
                        {match.player1.displayName}
                        <span className="mx-2 text-white/25">vs</span>
                        {match.player2.displayName}
                      </p>
                      <p className="mt-2 text-xs tracking-[0.22em] text-white/42">
                        {match.roundName} / {match.scheduledLabel}
                      </p>
                    </Link>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="font-display text-4xl tracking-[0.1em] text-amber-200">
                      {match.player1Total}
                      <span className="mx-2 text-white/25">:</span>
                      {match.player2Total}
                    </p>
                    <p className="mt-2 text-xs tracking-[0.22em] text-white/42">
                      更新於 {formatDateTime(match.updatedAt)}
                    </p>
                    <form action={setCurrentMatchAction} className="mt-3">
                      <input type="hidden" name="tournamentId" value={tournament.id} />
                      <input type="hidden" name="matchId" value={match.id} />
                      <button
                        type="submit"
                        className={`rounded-full border px-3 py-2 text-[11px] tracking-[0.22em] ${
                          tournament.currentMatch?.id === match.id
                            ? "border-amber-300/30 bg-amber-300/12 text-amber-100"
                            : "border-white/12 bg-white/[0.04] text-white/72"
                        }`}
                      >
                        {tournament.currentMatch?.id === match.id
                          ? "目前展示中"
                          : "設為主舞台"}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function PanelInfo({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-xs tracking-[0.24em] text-white/45">{label}</p>
      <p className={`mt-2 text-white ${compact ? "text-sm leading-6" : "text-lg"}`}>
        {value}
      </p>
    </div>
  );
}
