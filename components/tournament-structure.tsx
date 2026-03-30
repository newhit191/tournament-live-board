import Link from "next/link";

import { isRoundRobinPlayoffMatch } from "@/lib/schedule-generator";
import { groupMatchesByRound } from "@/lib/score-utils";
import {
  formatMatchState,
  formatPlayerStatus,
  formatScoringRule,
} from "@/lib/tournament-labels";
import type { ResolvedMatch, TournamentView } from "@/lib/tournament-types";

type TournamentStructureProps = {
  tournament: TournamentView;
  compact?: boolean;
  detailBasePath: string;
};

function createRoundSpacing(index: number, compact: boolean) {
  const cardHeight = compact ? 212 : 188;
  const baseGap = compact ? 18 : 22;
  const step = cardHeight + baseGap;

  if (index === 0) {
    return { marginTop: 0, gap: baseGap, cardHeight };
  }

  return {
    // Make each round card center align to the midpoint of its previous two feeder cards.
    marginTop: (step * (2 ** index - 1)) / 2,
    gap: step * 2 ** index - cardHeight,
    cardHeight,
  };
}

function formatPointRatio(pointsFor: number, pointsAgainst: number) {
  if (pointsAgainst === 0) {
    return pointsFor === 0 ? "0.000" : "∞";
  }

  return (pointsFor / pointsAgainst).toFixed(3);
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
        title="總冠軍戰"
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
  const cardHeight = compact ? 212 : 188;

  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <p className="eyebrow text-cyan-200">{title}</p>
      <div className="mt-4 overflow-x-auto pb-3">
        <div className="flex min-w-max items-start gap-4 pr-4">
          {rounds.map((round, roundIndex) => (
            <div key={round.roundName} className={`${columnWidthClass} shrink-0`}>
              <RoundHeader
                title={round.roundName}
                count={round.matches.length}
                compact={compact}
              />

              <div className="space-y-4">
                {round.matches.map((match) => (
                  <BracketMatchCard
                    key={match.id}
                    match={match}
                    href={`${detailBasePath}/${match.id}`}
                    isCurrent={tournament.currentMatch?.id === match.id}
                    compact={compact}
                    cardHeight={cardHeight}
                    showLeftConnector={roundIndex > 0}
                    showRightConnector={roundIndex < rounds.length - 1}
                  />
                ))}
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
          const isLastRound = index === rounds.length - 1;

          return (
            <div key={round.roundName} className={`${columnWidthClass} shrink-0`}>
              <RoundHeader
                title={round.roundName}
                count={round.matches.length}
                compact={compact}
              />

              <div
                className="relative flex flex-col"
                style={{
                  marginTop: `${spacing.marginTop}px`,
                  rowGap: `${spacing.gap}px`,
                }}
              >
                {round.matches.map((match) => {
                  const isCurrent = tournament.currentMatch?.id === match.id;

                  return (
                    <Link
                      key={match.id}
                      href={`${detailBasePath}/${match.id}`}
                      className={`group bracket-card-animate relative block overflow-hidden rounded-[1.5rem] border px-4 py-4 transition ${
                        isCurrent
                          ? "current-bracket-card border-amber-300/35 bg-amber-300/10"
                          : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]"
                      }`}
                      style={{ minHeight: `${spacing.cardHeight}px` }}
                    >
                      {index > 0 ? (
                        <span className="bracket-flow-line absolute left-[-24px] top-1/2 h-[2px] w-6 -translate-y-1/2" />
                      ) : null}
                      {!isLastRound ? (
                        <span className="bracket-flow-line absolute right-[-24px] top-1/2 h-[2px] w-6 -translate-y-1/2" />
                      ) : null}

                      <div className="flex h-full flex-col gap-3">
                        <MatchCardHeader match={match} />

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
                          {isCurrent ? "目前展示中的主舞台場次" : "點擊查看比分詳情"}
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

function RoundRobinBoard({
  tournament,
  compact = false,
  detailBasePath,
}: TournamentStructureProps) {
  const players = tournament.players;
  const regularMatches = tournament.matches.filter(
    (match) => !isRoundRobinPlayoffMatch(match),
  );
  const playoffMatches = tournament.matches
    .filter((match) => isRoundRobinPlayoffMatch(match))
    .toSorted((left, right) => left.roundOrder - right.roundOrder);
  const matchesByPair = new Map<string, (typeof tournament.matches)[number]>();
  const rounds = groupMatchesByRound(regularMatches);

  for (const match of regularMatches) {
    const key = [match.player1.id, match.player2.id].sort().join("__");
    matchesByPair.set(key, match);
  }

  return (
    <div className="space-y-5">
      {playoffMatches.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {playoffMatches.map((match) => (
            <Link
              key={match.id}
              href={`${detailBasePath}/${match.id}`}
              className={`rounded-3xl border px-4 py-4 transition ${
                tournament.currentMatch?.id === match.id
                  ? "border-amber-300/35 bg-amber-300/10"
                  : "border-white/10 bg-white/[0.04] hover:border-white/18"
              }`}
            >
              <p className="text-xs tracking-[0.22em] text-white/45">{match.roundName}</p>
              <p className="mt-2 font-display text-2xl tracking-[0.06em] text-white">
                {match.player1.displayName}
                <span className="mx-2 text-white/25">vs</span>
                {match.player2.displayName}
              </p>
              <p className="mt-2 font-display text-3xl tracking-[0.08em] text-amber-200">
                {match.player1Total}
                <span className="mx-2 text-white/25">:</span>
                {match.player2Total}
              </p>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-[760px] border-separate border-spacing-2">
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
                        自己
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
        <div className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="eyebrow text-cyan-200">循環賽輪次</p>
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
            <p className="eyebrow text-amber-200">排名與公平指標</p>
            <p className="mt-2 text-sm text-white/55">
              {formatScoringRule({
                scoringMode: tournament.scoringMode,
                targetScore: tournament.targetScore,
                setCount: tournament.setCount,
              })}
            </p>
            <p className="mt-2 text-xs text-white/45">
              排名判定順序：勝場 → 得失分差 → 得失分率（得分 / 失分）→ 總得分。
            </p>

            <div className="mt-4 space-y-3">
              {tournament.standings.map((standing) => (
                <div
                  key={standing.playerId}
                  className="rounded-3xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <div className="grid grid-cols-[auto_1fr] items-start gap-4">
                    <p className="font-display text-3xl tracking-[0.08em] text-amber-200">
                      {standing.rank}
                    </p>
                    <div>
                      <p className="font-display text-2xl tracking-[0.06em] text-white">
                        {standing.player.displayName}
                      </p>
                      <p className="text-xs tracking-[0.22em] text-white/42">
                        勝 {standing.wins} / 敗 {standing.losses}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/72">
                    <p>得分：{standing.pointsFor}</p>
                    <p>失分：{standing.pointsAgainst}</p>
                    <p>得失分差：{standing.pointDiff}</p>
                    <p>得失分率：{formatPointRatio(standing.pointsFor, standing.pointsAgainst)}</p>
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
                勝 {standing.wins} / 敗 {standing.losses} / 得失分差 {standing.pointDiff}
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

function RoundHeader({
  title,
  count,
  compact,
}: {
  title: string;
  count: number;
  compact: boolean;
}) {
  return (
    <div className="mb-4 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-center">
      <p
        className={`font-display text-white ${
          compact
            ? "text-[1.6rem] tracking-[0.06em]"
            : "text-2xl tracking-[0.08em]"
        }`}
      >
        {title}
      </p>
      <p className="text-[11px] tracking-[0.22em] text-white/42">{count} 場對戰</p>
    </div>
  );
}

function MatchCardHeader({ match }: { match: ResolvedMatch }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] tracking-[0.22em] text-white/42">
        {match.scheduledLabel || "待定"}
      </span>
      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] tracking-[0.2em] text-white/58">
        {formatMatchState(match.state)}
      </span>
    </div>
  );
}

function BracketMatchCard({
  match,
  href,
  isCurrent,
  compact,
  cardHeight,
  showLeftConnector = false,
  showRightConnector = false,
}: {
  match: ResolvedMatch;
  href: string;
  isCurrent: boolean;
  compact: boolean;
  cardHeight: number;
  showLeftConnector?: boolean;
  showRightConnector?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group bracket-card-animate block overflow-hidden rounded-[1.5rem] border px-4 py-4 transition ${
        isCurrent
          ? "current-bracket-card border-amber-300/35 bg-amber-300/10"
          : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]"
      }`}
      style={{ minHeight: `${cardHeight}px` }}
    >
      {showLeftConnector ? (
        <span className="bracket-flow-line absolute left-[-24px] top-1/2 h-[2px] w-6 -translate-y-1/2" />
      ) : null}
      {showRightConnector ? (
        <span className="bracket-flow-line absolute right-[-24px] top-1/2 h-[2px] w-6 -translate-y-1/2" />
      ) : null}

      <div className="flex h-full flex-col gap-3">
        <MatchCardHeader match={match} />

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
            isCurrent ? "text-amber-200" : "text-white/32 transition group-hover:text-white/52"
          }`}
        >
          {isCurrent ? "目前展示中的主舞台場次" : "點擊查看比分詳情"}
        </p>
      </div>
    </Link>
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
          ? "advance-glow border-amber-300/30 bg-amber-300/10"
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
