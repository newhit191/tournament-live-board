import Link from "next/link";

import { groupMatchesByRound } from "@/lib/score-utils";
import {
  formatMatchState,
  formatPlayerStatus,
  formatScoringRule,
} from "@/lib/tournament-labels";
import type { TournamentView } from "@/lib/tournament-types";

type TournamentStructureProps = {
  tournament: TournamentView;
  compact?: boolean;
  detailBasePath: string;
};

function createRoundSpacing(index: number, compact: boolean) {
  const cardHeight = compact ? 208 : 188;
  const baseGap = compact ? 18 : 20;
  const step = cardHeight + baseGap;

  if (index === 0) {
    return { marginTop: 0, gap: baseGap, cardHeight };
  }

  return {
    // Ensure each round card center aligns with the midpoint of two previous cards.
    marginTop: (step * (2 ** index - 1)) / 2,
    gap: step * 2 ** index - cardHeight,
    cardHeight,
  };
}

export function TournamentStructure({
  tournament,
  compact = false,
  detailBasePath,
}: TournamentStructureProps) {
  if (tournament.format === "single_elimination") {
    return (
      <SingleEliminationBracket
        tournament={tournament}
        compact={compact}
        detailBasePath={detailBasePath}
      />
    );
  }

  if (tournament.format === "double_elimination") {
    return (
      <DoubleEliminationBoard
        tournament={tournament}
        compact={compact}
        detailBasePath={detailBasePath}
      />
    );
  }

  return (
    <RoundRobinBoard
      tournament={tournament}
      compact={compact}
      detailBasePath={detailBasePath}
    />
  );
}

function getDoubleEliminationBracketType(matchId: string) {
  if (matchId.includes("-de-wb-")) {
    return "wb";
  }

  if (matchId.includes("-de-lb-")) {
    return "lb";
  }

  return "gf";
}

function DoubleEliminationBoard({
  tournament,
  compact = false,
  detailBasePath,
}: TournamentStructureProps) {
  const rounds = groupMatchesByRound(tournament.matches);
  const winnerRounds = rounds.filter((round) =>
    round.matches.some((match) => getDoubleEliminationBracketType(match.id) === "wb"),
  );
  const loserRounds = rounds.filter((round) =>
    round.matches.some((match) => getDoubleEliminationBracketType(match.id) === "lb"),
  );
  const grandRounds = rounds.filter((round) =>
    round.matches.some((match) => getDoubleEliminationBracketType(match.id) === "gf"),
  );

  return (
    <div className="space-y-6">
      <DoubleEliminationLane
        title="勝部賽程"
        rounds={winnerRounds}
        compact={compact}
        detailBasePath={detailBasePath}
        tournament={tournament}
      />
      <DoubleEliminationLane
        title="敗部賽程"
        rounds={loserRounds}
        compact={compact}
        detailBasePath={detailBasePath}
        tournament={tournament}
      />
      <DoubleEliminationLane
        title="總決賽"
        rounds={grandRounds}
        compact={compact}
        detailBasePath={detailBasePath}
        tournament={tournament}
      />
    </div>
  );
}

function DoubleEliminationLane({
  title,
  rounds,
  compact,
  detailBasePath,
  tournament,
}: {
  title: string;
  rounds: ReturnType<typeof groupMatchesByRound>;
  compact: boolean;
  detailBasePath: string;
  tournament: TournamentView;
}) {
  if (rounds.length === 0) {
    return null;
  }

  const columnWidthClass = compact ? "w-[220px] sm:w-[240px]" : "w-[280px]";
  const cardHeight = compact ? 208 : 188;
  const cardPadding = compact ? "px-4 py-4" : "px-4 py-4";

  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <p className="eyebrow text-cyan-200">{title}</p>
      <div className="mt-4 overflow-x-auto pb-3">
        <div className="flex min-w-max items-start gap-4 pr-4">
          {rounds.map((round) => (
            <div key={round.roundName} className={`${columnWidthClass} shrink-0`}>
              <div className="mb-4 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-center">
                <p className="font-display text-2xl tracking-[0.08em] text-white">
                  {round.roundName}
                </p>
                <p className="text-[11px] tracking-[0.22em] text-white/42">
                  {round.matches.length} 場對戰
                </p>
              </div>

              <div className="space-y-4">
                {round.matches.map((match) => {
                  const isCurrent = tournament.currentMatch?.id === match.id;

                  return (
                    <Link
                      key={match.id}
                      href={`${detailBasePath}/${match.id}`}
                      className={`group block overflow-hidden rounded-[1.5rem] border ${cardPadding} transition ${
                        isCurrent
                          ? "border-amber-300/35 bg-amber-300/10"
                          : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]"
                      }`}
                      style={{ minHeight: `${cardHeight}px` }}
                    >
                      <div className="flex h-full flex-col gap-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] tracking-[0.22em] text-white/42">
                            {match.scheduledLabel || "待安排"}
                          </span>
                          <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] tracking-[0.2em] text-white/58">
                            {formatMatchState(match.state)}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <BracketPlayerRow
                            name={match.player1.displayName}
                            score={match.player1Total}
                            isWinner={match.winnerId === match.player1.id}
                            compact={compact}
                          />
                          <BracketPlayerRow
                            name={match.player2.displayName}
                            score={match.player2Total}
                            isWinner={match.winnerId === match.player2.id}
                            compact={compact}
                          />
                        </div>

                        <p
                          className={`mt-auto text-[11px] tracking-[0.22em] ${
                            isCurrent
                              ? "text-amber-200"
                              : "text-white/32 transition group-hover:text-white/52"
                          }`}
                        >
                          {isCurrent ? "目前主舞台場次" : "點擊查看比分詳情"}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SingleEliminationBracket({
  tournament,
  compact = false,
  detailBasePath,
}: TournamentStructureProps) {
  const rounds = groupMatchesByRound(tournament.matches);
  const columnWidthClass = compact ? "w-[220px] sm:w-[240px]" : "w-[280px]";
  const columnGapClass = compact ? "gap-4" : "gap-6";

  return (
    <div className="overflow-x-auto pb-6">
      <div className={`flex min-w-max items-start pr-4 ${columnGapClass}`}>
        {rounds.map((round, index) => {
          const spacing = createRoundSpacing(index, compact);

          return (
            <div key={round.roundName} className={`${columnWidthClass} shrink-0`}>
              <div className="mb-4 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-center">
                <p className="font-display text-2xl tracking-[0.08em] text-white">
                  {round.roundName}
                </p>
                <p className="text-[11px] tracking-[0.22em] text-white/42">
                  {round.matches.length} 場對戰
                </p>
              </div>

              <div
                className="relative flex flex-col"
                style={{
                  marginTop: `${spacing.marginTop}px`,
                  rowGap: `${spacing.gap}px`,
                }}
              >
                {round.matches.map((match) => {
                  const isCurrent = tournament.currentMatch?.id === match.id;
                  const isLastRound = index === rounds.length - 1;

                  return (
                    <Link
                      key={match.id}
                      href={`${detailBasePath}/${match.id}`}
                      className={`group relative block overflow-hidden rounded-[1.5rem] border px-4 py-4 transition ${
                        isCurrent
                          ? "border-amber-300/35 bg-amber-300/10"
                          : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]"
                      }`}
                      style={{ minHeight: `${spacing.cardHeight}px` }}
                    >
                      {index > 0 ? (
                        <span className="absolute left-[-16px] top-1/2 h-px w-4 -translate-y-1/2 bg-white/14" />
                      ) : null}
                      {!isLastRound ? (
                        <span className="absolute right-[-16px] top-1/2 h-px w-4 -translate-y-1/2 bg-white/14" />
                      ) : null}

                      <div className="flex h-full flex-col gap-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] tracking-[0.22em] text-white/42">
                            {match.scheduledLabel || "待安排"}
                          </span>
                          <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] tracking-[0.2em] text-white/58">
                            {formatMatchState(match.state)}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <BracketPlayerRow
                            name={match.player1.displayName}
                            score={match.player1Total}
                            isWinner={match.winnerId === match.player1.id}
                            compact={compact}
                          />
                          <BracketPlayerRow
                            name={match.player2.displayName}
                            score={match.player2Total}
                            isWinner={match.winnerId === match.player2.id}
                            compact={compact}
                          />
                        </div>

                        <p
                          className={`mt-auto text-[11px] tracking-[0.22em] ${
                            isCurrent
                              ? "text-amber-200"
                              : "text-white/32 transition group-hover:text-white/52"
                          }`}
                        >
                          {isCurrent ? "目前主舞台場次" : "點擊查看比分詳情"}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BracketPlayerRow({
  name,
  score,
  isWinner,
  compact = false,
}: {
  name: string;
  score: number;
  isWinner: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[1fr_auto] items-center rounded-2xl border ${
        isWinner
          ? "border-amber-300/25 bg-amber-300/10"
          : "border-white/8 bg-black/20"
      } ${compact ? "gap-2 px-3 py-2.5" : "gap-3 px-3 py-3"}`}
    >
      <p
        className={`truncate font-display leading-tight text-white ${
          compact ? "text-[1.5rem] tracking-[0.03em]" : "text-2xl tracking-[0.05em]"
        }`}
      >
        {name}
      </p>
      <p
        className={`font-display text-white ${
          compact ? "text-[1.9rem] tracking-[0.05em]" : "text-3xl tracking-[0.08em]"
        }`}
      >
        {score}
      </p>
    </div>
  );
}

function RoundRobinBoard({
  tournament,
  compact = false,
  detailBasePath,
}: TournamentStructureProps) {
  const players = tournament.players;
  const matchesByPair = new Map<string, (typeof tournament.matches)[number]>();
  const rounds = groupMatchesByRound(tournament.matches);

  for (const match of tournament.matches) {
    const key = [match.player1.id, match.player2.id].sort().join("__");
    matchesByPair.set(key, match);
  }

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto">
        <table className="min-w-[720px] border-separate border-spacing-2">
          <thead>
            <tr>
              <th className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-xs tracking-[0.22em] text-white/45">
                對戰矩陣
              </th>
              {players.map((player) => (
                <th
                  key={player.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center font-display text-xl tracking-[0.06em] text-white"
                >
                  {player.displayName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((rowPlayer) => (
              <tr key={rowPlayer.id}>
                <th className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left font-display text-xl tracking-[0.06em] text-white">
                  {rowPlayer.displayName}
                </th>
                {players.map((columnPlayer) => {
                  if (rowPlayer.id === columnPlayer.id) {
                    return (
                      <td
                        key={columnPlayer.id}
                        className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-center text-xs tracking-[0.22em] text-white/25"
                      >
                        自身
                      </td>
                    );
                  }

                  const key = [rowPlayer.id, columnPlayer.id].sort().join("__");
                  const match = matchesByPair.get(key);

                  if (!match) {
                    return (
                      <td
                        key={columnPlayer.id}
                        className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-center text-xs tracking-[0.22em] text-white/25"
                      >
                        --
                      </td>
                    );
                  }

                  const rowIsPlayer1 = match.player1.id === rowPlayer.id;
                  const leftScore = rowIsPlayer1
                    ? match.player1Total
                    : match.player2Total;
                  const rightScore = rowIsPlayer1
                    ? match.player2Total
                    : match.player1Total;

                  return (
                    <td key={columnPlayer.id} className="align-top">
                      <Link
                        href={`${detailBasePath}/${match.id}`}
                        className={`block rounded-2xl border px-3 py-3 text-center transition ${
                          tournament.currentMatch?.id === match.id
                            ? "border-amber-300/35 bg-amber-300/10"
                            : "border-white/10 bg-white/[0.04] hover:border-white/18"
                        }`}
                      >
                        <p className="font-display text-2xl tracking-[0.06em] text-white">
                          {leftScore}:{rightScore}
                        </p>
                        <p className="mt-1 text-[10px] tracking-[0.2em] text-white/42">
                          {formatMatchState(match.state)}
                        </p>
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!compact ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="eyebrow text-cyan-200">輪次對戰表</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {rounds.map((round) => (
                <div
                  key={round.roundName}
                  className="rounded-3xl border border-white/10 bg-black/20 p-4"
                >
                  <p className="font-display text-3xl tracking-[0.08em] text-white">
                    {round.roundName}
                  </p>
                  <div className="mt-4 space-y-3">
                    {round.matches.map((match) => (
                      <Link
                        key={match.id}
                        href={`${detailBasePath}/${match.id}`}
                        className="block rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 transition hover:border-white/18"
                      >
                        <p className="font-display text-2xl tracking-[0.06em] text-white">
                          {match.player1.displayName}
                          <span className="mx-2 text-white/25">vs</span>
                          {match.player2.displayName}
                        </p>
                        <p className="mt-2 text-xs tracking-[0.22em] text-white/42">
                          {match.scheduledLabel}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="eyebrow text-amber-200">排行榜</p>
            <p className="mt-2 text-sm text-white/55">
              {formatScoringRule({
                scoringMode: tournament.scoringMode,
                targetScore: tournament.targetScore,
                setCount: tournament.setCount,
              })}
            </p>
            <div className="mt-4 space-y-3">
              {tournament.standings.map((standing) => (
                <div
                  key={standing.playerId}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-3xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <p className="font-display text-3xl tracking-[0.08em] text-amber-200">
                    {standing.rank}
                  </p>
                  <div>
                    <p className="font-display text-2xl tracking-[0.06em] text-white">
                      {standing.player.displayName}
                    </p>
                    <p className="text-xs tracking-[0.22em] text-white/42">
                      {standing.wins} 勝 / {standing.losses} 敗
                    </p>
                  </div>
                  <div className="text-right text-sm text-white/72">
                    <p>{standing.pointsFor} 得分</p>
                    <p>{standing.pointDiff} 分差</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {compact ? (
        <div className="grid gap-3 md:grid-cols-3">
          {tournament.standings.slice(0, 3).map((standing) => (
            <div
              key={standing.playerId}
              className="rounded-3xl border border-white/10 bg-black/20 px-4 py-3"
            >
              <p className="text-xs tracking-[0.22em] text-white/42">第 {standing.rank} 名</p>
              <p className="mt-2 font-display text-2xl tracking-[0.06em] text-white">
                {standing.player.displayName}
              </p>
              <p className="mt-1 text-xs tracking-[0.2em] text-white/42">
                {standing.wins} 勝 / {standing.losses} 敗 / {standing.pointsFor} 分
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {players.map((player) => (
          <div
            key={player.id}
            className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-3"
          >
            <p className="font-display text-2xl tracking-[0.06em] text-white">
              {player.displayName}
            </p>
            <p className="mt-1 text-xs tracking-[0.2em] text-white/42">
              {formatPlayerStatus(player.status)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
