"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "@/app/admin/actions";

const initialState: LoginState = {
  error: null,
};

type AdminLoginFormProps = {
  demoMode: boolean;
};

export function AdminLoginForm({ demoMode }: AdminLoginFormProps) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="password"
          className="text-xs uppercase tracking-[0.24em] text-white/45"
        >
          Shared admin password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          defaultValue={demoMode ? "demo-mode-open" : ""}
          className="w-full rounded-3xl border border-white/12 bg-white/[0.05] px-5 py-4 text-white outline-none transition placeholder:text-white/28 focus:border-amber-300/35"
          placeholder="Enter backstage password"
        />
      </div>

      {state.error ? (
        <p className="rounded-2xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full border border-amber-300/30 bg-amber-300/14 px-5 py-4 text-sm uppercase tracking-[0.28em] text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Opening..." : "Enter Control Room"}
      </button>
    </form>
  );
}
