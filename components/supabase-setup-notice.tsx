import Link from "next/link";

import { getMissingSupabaseEnvs } from "@/lib/supabase/config";

type SupabaseSetupNoticeProps = {
  title?: string;
  description?: string;
  requireServiceRole?: boolean;
  debugMessage?: string | null;
};

export function SupabaseSetupNotice({
  title = "目前系統尚未完成 Supabase 設定",
  description = "此頁需要 Supabase 環境變數才能正常讀取資料，請先在 Vercel 專案補齊設定後重新整理。",
  requireServiceRole = false,
  debugMessage = null,
}: SupabaseSetupNoticeProps) {
  const required = requireServiceRole
    ? getMissingSupabaseEnvs()
    : getMissingSupabaseEnvs().filter((name) => name !== "SUPABASE_SERVICE_ROLE_KEY");

  return (
    <section className="panel rounded-[1.5rem] border border-amber-300/30 bg-amber-300/10 p-5 sm:p-6">
      <p className="eyebrow text-amber-200">設定提示</p>
      <h2 className="mt-2 font-display text-3xl tracking-[0.08em] text-white">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-white/78">{description}</p>

      <div className="mt-4 rounded-2xl border border-white/14 bg-black/25 px-4 py-3">
        <p className="text-xs tracking-[0.2em] text-white/55">缺少環境變數</p>
        {required.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm text-amber-100">
            {required.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-emerald-200">公開環境變數已就緒，若仍異常請查看 Vercel Deploy Logs。</p>
        )}
      </div>

      {debugMessage ? (
        <div className="mt-4 rounded-2xl border border-rose-300/28 bg-rose-300/10 px-4 py-3">
          <p className="text-xs tracking-[0.2em] text-rose-100/80">Runtime 錯誤</p>
          <p className="mt-2 break-all text-xs leading-6 text-rose-100/92">{debugMessage}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/"
          className="rounded-full border border-white/14 px-4 py-2 text-xs tracking-[0.18em] text-white/86 transition hover:bg-white/8"
        >
          返回首頁
        </Link>
        <Link
          href="/auth"
          className="rounded-full border border-cyan-300/30 bg-cyan-300/12 px-4 py-2 text-xs tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-300/20"
        >
          前往登入
        </Link>
      </div>
    </section>
  );
}
