"use client";

import { useState } from "react";

import { createTournamentAction } from "@/app/admin/actions";

const DEFAULT_PLAYER_COUNT = 8;

function createDefaultNames(count: number) {
  return Array.from({ length: count }, (_, index) => `選手 ${index + 1}`);
}

export function CreateTournamentForm() {
  const [scoringMode, setScoringMode] = useState<"target_score" | "set_total">(
    "target_score",
  );
  const [playerCount, setPlayerCount] = useState(DEFAULT_PLAYER_COUNT);
  const [playerNames, setPlayerNames] = useState<string[]>(
    createDefaultNames(DEFAULT_PLAYER_COUNT),
  );

  const handlePlayerCountChange = (nextCount: number) => {
    const normalizedCount = Math.max(2, Math.min(64, nextCount || 2));

    setPlayerCount(normalizedCount);
    setPlayerNames((current) =>
      Array.from(
        { length: normalizedCount },
        (_, index) => current[index] ?? `選手 ${index + 1}`,
      ),
    );
  };

  return (
    <form action={createTournamentAction} className="mt-5 grid gap-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="text-xs tracking-[0.24em] text-white/45">
          賽事名稱
          <input
            name="name"
            required
            className="mt-2 w-full rounded-3xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none"
            placeholder="例如：春季戰鬥陀螺公開賽"
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs tracking-[0.24em] text-white/45">
          賽制
          <select
            name="format"
            defaultValue="single_elimination"
            className="mt-2 w-full rounded-3xl border border-white/12 bg-slate-900 px-4 py-3 text-base text-white outline-none"
          >
            <option value="single_elimination">單淘汰賽</option>
            <option value="double_elimination">雙敗淘汰賽（輸二淘汰）</option>
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
            <option value="set_total">分局加總制</option>
          </select>
        </label>

        <label className="text-xs tracking-[0.24em] text-white/45">
          參賽人數
          <input
            name="playerCount"
            type="number"
            min="2"
            max="64"
            value={playerCount}
            onChange={(event) =>
              handlePlayerCountChange(Number(event.target.value) || 2)
            }
            className="mt-2 w-full rounded-3xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none"
          />
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {scoringMode === "target_score" ? (
          <label className="text-xs tracking-[0.24em] text-white/45">
            勝利分數
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
            每場固定局數
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
            ? "目標分制不需要設定局數，任一方達到或超過勝利分數後，系統會自動結束該場比賽。"
            : "分局加總制會固定每場局數，全部局數完成後，以所有分局的總分判定勝負。"}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm tracking-[0.24em] text-cyan-200">參賽者名單</p>
            <p className="mt-2 text-sm text-white/60">
              先設定人數，再逐格輸入名稱。為了資安，系統不儲存任何選手照片。
            </p>
          </div>
          <label className="flex items-center gap-3 text-sm text-white/72">
            <input
              type="checkbox"
              name="randomize"
              defaultChecked
              className="h-4 w-4 rounded border-white/12 bg-white/[0.05]"
            />
            隨機排序對戰位置
          </label>
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
                  placeholder={`請輸入第 ${index + 1} 位選手名稱`}
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
