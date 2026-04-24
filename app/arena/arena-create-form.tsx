"use client";

import {
  useActionState,
  useMemo,
  useState,
  type ChangeEventHandler,
  type ReactNode,
} from "react";

import { createChallengeAction, type ArenaActionState } from "@/app/arena/actions";
import type { ArenaPlayer, ChallengeCompetitionFormat } from "@/lib/arena-types";

const initialState: ArenaActionState = {
  error: null,
  success: null,
};

type ArenaCreateFormProps = {
  players: ArenaPlayer[];
  initialMode?: "single_stake" | "prize_pool";
  initialHostPlayerId?: string;
  initialDuelPlayer?: {
    id: string;
    displayName: string;
  } | null;
};

export function ArenaCreateForm({
  players,
  initialMode = "single_stake",
  initialHostPlayerId,
  initialDuelPlayer = null,
}: ArenaCreateFormProps) {
  const [state, formAction, pending] = useActionState(createChallengeAction, initialState);
  const duelFlowActive = Boolean(initialDuelPlayer);
  const [mode, setMode] = useState<"single_stake" | "prize_pool">(
    duelFlowActive ? "single_stake" : initialMode,
  );
  const [competitionFormat, setCompetitionFormat] =
    useState<ChallengeCompetitionFormat>(
      duelFlowActive || initialMode === "single_stake" ? "single_match" : "single_elimination",
    );
  const [participantLimit, setParticipantLimit] = useState(8);
  const [entryFee, setEntryFee] = useState(1);
  const [title, setTitle] = useState(
    duelFlowActive && initialDuelPlayer ? `快速挑戰｜對戰 ${initialDuelPlayer.displayName}` : "",
  );
  const [hostPlayerId, setHostPlayerId] = useState(
    initialHostPlayerId && players.some((item) => item.id === initialHostPlayerId)
      ? initialHostPlayerId
      : (players[0]?.id ?? ""),
  );
  const [duelPlayerId] = useState(initialDuelPlayer?.id ?? "");

  const pool = participantLimit * entryFee;

  const suggestedRewards = useMemo(() => {
    const first = Math.max(1, Math.floor(pool * 0.5));
    const second = Math.max(0, Math.floor(pool * 0.3));
    const third = Math.max(0, pool - first - second);
    return { first, second, third };
  }, [pool]);

  const handleModeChange: ChangeEventHandler<HTMLSelectElement> = (event) => {
    const nextMode = event.target.value as "single_stake" | "prize_pool";
    setMode(nextMode);

    if (nextMode === "single_stake") {
      setCompetitionFormat("single_match");
      return;
    }

    if (competitionFormat === "single_match") {
      setCompetitionFormat("single_elimination");
    }
  };

  return (
    <section className="panel rounded-[1.75rem] p-5 sm:p-6">
      <p className="eyebrow text-cyan-200">發起約戰</p>
      <h2 className="mt-2 font-display text-4xl tracking-[0.08em] text-white">建立新對戰</h2>
      <p className="mt-3 text-sm leading-7 text-white/68">
        支援單場對賭與多人獎池兩種模式。單場可不等額對賭；獎池模式會先鎖定每位參賽者的參賽費，完賽後依名次發放。
      </p>

      <form action={formAction} className="mt-6 grid gap-4">
        {mode === "single_stake" && initialDuelPlayer ? (
          <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3">
            <p className="text-xs tracking-[0.2em] text-cyan-100">QR 快速對戰</p>
            <p className="mt-2 text-sm text-white/85">
              這場會以 <span className="font-semibold">{initialDuelPlayer.displayName}</span> 為指定對手建立。
            </p>
            <p className="mt-1 text-xs text-white/60">
              若你是掃碼後第一次登入，系統現在會回到這個頁面，不會把你導去其他頁面。
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="約戰標題"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={duelFlowActive ? "例如：快速挑戰｜阿哲 vs 小宇" : "例如：新竹週末快閃挑戰"}
            required
          />
          <SelectField
            label="主辦玩家"
            name="hostPlayerId"
            required
            value={hostPlayerId}
            onChange={(event) => setHostPlayerId(event.target.value)}
          >
            <option value="" className="bg-slate-900 text-white">
              請選擇玩家
            </option>
            {players.map((player) => (
              <option key={player.id} value={player.id} className="bg-slate-900 text-white">
                {player.displayName}（可用 {player.balance} / 鎖定 {player.lockedBalance}）
              </option>
            ))}
          </SelectField>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {duelFlowActive ? (
            <>
              <input type="hidden" name="mode" value="single_stake" />
              <ReadOnlyHint label="模式" value="QR 快速流程固定為「單場對賭」" />
            </>
          ) : (
            <SelectField label="模式" name="mode" value={mode} onChange={handleModeChange}>
              <option value="single_stake" className="bg-slate-900 text-white">
                單場對賭
              </option>
              <option value="prize_pool" className="bg-slate-900 text-white">
                多人獎池賽
              </option>
            </SelectField>
          )}
          <Field label="城市" name="city" placeholder="例如：台中市" />
          <Field label="場地" name="venue" placeholder="例如：北區運動中心" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="開始時間（可選）" name="startsAt" type="datetime-local" />
          <Field label="簡述（可選）" name="description" placeholder="例如：請自備發射器，歡迎帶小孩一起打。" />
        </div>

        {mode === "single_stake" ? (
          <>
            {duelPlayerId ? <input type="hidden" name="duelPlayerId" value={duelPlayerId} /> : null}
            <input type="hidden" name="competitionFormat" value="single_match" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="主辦方預鎖星星"
                name="hostStake"
                type="number"
                min={0}
                defaultValue={1}
                placeholder="例如：3"
                required
              />
              <ReadOnlyHint
                label="對戰說明"
                value="第二位加入者可自行輸入要押的星星顆數，雙方可不等額對賭。"
              />
            </div>
          </>
        ) : (
          <>
            <SelectField
              label="多人賽制"
              name="competitionFormat"
              value={competitionFormat}
              onChange={(event) =>
                setCompetitionFormat(event.target.value as ChallengeCompetitionFormat)
              }
            >
              <option value="manual_pool" className="bg-slate-900 text-white">
                手動名次（主辦方指定）
              </option>
              <option value="single_elimination" className="bg-slate-900 text-white">
                單淘汰賽
              </option>
              <option value="double_elimination" className="bg-slate-900 text-white">
                雙敗淘汰賽（暫為手動結算）
              </option>
              <option value="round_robin" className="bg-slate-900 text-white">
                循環賽
              </option>
            </SelectField>

            <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
              單淘汰、循環賽可在對戰頁建立自動賽程並逐場填寫結果；雙敗淘汰目前先用手動名次結算（下一版補齊全自動）。
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="參賽人數"
                name="participantLimit"
                type="number"
                min={3}
                value={participantLimit}
                onChange={(event) => setParticipantLimit(Number(event.target.value || 3))}
                required
              />
              <Field
                label="每人參賽費"
                name="entryFee"
                type="number"
                min={1}
                value={entryFee}
                onChange={(event) => setEntryFee(Number(event.target.value || 1))}
                required
              />
              <ReadOnlyHint label="總獎池星星" value={`${pool} 顆`} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="第一名獎勵"
                name="rewardFirst"
                type="number"
                min={0}
                defaultValue={suggestedRewards.first}
                required
              />
              <Field
                label="第二名獎勵"
                name="rewardSecond"
                type="number"
                min={0}
                defaultValue={suggestedRewards.second}
                required
              />
              <Field
                label="第三名獎勵"
                name="rewardThird"
                type="number"
                min={0}
                defaultValue={suggestedRewards.third}
                required
              />
            </div>
          </>
        )}

        {state.error ? (
          <p className="rounded-2xl border border-red-300/30 bg-red-300/10 px-4 py-3 text-sm text-red-100">
            {state.error}
          </p>
        ) : null}

        {state.success ? (
          <p className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
            {state.success}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || players.length === 0}
          className="w-full rounded-full border border-amber-300/30 bg-amber-300/14 px-5 py-3 text-sm tracking-[0.24em] text-amber-100 transition hover:bg-amber-300/22 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? "建立中..." : "建立約戰"}
        </button>

        {players.length === 0 ? (
          <p className="text-sm text-white/65">目前還沒有可用玩家，請先到玩家中心建立玩家。</p>
        ) : null}
      </form>
    </section>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  required,
  min,
  defaultValue,
  value,
  onChange,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  min?: number;
  defaultValue?: string | number;
  value?: string | number;
  onChange?: ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs tracking-[0.24em] text-white/50">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        min={min}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange}
        className="w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/40 sm:text-sm"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  children,
  required,
  value,
  onChange,
}: {
  label: string;
  name: string;
  children: ReactNode;
  required?: boolean;
  value?: string;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs tracking-[0.24em] text-white/50">{label}</span>
      <select
        name={name}
        required={required}
        value={value}
        onChange={onChange}
        className="tlb-select w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-base text-white outline-none transition [color-scheme:dark] focus:border-cyan-300/40 sm:text-sm"
      >
        {children}
      </select>
    </label>
  );
}

function ReadOnlyHint({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="text-xs tracking-[0.24em] text-white/48">{label}</p>
      <p className="mt-2 text-sm text-cyan-100">{value}</p>
    </div>
  );
}
