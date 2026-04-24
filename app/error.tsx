"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-Hant-TW">
      <body className="min-h-screen bg-slate-950 text-white">
        <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-5 px-5 py-10">
          <section className="rounded-3xl border border-amber-300/25 bg-amber-300/10 p-6">
            <p className="eyebrow text-amber-200">系統訊息</p>
            <h1 className="mt-2 font-display text-4xl tracking-[0.08em]">頁面暫時無法載入</h1>
            <p className="mt-3 text-sm leading-7 text-white/78">
              我們已攔截到執行錯誤，請先重新載入。若持續發生，通常是環境變數或資料庫結構尚未同步。
            </p>
            {error?.message ? (
              <p className="mt-3 rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-xs text-white/70">
                {error.message}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-amber-300/35 bg-amber-300/14 px-4 py-2 text-xs tracking-[0.18em] text-amber-100 transition hover:bg-amber-300/22"
              >
                重新嘗試
              </button>
              <Link
                href="/"
                className="rounded-full border border-white/14 px-4 py-2 text-xs tracking-[0.18em] text-white/85 transition hover:bg-white/8"
              >
                返回首頁
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
