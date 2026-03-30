"use client";

import { useState } from "react";

import { createTournamentAction } from "@/app/admin/actions";
import type { TournamentFormat } from "@/lib/tournament-types";

const DEFAULT_PLAYER_COUNT = 8;
const MIN_PLAYER_COUNT = 2;
const MAX_PLAYER_COUNT = 64;

function isBracketFormat(format: TournamentFormat) {
  return format === "single_elimination" || format === "double_elimination";
}

function nextPowerOfTwo(value: number) {
  let current = 1;

  while (current < value) {
    current *= 2;
  }

  return current;
}

function createSeedOrder(bracketSize: number) {
  let order = [1, 2];

  while (order.length < bracketSize) {
    const nextSize = order.length * 2;
    const nextOrder: number[] = [];

    for (const seed of order) {
      nextOrder.push(seed, nextSize + 1 - seed);
    }

    order = nextOrder;
  }

  return order;
}

function createDefaultNames(count: number) {
  return Array.from({ length: count }, (_, index) => `選手 ${index + 1}`);
}

function normalizePlayerCount(nextCount: number, format: TournamentFormat) {
  const safeCount = Math.max(
    MIN_PLAYER_COUNT,
    Math.min(MAX_PLAYER_COUNT, Math.trunc(nextCount) || MIN_PLAYER_COUNT),
  );

  if (!isBracketFormat(format)) {
    return safeCount;
  }

  return safeCount % 2 === 0 ? safeCount : Math.min(MAX_PLAYER_COUNT, safeCount + 1);
}

function normalizeDisplayName(name: string, index: number) {
  return name.trim() || `選手 ${index + 1}`;
}

function buildEliminationPreview(playerNames: string[]) {
  const entrants = playerNames.map((name, index) => normalizeDisplayName(name, index));
  const bracketSize = nextPowerOfTwo(Math.max(2, entrants.length));
  const seededEntrants = Array.from({ length: bracketSize }, (_, index) =>
    entrants[index] ?? "輪空",
  );
  const slots = createSeedOrder(bracketSize).map((seed) => seededEntrants[seed - 1]);

  return Array.from({ length: bracketSize / 2 }, (_, index) => ({
    left: slots[index * 2],
    right: slots[index * 2 + 1],
  }));
}

function buildRoundRobinPreview(playerNames: string[]) {
  const entrants = playerNames.map((name, index) => normalizeDisplayName(name, index));
  const rotation = [...entrants];

  if (rotation.length % 2 === 1) {
    rotation.push("__bye__");
  }

  const pairs: Array<{ left: string; right: string }> = [];
  let byePlayer: string | null = null;

  for (let index = 0; index < rotation.length / 2; index += 1) {
    const left = rotation[index];
    const right = rotation[rotation.length - 1 - index];

    if (left === "__bye__" || right === "__bye__") {
      byePlayer = left === "__bye__" ? right : left;
      continue;
    }

    pairs.push({ left, right });
  }

  return { pairs, byePlayer };
}

function shuffleNames(names: string[]) {
  const next = [...names];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

export function CreateTournamentForm() {
  const [format, setFormat] = useState<TournamentFormat>("single_elimination");
  const [scoringMode, setScoringMode] = useState<"target_score" | "set_total">(
    "target_score",
  );
  const [playerCount, setPlayerCount] = useState(DEFAULT_PLAYER_COUNT);
  const [playerCountInput, setPlayerCountInput] = useState(
    String(DEFAULT_PLAYER_COUNT),
  );
  const [playerNames, setPlayerNames] = useState<string[]>(
    createDefaultNames(DEFAULT_PLAYER_COUNT),
  );

  const handlePlayerCountChange = (
    nextCount: number,
    options?: {
      syncInput?: boolean;
      formatOverride?: TournamentFormat;
    },
  ) => {
    const activeFormat = options?.formatOverride ?? format;
    const normalizedCount = normalizePlayerCount(nextCount, activeFormat);

    setPlayerCount(normalizedCount);
    if (options?.syncInput !== false) {
      setPlayerCountInput(String(normalizedCount));
    }

    setPlayerNames((current) =>
      Array.from(
        { length: normalizedCount },
        (_, index) => current[index] ?? `選手 ${index + 1}`,
      ),
    );
  };

  const handleFormatChange = (nextFormat: TournamentFormat) => {
    setFormat(nextFormat);
    handlePlayerCountChange(playerCount, { formatOverride: nextFormat });
  };

  const handleCountInputChange = (rawValue: string) => {
    setPlayerCountInput(rawValue);

    if (!rawValue.trim()) {
      return;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return;
    }

    handlePlayerCountChange(parsed, { syncInput: false });
  };

  const handleCountInputBlur = () => {
    if (!playerCountInput.trim()) {
      setPlayerCountInput(String(playerCount));
      return;
    }

    const parsed = Number(playerCountInput);
    handlePlayerCountChange(Number.isFinite(parsed) ? parsed : playerCount);
  };

  const rerollSeeding = () => {
    setPlayerNames((current) => shuffleNames(current));
  };

  const countStep = isBracketFormat(format) ? 2 : 1;
  const resolveStepperBaseCount = () => {
    const parsed = Number(playerCountInput);
    if (!Number.isFinite(parsed)) {
      return playerCount;
    }

    return normalizePlayerCount(parsed, format);
  };

  const bracketPreview =
    format === "round_robin"
      ? null
      : buildEliminationPreview(playerNames);
  const roundRobinPreview =
    format === "round_robin" ? buildRoundRobinPreview(playerNames) : null;

  return (
    <form action={createTournamentAction} className="mt-5 grid gap-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="text-xs tracking-[0.24em] text-white/45">
          賽事名稱
          <input
            name="name"
            required
            className="mt-2 w-full rounded-3xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none"
            placeholder="例如：城市盃春季賽"
          />
        </label>

        <label className="text-xs tracking-[0.24em] text-white/45">
          場地
          <input
            name="venue"
            className="mt-2 w-full rounded-3xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none"
            placeholder="例如：主舞台 / A 台"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className="text-xs tracking-[0.24em] text-white/45">
          賽制
          <select
            name="format"
            value={format}
            onChange={(event) =>
              handleFormatChange(
                event.target.value === "round_robin"
                  ? "round_robin"
                  : event.target.value === "double_elimination"
                    ? "double_elimination"
                    : "single_elimination",
              )
            }
            className="mt-2 w-full rounded-3xl border border-white/12 bg-slate-900 px-4 py-3 text-base text-white outline-none"
          >
            <option value="single_elimination">單淘汰賽</option>
            <option value="double_elimination">雙敗淘汰賽</option>
            <option value="round_robin">循環賽</option>
          </select>
        </label>

        <label className="text-xs tracking-[0.24em] text-white/45">
          狀態
          <select
            name="status"
            defaultValue="live"
            className="mt-2 w-full rounded-3xl border border-white/12 bg-slate-900 px-4 py-3 text-base text-white outline-none"
          >
            <option value="live">進行中</option>
            <option value="draft">草稿</option>
          </select>
        </label>

        <label className="text-xs tracking-[0.24em] text-white/45">
          計分方式
          <select
            name="scoringMode"
            value={scoringMode}
            onChange={(event) =>
              setScoringMode(
                event.target.value === "set_total" ? "set_total" : "target_score",
              )
            }
            className="mt-2 w-full rounded-3xl border border-white/12 bg-slate-900 px-4 py-3 text-base text-white outline-none"
          >
            <option value="target_score">目標分制</option>
            <option value="set_total">局數加總制</option>
          </select>
        </label>
      </div>

      <div className="max-w-2xl text-xs tracking-[0.24em] text-white/45">
        參賽人數
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              handlePlayerCountChange(resolveStepperBaseCount() - countStep)
            }
            className="touch-manipulation h-12 w-12 shrink-0 rounded-2xl border border-white/12 bg-white/[0.05] text-lg text-white transition hover:bg-white/[0.12]"
            aria-label="減少參賽人數"
          >
            -
          </button>

          <input
            name="playerCount"
            type="number"
            min={MIN_PLAYER_COUNT}
            max={MAX_PLAYER_COUNT}
            step={countStep}
            value={playerCountInput}
            inputMode="numeric"
            onChange={(event) => handleCountInputChange(event.target.value)}
            onBlur={handleCountInputBlur}
            className="h-12 min-w-[8rem] flex-1 rounded-2xl border border-white/12 bg-white/[0.05] px-4 text-center text-lg font-semibold text-white outline-none"
          />

          <button
            type="button"
            onClick={() =>
              handlePlayerCountChange(resolveStepperBaseCount() + countStep)
            }
            className="touch-manipulation h-12 w-12 shrink-0 rounded-2xl border border-white/12 bg-white/[0.05] text-lg text-white transition hover:bg-white/[0.12]"
            aria-label="增加參賽人數"
          >
            +
          </button>
        </div>
        {isBracketFormat(format) ? (
          <p className="mt-2 text-[11px] tracking-[0.08em] text-amber-200/85">
            淘汰賽與雙敗賽制會自動調整為偶數人數，並分散輪空避免 bye 對 bye。
          </p>
        ) : (
          <p className="mt-2 text-[11px] tracking-[0.08em] text-white/50">
            循環賽可自由輸入 2 到 64 人。
          </p>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {scoringMode === "target_score" ? (
          <label className="text-xs tracking-[0.24em] text-white/45">
            勝利門檻
            <input
              name="targetScore"
              type="number"
              min="1"
              defaultValue="4"
              className="mt-2 w-full rounded-3xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none"
            />
          </label>
        ) : (
          <label className="text-xs tracking-[0.24em] text-white/45">
            每場局數
            <input
              name="setCount"
              type="number"
              min="1"
              max="9"
              defaultValue="3"
              className="mt-2 w-full rounded-3xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none"
            />
          </label>
        )}

        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-white/70">
          {scoringMode === "target_score"
            ? "目標分制會累加每一局分數，任一方達到或超過門檻即自動結束該場。"
            : "局數加總制會打滿你設定的局數，最後以總分高者獲勝。"}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm tracking-[0.24em] text-cyan-200">參賽名單與抽籤</p>
            <p className="mt-2 text-sm text-white/60">
              可反覆按骰子重抽，直到你滿意對戰組合，再按建立。
            </p>
          </div>
          <button
            type="button"
            onClick={rerollSeeding}
            className="rounded-full border border-cyan-300/30 bg-cyan-300/12 px-4 py-2 text-xs tracking-[0.22em] text-cyan-100 transition hover:bg-cyan-300/20"
          >
            🎲 重新抽籤
          </button>
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs tracking-[0.22em] text-white/45">對戰預覽（建立前）</p>
          <div className="mt-3 grid gap-2">
            {format === "round_robin" && roundRobinPreview ? (
              <>
                {roundRobinPreview.pairs.map((pair, index) => (
                  <p key={`rr-preview-${index + 1}`} className="text-sm text-white/80">
                    第 1 輪 場次 {index + 1}：{pair.left}
                    <span className="mx-2 text-white/40">vs</span>
                    {pair.right}
                  </p>
                ))}
                {roundRobinPreview.byePlayer ? (
                  <p className="text-sm text-amber-200/85">
                    第 1 輪輪空：{roundRobinPreview.byePlayer}
                  </p>
                ) : null}
              </>
            ) : (
              bracketPreview?.map((pair, index) => (
                <p key={`bracket-preview-${index + 1}`} className="text-sm text-white/80">
                  首輪 場次 {index + 1}：{pair.left}
                  <span className="mx-2 text-white/40">vs</span>
                  {pair.right}
                </p>
              ))
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {playerNames.map((name, index) => (
            <div
              key={`player-${index + 1}`}
              className="rounded-3xl border border-white/10 bg-black/20 p-4"
            >
              <p className="text-xs tracking-[0.24em] text-white/45">選手 {index + 1}</p>

              <label className="mt-3 block text-xs tracking-[0.24em] text-white/45">
                名稱
                <input
                  name="playerNames"
                  value={name}
                  onChange={(event) =>
                    setPlayerNames((current) =>
                      current.map((entry, entryIndex) =>
                        entryIndex === index ? event.target.value : entry,
                      ),
                    )
                  }
                  className="mt-2 w-full rounded-3xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none"
                  placeholder={`請輸入選手 ${index + 1} 名稱`}
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      <button className="rounded-full border border-amber-300/30 bg-amber-300/14 px-5 py-4 text-sm tracking-[0.2em] text-amber-100 sm:tracking-[0.28em]">
        建立賽事並產生賽程
      </button>
    </form>
  );
}
