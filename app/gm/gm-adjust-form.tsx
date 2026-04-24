"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  gmAdjustStarsAction,
  gmDeleteAccountAction,
  type GmActionState,
} from "@/app/gm/actions";

type PlayerOption = {
  id: string;
  displayName: string;
  ownerName: string | null;
  balance: number;
};

type AccountOption = {
  id: string;
  displayName: string | null;
  email: string | null;
  role: "user" | "gm" | "admin";
  playerCount: number;
};

export function GmAdjustForm({
  players,
  accounts,
  currentUserId,
}: {
  players: PlayerOption[];
  accounts: AccountOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const initialState: GmActionState = {
    error: null,
    success: null,
  };

  const [adjustState, adjustFormAction, adjusting] = useActionState(
    gmAdjustStarsAction,
    initialState,
  );
  const [deleteState, deleteFormAction, deleting] = useActionState(
    gmDeleteAccountAction,
    initialState,
  );

  useEffect(() => {
    if (!adjustState.success) {
      return;
    }
    router.refresh();
  }, [adjustState, router]);

  useEffect(() => {
    if (!deleteState.success && !deleteState.error) {
      return;
    }
    router.refresh();
  }, [deleteState, router]);

  return (
    <div className="space-y-8">
      <form action={adjustFormAction} className="space-y-4">
        <p className="eyebrow text-cyan-200">補星管理</p>
        <label className="block space-y-2">
          <span className="text-xs tracking-[0.24em] text-white/50">目標玩家</span>
          <select
            name="targetPlayerId"
            required
            className="tlb-select w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none transition [color-scheme:dark] focus:border-cyan-300/40 sm:text-sm"
          >
            <option value="" className="bg-slate-900 text-white">
              請選擇玩家
            </option>
            {players.map((player) => (
              <option key={player.id} value={player.id} className="bg-slate-900 text-white">
                {player.displayName}（{player.ownerName ?? "未命名帳號"} / 目前 {player.balance} 顆）
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-xs tracking-[0.24em] text-white/50">調整數量（可正可負）</span>
          <input
            name="delta"
            type="number"
            required
            className="w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none transition focus:border-cyan-300/40 sm:text-sm"
            placeholder="例如：100 或 -20"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-xs tracking-[0.24em] text-white/50">原因</span>
          <input
            name="reason"
            required
            className="w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none transition focus:border-cyan-300/40 sm:text-sm"
            placeholder="例如：內測補星"
          />
        </label>

        <p className="text-xs text-white/50">
          提示：送出後會自動刷新頁面資料，方便你立即確認補星後的最新餘額。
        </p>

        {adjustState.error ? (
          <p className="rounded-2xl border border-red-300/30 bg-red-300/10 px-4 py-2.5 text-sm text-red-100">
            {adjustState.error}
          </p>
        ) : null}

        {adjustState.success ? (
          <p className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-2.5 text-sm text-emerald-100">
            {adjustState.success}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={adjusting}
          className="rounded-full border border-amber-300/35 bg-amber-300/15 px-5 py-2.5 text-sm tracking-[0.2em] text-amber-100 transition hover:bg-amber-300/22 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {adjusting ? "處理中..." : "送出補星"}
        </button>
      </form>

      <form action={deleteFormAction} className="space-y-4 border-t border-white/10 pt-6">
        <p className="eyebrow text-red-200">帳號刪除</p>
        <label className="block space-y-2">
          <span className="text-xs tracking-[0.24em] text-white/50">目標帳號</span>
          <select
            name="targetAccountId"
            required
            className="tlb-select w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none transition [color-scheme:dark] focus:border-red-300/45 sm:text-sm"
          >
            <option value="" className="bg-slate-900 text-white">
              請選擇要刪除的帳號
            </option>
            {accounts.map((item) => (
              <option
                key={item.id}
                value={item.id}
                className="bg-slate-900 text-white"
                disabled={item.id === currentUserId || item.role === "gm" || item.role === "admin"}
              >
                {(item.displayName ?? "未命名帳號")} / {item.email ?? "無 Email"} / 角色 {item.role.toUpperCase()} / 玩家 {item.playerCount} 位
                {item.id === currentUserId
                  ? "（目前登入帳號，不可刪除）"
                  : item.role === "gm" || item.role === "admin"
                    ? "（管理權限帳號，不可刪除）"
                    : ""}
              </option>
            ))}
          </select>
        </label>

        <p className="text-xs text-red-200/90">
          刪除後不可復原，該帳號登入身份、玩家資料、錢包與帳本都會一起移除。
        </p>

        {deleteState.error ? (
          <p className="rounded-2xl border border-red-300/30 bg-red-300/10 px-4 py-2.5 text-sm text-red-100">
            {deleteState.error}
          </p>
        ) : null}

        {deleteState.success ? (
          <p className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-2.5 text-sm text-emerald-100">
            {deleteState.success}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={deleting}
          className="rounded-full border border-red-300/35 bg-red-300/15 px-5 py-2.5 text-sm tracking-[0.2em] text-red-100 transition hover:bg-red-300/22 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {deleting ? "刪除中..." : "刪除玩家帳號"}
        </button>
      </form>
    </div>
  );
}
