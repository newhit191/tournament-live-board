import Link from "next/link";

import { getMissingSupabaseEnvs, getSupabaseConfig } from "@/lib/supabase/config";

type SupabaseSetupNoticeProps = {
  title?: string;
  description?: string;
  requireServiceRole?: boolean;
  debugMessage?: string | null;
};

function getKeyHint(label: string, value: string) {
  if (!value) return `${label}: 未設定`;
  const head = value.slice(0, 14);
  const tail = value.slice(-6);
  return `${label}: ${head}...${tail}（長度 ${value.length}）`;
}

export function SupabaseSetupNotice({
  title = "尚未完成 Supabase 設定",
  description = "請先補齊必要的 Supabase 環境變數，再重新部署網站。",
  requireServiceRole = false,
  debugMessage = null,
}: SupabaseSetupNoticeProps) {
  const required = requireServiceRole
    ? getMissingSupabaseEnvs()
    : getMissingSupabaseEnvs().filter((name) => name !== "SUPABASE_SERVICE_ROLE_KEY");
  const config = getSupabaseConfig();

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
          <p className="mt-2 text-sm text-emerald-200">公開環境變數已就緒，若仍異常請查看 Deploy Logs。</p>
        )}
      </div>

      {requireServiceRole ? (
        <div className="mt-4 rounded-2xl border border-cyan-300/24 bg-cyan-300/10 px-4 py-3">
          <p className="text-xs tracking-[0.2em] text-cyan-100/85">金鑰格式檢查（遮罩）</p>
          <ul className="mt-2 space-y-1 text-xs text-cyan-100/85">
            <li>{getKeyHint("NEXT_PUBLIC_SUPABASE_ANON_KEY", config.anonKey)}</li>
            <li>{getKeyHint("SUPABASE_SERVICE_ROLE_KEY", config.serviceRoleKey)}</li>
          </ul>
          <p className="mt-2 text-xs text-cyan-100/80">
            正常情況：匿名金鑰通常以 <code>sb_publishable_</code> 開頭，服務金鑰通常以{" "}
            <code>sb_secret_</code> 開頭。
          </p>
        </div>
      ) : null}

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

