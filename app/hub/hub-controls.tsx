"use client";

import { useActionState, useMemo, useState } from "react";

import {
  createPlayerProfileAction,
  equipPlayerTitleAction,
  renamePlayerDisplayNameAction,
  transferFamilyStarsAction,
  type HubActionState,
} from "@/app/hub/actions";

type PlayerItem = {
  id: string;
  displayName: string;
  isChild: boolean;
  balance: number;
  lockedBalance: number;
  equippedTitle: string | null;
  unlockedTitles: { id: string; name: string }[];
};

const initialState: HubActionState = {
  error: null,
  success: null,
};

export function HubControls({ players }: { players: PlayerItem[] }) {
  const [createState, createAction, creating] = useActionState(
    createPlayerProfileAction,
    initialState,
  );
  const [renameState, renameAction, renaming] = useActionState(
    renamePlayerDisplayNameAction,
    initialState,
  );
  const [transferState, transferAction, transferring] = useActionState(
    transferFamilyStarsAction,
    initialState,
  );
  const [titleState, titleAction, titleUpdating] = useActionState(
    equipPlayerTitleAction,
    initialState,
  );

  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? null;
  const availableTitles = useMemo(() => selectedPlayer?.unlockedTitles ?? [], [selectedPlayer]);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="panel rounded-[1.5rem] p-5">
        <p className="eyebrow text-cyan-200">玩家管理</p>
        <h2 className="mt-2 font-display text-3xl tracking-[0.08em] text-white">建立新玩家</h2>
        <p className="mt-2 text-sm leading-7 text-white/65">
          你可以在同一個帳號底下建立多位玩家（例如小孩角色），之後在約戰與排行榜中都可分開計算。
        </p>

        <form action={createAction} className="mt-5 space-y-4">
          <label className="block space-y-2">
            <span className="text-xs tracking-[0.24em] text-white/50">玩家名稱</span>
            <input
              name="displayName"
              required
              placeholder="例如：小龍 / 阿哲"
              className="w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none transition placeholder:text-white/30 focus:border-cyan-300/40 sm:text-sm"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-white/78">
            <input
              type="checkbox"
              name="isChild"
              className="h-4 w-4 rounded border-white/20 bg-white/10"
            />
            這是小孩玩家
          </label>

          <StatusMessage state={createState} />

          <button
            type="submit"
            disabled={creating}
            className="rounded-full border border-cyan-300/35 bg-cyan-300/15 px-5 py-2.5 text-sm tracking-[0.2em] text-cyan-100 transition hover:bg-cyan-300/22 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {creating ? "建立中..." : "建立玩家"}
          </button>
        </form>
      </section>

      <section className="panel rounded-[1.5rem] p-5">
        <p className="eyebrow text-amber-200">玩家 ID</p>
        <h2 className="mt-2 font-display text-3xl tracking-[0.08em] text-white">修改玩家 ID</h2>
        <p className="mt-2 text-sm leading-7 text-white/65">
          登入後可自行修改玩家 ID。系統會檢查重複名稱，避免與其他玩家撞名。
        </p>

        <form action={renameAction} className="mt-5 space-y-4">
          <SelectField name="playerId" label="選擇玩家" players={players} />

          <label className="block space-y-2">
            <span className="text-xs tracking-[0.24em] text-white/50">新玩家 ID</span>
            <input
              name="displayName"
              required
              minLength={2}
              maxLength={24}
              placeholder="輸入新的玩家 ID"
              className="w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none transition placeholder:text-white/30 focus:border-amber-300/40 sm:text-sm"
            />
          </label>

          <StatusMessage state={renameState} />

          <button
            type="submit"
            disabled={renaming || players.length === 0}
            className="rounded-full border border-amber-300/35 bg-amber-300/15 px-5 py-2.5 text-sm tracking-[0.2em] text-amber-100 transition hover:bg-amber-300/22 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {renaming ? "更新中..." : "更新玩家 ID"}
          </button>
        </form>
      </section>

      <section className="panel rounded-[1.5rem] p-5">
        <p className="eyebrow text-amber-200">家庭轉帳</p>
        <h2 className="mt-2 font-display text-3xl tracking-[0.08em] text-white">玩家內部轉星</h2>
        <p className="mt-2 text-sm leading-7 text-white/65">
          同一帳號內可在不同玩家間轉移星星，方便比賽前快速調整。
        </p>

        <form action={transferAction} className="mt-5 space-y-4">
          <SelectField name="fromPlayerId" label="來源玩家" players={players} />
          <SelectField name="toPlayerId" label="目標玩家" players={players} />

          <label className="block space-y-2">
            <span className="text-xs tracking-[0.24em] text-white/50">轉帳顆數</span>
            <input
              name="amount"
              type="number"
              min={1}
              required
              className="w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none transition placeholder:text-white/30 focus:border-amber-300/40 sm:text-sm"
            />
          </label>

          <StatusMessage state={transferState} />

          <button
            type="submit"
            disabled={transferring || players.length < 2}
            className="rounded-full border border-amber-300/35 bg-amber-300/15 px-5 py-2.5 text-sm tracking-[0.2em] text-amber-100 transition hover:bg-amber-300/22 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {transferring ? "轉帳中..." : "確認轉帳"}
          </button>
        </form>
      </section>

      <section className="panel rounded-[1.5rem] p-5">
        <p className="eyebrow text-cyan-200">玩家稱號</p>
        <h2 className="mt-2 font-display text-3xl tracking-[0.08em] text-white">配戴解鎖稱號</h2>
        <p className="mt-2 text-sm leading-7 text-white/65">
          選擇玩家後可設定已解鎖稱號，排行榜與玩家資訊會同步更新。
        </p>

        <form action={titleAction} className="mt-5 space-y-4">
          <label className="block space-y-2">
            <span className="text-xs tracking-[0.24em] text-white/50">玩家</span>
            <select
              name="playerId"
              required
              value={selectedPlayerId}
              onChange={(event) => setSelectedPlayerId(event.target.value)}
              className="tlb-select w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none transition [color-scheme:dark] focus:border-cyan-300/40 sm:text-sm"
            >
              <option value="" className="bg-slate-900 text-white">
                請選擇玩家
              </option>
              {players.map((player) => (
                <option key={player.id} value={player.id} className="bg-slate-900 text-white">
                  {player.displayName}（目前：{player.equippedTitle ?? "未配戴"}）
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-xs tracking-[0.24em] text-white/50">稱號</span>
            <select
              name="titleDefinitionId"
              className="tlb-select w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none transition [color-scheme:dark] focus:border-cyan-300/40 sm:text-sm"
            >
              <option value="" className="bg-slate-900 text-white">
                先卸下稱號（不配戴）
              </option>
              {availableTitles.map((title) => (
                <option key={title.id} value={title.id} className="bg-slate-900 text-white">
                  {title.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-white/45">請先選擇玩家，才會帶出該玩家已解鎖稱號。</p>
          </label>

          <button
            type="submit"
            disabled={titleUpdating || players.length === 0 || !selectedPlayer}
            className="rounded-full border border-cyan-300/35 bg-cyan-300/15 px-5 py-3 text-sm tracking-[0.2em] text-cyan-100 transition hover:bg-cyan-300/22 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {titleUpdating ? "更新中..." : "更新稱號"}
          </button>
        </form>

        <StatusMessage state={titleState} />
      </section>
    </div>
  );
}

function SelectField({
  name,
  label,
  players,
}: {
  name: string;
  label: string;
  players: PlayerItem[];
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs tracking-[0.24em] text-white/50">{label}</span>
      <select
        name={name}
        required
        className="tlb-select w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none transition [color-scheme:dark] focus:border-cyan-300/40 sm:text-sm"
      >
        <option value="" className="bg-slate-900 text-white">
          請選擇玩家
        </option>
        {players.map((player) => (
          <option key={player.id} value={player.id} className="bg-slate-900 text-white">
            {player.displayName}（可用 {player.balance}／鎖定 {player.lockedBalance}）
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusMessage({ state }: { state: HubActionState }) {
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
