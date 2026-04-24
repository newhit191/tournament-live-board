"use client";

import { useActionState, useMemo } from "react";

import {
  cancelChallengeAction,
  generateChallengeScheduleAction,
  joinChallengeAction,
  settleChallengeMatchAction,
  settlePrizePoolChallengeAction,
  settleSingleChallengeAction,
  type ArenaActionState,
} from "@/app/arena/actions";
import { parseArenaMatchMeta } from "@/lib/arena-schedule";
import type {
  ArenaChallenge,
  ArenaPlayer,
  ChallengeCompetitionFormat,
} from "@/lib/arena-types";

const initialState: ArenaActionState = {
  error: null,
  success: null,
};

type ParticipantOption = {
  playerId: string;
  displayName: string;
  lockedAmount: number;
};

type MatchView = {
  id: string;
  playerAId: string;
  playerBId: string;
  winnerPlayerId: string | null;
  status: "pending" | "completed" | "cancelled";
  round: number;
  matchOrder: number;
  stage: "regular" | "playoff";
  playerAScore: number | null;
  playerBScore: number | null;
  autoBye: boolean;
};

function isAutoScheduleFormat(format: ChallengeCompetitionFormat) {
  return format === "single_elimination" || format === "round_robin";
}

function getFormatLabel(format: ChallengeCompetitionFormat) {
  switch (format) {
    case "single_match":
      return "單場";
    case "manual_pool":
      return "手動名次";
    case "single_elimination":
      return "單淘汰";
    case "double_elimination":
      return "雙敗淘汰";
    case "round_robin":
      return "循環賽";
    default:
      return format;
  }
}

function getStageLabel(stage: "regular" | "playoff") {
  return stage === "playoff" ? "季後賽" : "例行賽";
}

function getMatchStatusLabel(status: "pending" | "completed" | "cancelled") {
  switch (status) {
    case "pending":
      return "待完成";
    case "completed":
      return "已完成";
    case "cancelled":
      return "已取消";
    default:
      return status;
  }
}

export function ArenaDetailControls({
  challenge,
  ownPlayers,
  canManage,
  viewerJoinedPlayerIds,
}: {
  challenge: ArenaChallenge;
  ownPlayers: ArenaPlayer[];
  canManage: boolean;
  viewerJoinedPlayerIds: string[];
}) {
  const [joinState, joinAction, joining] = useActionState(joinChallengeAction, initialState);
  const [cancelState, cancelAction, cancelling] = useActionState(cancelChallengeAction, initialState);
  const [singleState, settleSingleAction, settlingSingle] = useActionState(
    settleSingleChallengeAction,
    initialState,
  );
  const [poolState, settlePoolAction, settlingPool] = useActionState(
    settlePrizePoolChallengeAction,
    initialState,
  );
  const [scheduleState, generateScheduleAction, generatingSchedule] = useActionState(
    generateChallengeScheduleAction,
    initialState,
  );
  const [matchState, settleMatchAction, settlingMatch] = useActionState(
    settleChallengeMatchAction,
    initialState,
  );

  const participantOptions: ParticipantOption[] = challenge.participants.map((item) => ({
    playerId: item.playerId,
    displayName: item.player?.displayName ?? "未知玩家",
    lockedAmount: item.lockedAmount,
  }));

  const participantNameMap = useMemo(() => {
    const map = new Map<string, string>();
    challenge.participants.forEach((item) => {
      map.set(item.playerId, item.player?.displayName ?? "未知玩家");
    });
    return map;
  }, [challenge.participants]);

  const scheduleMatches = useMemo<MatchView[]>(() => {
    if (!isAutoScheduleFormat(challenge.competitionFormat)) {
      return [];
    }

    return challenge.matches
      .map((match) => {
        const meta = parseArenaMatchMeta(match.notes);
        return {
          id: match.id,
          playerAId: match.playerAId,
          playerBId: match.playerBId,
          winnerPlayerId: match.winnerPlayerId,
          status: match.status,
          round: meta?.round ?? 1,
          matchOrder: meta?.matchOrder ?? 1,
          stage: (meta?.stage ?? "regular") as "regular" | "playoff",
          playerAScore: meta?.player1Score ?? null,
          playerBScore: meta?.player2Score ?? null,
          autoBye: Boolean(meta?.autoBye),
        };
      })
      .sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round;
        if (a.stage !== b.stage) return a.stage === "regular" ? -1 : 1;
        return a.matchOrder - b.matchOrder;
      });
  }, [challenge.competitionFormat, challenge.matches]);

  const canJoin =
    challenge.status === "open" &&
    challenge.participants.length < challenge.participantLimit &&
    ownPlayers.some((player) => !viewerJoinedPlayerIds.includes(player.id));

  const joinablePlayers = ownPlayers.filter((player) => !viewerJoinedPlayerIds.includes(player.id));

  const shouldShowScheduleSection =
    challenge.mode === "prize_pool" &&
    (isAutoScheduleFormat(challenge.competitionFormat) || challenge.competitionFormat === "double_elimination");

  const shouldShowManualSettlement =
    challenge.mode === "prize_pool" &&
    (challenge.competitionFormat === "manual_pool" ||
      challenge.competitionFormat === "double_elimination");

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="panel rounded-[1.5rem] p-5">
        <p className="eyebrow text-cyan-200">參戰操作</p>
        <h2 className="mt-2 font-display text-3xl tracking-[0.08em] text-white">加入與管理</h2>

        {canJoin ? (
          <form action={joinAction} className="mt-4 space-y-4">
            <input type="hidden" name="challengeId" value={challenge.id} />
            <label className="block space-y-2">
              <span className="text-xs tracking-[0.24em] text-white/50">選擇玩家</span>
              <select
                name="playerId"
                required
                className="tlb-select w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none transition [color-scheme:dark] focus:border-cyan-300/40 sm:text-sm"
              >
                <option value="" className="bg-slate-900 text-white">
                  請選擇
                </option>
                {joinablePlayers.map((player) => (
                  <option key={player.id} value={player.id} className="bg-slate-900 text-white">
                    {player.displayName}（可用 {player.balance} / 鎖定 {player.lockedBalance}）
                  </option>
                ))}
              </select>
            </label>

            {challenge.mode === "single_stake" ? (
              <label className="block space-y-2">
                <span className="text-xs tracking-[0.24em] text-white/50">這場要押的星星</span>
                <input
                  type="number"
                  name="stake"
                  min={0}
                  defaultValue={1}
                  className="w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none transition focus:border-cyan-300/40 sm:text-sm"
                />
              </label>
            ) : (
              <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75">
                此場為多人獎池，加入時會鎖定每位參賽費 {challenge.entryFee} 顆。
              </p>
            )}

            <StatusMessage state={joinState} />

            <button
              type="submit"
              disabled={joining}
              className="rounded-full border border-amber-300/30 bg-amber-300/14 px-5 py-2.5 text-sm tracking-[0.2em] text-amber-100 transition hover:bg-amber-300/22 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {joining ? "加入中..." : "加入對戰"}
            </button>
          </form>
        ) : (
          <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/68">
            目前無法加入。可能原因：名額已滿、你已經用該帳號玩家參戰，或賽事已進入結算。
          </p>
        )}

        {canManage && challenge.status !== "completed" && challenge.status !== "cancelled" ? (
          <form action={cancelAction} className="mt-6 space-y-3 border-t border-white/10 pt-5">
            <input type="hidden" name="challengeId" value={challenge.id} />
            <label className="block space-y-2">
              <span className="text-xs tracking-[0.24em] text-white/50">取消原因</span>
              <input
                name="reason"
                placeholder="例如：場地臨時關閉"
                className="w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none transition placeholder:text-white/28 focus:border-red-300/40 sm:text-sm"
              />
            </label>
            <StatusMessage state={cancelState} />
            <button
              type="submit"
              disabled={cancelling}
              className="rounded-full border border-red-300/30 bg-red-300/12 px-5 py-2.5 text-sm tracking-[0.2em] text-red-100 transition hover:bg-red-300/18 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {cancelling ? "取消中..." : "取消對戰"}
            </button>
          </form>
        ) : null}
      </section>

      <section className="panel rounded-[1.5rem] p-5">
        <p className="eyebrow text-amber-200">完賽結算</p>
        <h2 className="mt-2 font-display text-3xl tracking-[0.08em] text-white">指定結果</h2>

        {!canManage ? (
          <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/65">
            只有主辦方或 GM/admin 可以進行結算。
          </p>
        ) : null}

        {canManage && challenge.mode === "single_stake" ? (
          <form action={settleSingleAction} className="mt-4 space-y-4">
            <input type="hidden" name="challengeId" value={challenge.id} />
            <label className="block space-y-2">
              <span className="text-xs tracking-[0.24em] text-white/50">勝方玩家</span>
              <select
                name="winnerPlayerId"
                required
                className="tlb-select w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none transition [color-scheme:dark] focus:border-amber-300/40 sm:text-sm"
              >
                <option value="" className="bg-slate-900 text-white">
                  請選擇
                </option>
                {participantOptions.map((item) => (
                  <option key={item.playerId} value={item.playerId} className="bg-slate-900 text-white">
                    {item.displayName}
                  </option>
                ))}
              </select>
            </label>
            <StatusMessage state={singleState} />
            <button
              type="submit"
              disabled={settlingSingle || challenge.participants.length < 2}
              className="rounded-full border border-amber-300/30 bg-amber-300/14 px-5 py-2.5 text-sm tracking-[0.2em] text-amber-100 transition hover:bg-amber-300/22 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {settlingSingle ? "結算中..." : "結算單場對賭"}
            </button>
          </form>
        ) : null}

        {canManage && shouldShowManualSettlement ? (
          <form action={settlePoolAction} className="mt-4 space-y-4">
            <input type="hidden" name="challengeId" value={challenge.id} />

            <div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">
              目前賽制：{getFormatLabel(challenge.competitionFormat)}。
              {challenge.competitionFormat === "manual_pool"
                ? "請直接指定名次結算。"
                : "雙敗淘汰目前先以手動名次結算。"}
            </div>

            <PlayerRankSelect
              name="firstPlayerId"
              label={`第一名（+${challenge.rewardFirst}）`}
              options={participantOptions}
            />
            <PlayerRankSelect
              name="secondPlayerId"
              label={`第二名（+${challenge.rewardSecond}）`}
              options={participantOptions}
            />
            {challenge.participants.length >= 3 ? (
              <PlayerRankSelect
                name="thirdPlayerId"
                label={`第三名（+${challenge.rewardThird}）`}
                options={participantOptions}
                allowEmpty={challenge.rewardThird <= 0}
              />
            ) : null}
            <StatusMessage state={poolState} />
            <button
              type="submit"
              disabled={settlingPool || challenge.participants.length < 2}
              className="rounded-full border border-amber-300/30 bg-amber-300/14 px-5 py-2.5 text-sm tracking-[0.2em] text-amber-100 transition hover:bg-amber-300/22 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {settlingPool ? "結算中..." : "結算多人獎池"}
            </button>
          </form>
        ) : null}
      </section>

      {shouldShowScheduleSection ? (
        <section className="panel rounded-[1.5rem] p-5 xl:col-span-2">
          <p className="eyebrow text-cyan-200">賽程控制</p>
          <h2 className="mt-2 font-display text-3xl tracking-[0.08em] text-white">
            {getFormatLabel(challenge.competitionFormat)}賽程
          </h2>

          {challenge.competitionFormat === "double_elimination" ? (
            <p className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
              雙敗淘汰自動賽程即將上線，現階段先在上方使用手動名次結算。
            </p>
          ) : null}

          {challenge.competitionFormat !== "double_elimination" ? (
            <>
              {canManage && scheduleMatches.length === 0 ? (
                <form action={generateScheduleAction} className="mt-4 space-y-3">
                  <input type="hidden" name="challengeId" value={challenge.id} />
                  <p className="text-sm text-white/70">
                    目前尚未生成賽程。按下後會依照目前參賽名單建立場次。
                  </p>
                  <StatusMessage state={scheduleState} />
                  <button
                    type="submit"
                    disabled={generatingSchedule}
                    className="rounded-full border border-cyan-300/35 bg-cyan-300/14 px-5 py-2.5 text-sm tracking-[0.2em] text-cyan-100 transition hover:bg-cyan-300/22 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {generatingSchedule ? "建立中..." : "產生賽程"}
                  </button>
                </form>
              ) : null}

              {scheduleMatches.length > 0 ? (
                <div className="mt-4 space-y-4">
                  <StatusMessage state={matchState} />
                  <div className="grid gap-3 md:grid-cols-2">
                    {scheduleMatches.map((match) => {
                      const playerAName = participantNameMap.get(match.playerAId) ?? "玩家 A";
                      const playerBName = participantNameMap.get(match.playerBId) ?? "玩家 B";
                      const winnerName = match.winnerPlayerId
                        ? participantNameMap.get(match.winnerPlayerId) ?? "未知玩家"
                        : null;

                      return (
                        <article
                          key={match.id}
                          className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs tracking-[0.2em] text-white/52">
                              第 {match.round} 輪 / 場次 {match.matchOrder} / {getStageLabel(match.stage)}
                            </p>
                            <span className="rounded-full border border-white/16 px-2 py-0.5 text-xs text-white/72">
                              {getMatchStatusLabel(match.status)}
                            </span>
                          </div>

                          <div className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-lg text-white">{playerAName}</p>
                              <p className="font-display text-2xl text-amber-100">
                                {match.playerAScore ?? "-"}
                              </p>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-lg text-white">{playerBName}</p>
                              <p className="font-display text-2xl text-cyan-100">
                                {match.playerBScore ?? "-"}
                              </p>
                            </div>
                          </div>

                          {match.autoBye ? (
                            <p className="mt-2 text-xs text-amber-100/90">此場為輪空自動晉級。</p>
                          ) : null}
                          {winnerName ? (
                            <p className="mt-2 text-sm text-emerald-100">勝方：{winnerName}</p>
                          ) : null}

                          {canManage && match.status === "pending" ? (
                            <form action={settleMatchAction} className="mt-3 space-y-3">
                              <input type="hidden" name="challengeId" value={challenge.id} />
                              <input type="hidden" name="matchId" value={match.id} />

                              <label className="block space-y-2">
                                <span className="text-xs tracking-[0.2em] text-white/50">勝方玩家</span>
                                <select
                                  name="winnerPlayerId"
                                  defaultValue={match.playerAId}
                                  className="tlb-select w-full rounded-2xl border border-white/12 bg-white/[0.05] px-3 py-2 text-base text-white outline-none transition [color-scheme:dark] focus:border-amber-300/40 sm:text-sm"
                                >
                                  <option value={match.playerAId} className="bg-slate-900 text-white">
                                    {playerAName}
                                  </option>
                                  <option value={match.playerBId} className="bg-slate-900 text-white">
                                    {playerBName}
                                  </option>
                                </select>
                              </label>

                              <div className="grid grid-cols-2 gap-2">
                                <label className="block space-y-1">
                                  <span className="text-xs text-white/50">{playerAName} 分數</span>
                                  <input
                                    name="playerAScore"
                                    type="number"
                                    min={0}
                                    max={999}
                                    defaultValue={match.playerAScore ?? undefined}
                                    className="w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-base text-white outline-none transition focus:border-amber-300/40 sm:text-sm"
                                  />
                                </label>
                                <label className="block space-y-1">
                                  <span className="text-xs text-white/50">{playerBName} 分數</span>
                                  <input
                                    name="playerBScore"
                                    type="number"
                                    min={0}
                                    max={999}
                                    defaultValue={match.playerBScore ?? undefined}
                                    className="w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-base text-white outline-none transition focus:border-amber-300/40 sm:text-sm"
                                  />
                                </label>
                              </div>

                              <button
                                type="submit"
                                disabled={settlingMatch}
                                className="rounded-full border border-amber-300/30 bg-amber-300/14 px-4 py-2 text-xs tracking-[0.18em] text-amber-100 transition hover:bg-amber-300/22 disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                {settlingMatch ? "送出中..." : "登記結果"}
                              </button>
                            </form>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function PlayerRankSelect({
  name,
  label,
  options,
  allowEmpty = false,
}: {
  name: string;
  label: string;
  options: ParticipantOption[];
  allowEmpty?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs tracking-[0.24em] text-white/50">{label}</span>
      <select
        name={name}
        required={!allowEmpty}
        defaultValue=""
        className="tlb-select w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none transition [color-scheme:dark] focus:border-amber-300/40 sm:text-sm"
      >
        <option value="" className="bg-slate-900 text-white">
          {allowEmpty ? "不指定" : "請選擇"}
        </option>
        {options.map((item) => (
          <option key={item.playerId} value={item.playerId} className="bg-slate-900 text-white">
            {item.displayName}（鎖定 {item.lockedAmount}）
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusMessage({ state }: { state: ArenaActionState }) {
  if (state.error) {
    return (
      <p className="rounded-2xl border border-red-300/30 bg-red-300/10 px-4 py-2.5 text-sm text-red-100">
        {state.error}
      </p>
    );
  }

  if (state.success) {
    return (
      <p className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-2.5 text-sm text-emerald-100">
        {state.success}
      </p>
    );
  }

  return null;
}
