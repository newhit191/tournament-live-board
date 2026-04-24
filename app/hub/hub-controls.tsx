"use client";

import { useActionState, useMemo, useState } from "react";

import {
  createPlayerProfileAction,
  equipPlayerTitleAction,
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
  const [transferState, transferAction, transfering] = useActionState(
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
        <p className="eyebrow text-cyan-200">新增玩家</p>
        <h2 className="mt-2 font-display text-3xl tracking-[0.08em] text-white">家庭成員管理</h2>
        <p className="mt-2 text-sm leading-7 text-white/65">
          一個帳號可以建立多位玩家。小孩玩家可由你代為管理，並且可以正式參與多人賽事。
        </p>

        <form action={createAction} className="mt-5 space-y-4">
          <label className="block space-y-2">
            <span className="text-xs tracking-[0.24em] text-white/50">玩家名稱</span>
            <input
              name="displayName"
              required
              placeholder="例如：阿哲、1號小孩"
              className="w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none transition placeholder:text-white/30 focus:border-cyan-300/40 sm:text-sm"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-white/78">
            <input
              type="checkbox"
              name="isChild"
              className="h-4 w-4 rounded border-white/20 bg-white/10"
            />
            此玩家為小孩成員
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
        <p className="eyebrow text-amber-200">星星轉帳</p>
        <h2 className="mt-2 font-display text-3xl tracking-[0.08em] text-white">家庭內互轉</h2>
        <p className="mt-2 text-sm leading-7 text-white/65">
          只允許同家庭玩家間互轉。每筆交易都會寫入不可逆帳本，提供後台追溯。
        </p>

        <form action={transferAction} className="mt-5 space-y-4">
          <SelectField name="fromPlayerId" label="來源玩家" players={players} />
          <SelectField name="toPlayerId" label="目標玩家" players={players} />

          <label className="block space-y-2">
            <span className="text-xs tracking-[0.24em] text-white/50">星星數量</span>
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
            disabled={transfering || players.length < 2}
            className="rounded-full border border-amber-300/35 bg-amber-300/15 px-5 py-2.5 text-sm tracking-[0.2em] text-amber-100 transition hover:bg-amber-300/22 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {transfering ? "轉帳中..." : "確認轉帳"}
          </button>
        </form>
      </section>

      <section className="panel rounded-[1.5rem] p-5 lg:col-span-2">
        <p className="eyebrow text-cyan-200">玩家稱號</p>
        <h2 className="mt-2 font-display text-3xl tracking-[0.08em] text-white">佩戴已解鎖稱號</h2>
        <p className="mt-2 text-sm leading-7 text-white/65">
          系統會根據星星、勝場與跨家庭勝場解鎖特殊稱號。你可以替每位玩家設定要顯示的稱號。
        </p>

        <form action={titleAction} className="mt-5 grid gap-4 md:grid-cols-[1fr,1fr,auto] md:items-end">
          <label className="block space-y-2">
            <span className="text-xs tracking-[0.24em] text-white/50">玩家</span>
            <select
              name="playerId"
              required
              value={selectedPlayerId}
              onChange={(event) => setSelectedPlayerId(event.target.value)}
              className="tlb-select w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none transition [color-scheme:dark] focus:border-cyan-300/40 sm:text-sm"
            >
              <option value="" className="bg-slate-900 text-white">請選擇玩家</option>
              {players.map((player) => (
                <option key={player.id} value={player.id} className="bg-slate-900 text-white">
                  {player.displayName}（目前：{player.equippedTitle ?? "未佩戴"}）
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
              <option value="" className="bg-slate-900 text-white">清除佩戴（不顯示）</option>
              {availableTitles.map((title) => (
                <option key={title.id} value={title.id} className="bg-slate-900 text-white">
                  {title.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-white/45">請先選擇玩家，再選擇該玩家已解鎖的稱號。</p>
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
            {player.displayName}（可用 {player.balance}、鎖定 {player.lockedBalance}）
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
