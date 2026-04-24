"use client";

import { useActionState, useState } from "react";

import { signInAction, signUpWithInviteAction, type AuthActionState } from "@/app/auth/actions";

type AuthTab = "signin" | "signup";

const initialState: AuthActionState = {
  error: null,
  success: null,
};

export function AuthPanel({ nextPath }: { nextPath: string }) {
  const [tab, setTab] = useState<AuthTab>("signin");
  const [signInState, signInFormAction, signInPending] = useActionState(
    signInAction,
    initialState,
  );
  const [signUpState, signUpFormAction, signUpPending] = useActionState(
    signUpWithInviteAction,
    initialState,
  );

  return (
    <div className="panel-strong mx-auto w-full max-w-xl rounded-[2rem] p-6 sm:p-8">
      <p className="eyebrow text-cyan-200">玩家登入</p>
      <h1 className="mt-3 font-display text-4xl tracking-[0.08em] text-white sm:text-5xl">
        登入你的戰場身份
      </h1>
      <p className="mt-4 text-sm leading-7 text-white/70 sm:text-base">
        現在可直接註冊，不需要邀請碼。註冊後你可以在同一帳號內管理多位玩家（例如自己與小孩），並參與約戰、排行榜與賽事系統。
      </p>

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-full border border-white/12 bg-white/[0.04] p-1">
        <TabButton active={tab === "signin"} onClick={() => setTab("signin")} label="登入" />
        <TabButton active={tab === "signup"} onClick={() => setTab("signup")} label="註冊" />
      </div>

      {tab === "signin" ? (
        <AuthForm
          key="signin"
          state={signInState}
          formAction={signInFormAction}
          pending={signInPending}
          mode="signin"
          nextPath={nextPath}
        />
      ) : (
        <AuthForm
          key="signup"
          state={signUpState}
          formAction={signUpFormAction}
          pending={signUpPending}
          mode="signup"
          nextPath={nextPath}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm tracking-[0.2em] transition ${
        active
          ? "border border-amber-300/35 bg-amber-300/14 text-amber-100"
          : "border border-transparent text-white/65 hover:bg-white/8 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function AuthForm({
  state,
  formAction,
  pending,
  mode,
  nextPath,
}: {
  state: AuthActionState;
  formAction: (payload: FormData) => void;
  pending: boolean;
  mode: "signin" | "signup";
  nextPath: string;
}) {
  const safeNextPath =
    nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "";

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {safeNextPath ? <input type="hidden" name="nextPath" value={safeNextPath} /> : null}

      {mode === "signup" ? (
        <Field label="顯示名稱" name="displayName" placeholder="例如：小龍 / 阿哲" />
      ) : null}

      <Field label="Email" name="email" type="email" placeholder="you@example.com" />
      <Field
        label="密碼"
        name="password"
        type="password"
        placeholder={mode === "signup" ? "至少 6 個字元" : "請輸入你的密碼"}
      />

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
        disabled={pending}
        className="w-full rounded-full border border-amber-300/30 bg-amber-300/14 px-5 py-3 text-sm tracking-[0.24em] text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "處理中..." : mode === "signup" ? "建立帳號" : "登入"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs tracking-[0.24em] text-white/50">{label}</span>
      <input
        name={name}
        type={type}
        required
        className="w-full rounded-3xl border border-white/12 bg-white/[0.05] px-5 py-3 text-base text-white outline-none transition placeholder:text-white/30 focus:border-cyan-300/40 sm:text-sm"
        placeholder={placeholder}
      />
    </label>
  );
}

