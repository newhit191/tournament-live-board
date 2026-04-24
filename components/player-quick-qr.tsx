"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

function normalizeBaseUrl(raw: string | undefined) {
  const value = raw?.trim() ?? "";
  if (!value) return "";
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function isLocalhostOrigin(origin: string) {
  return (
    origin.startsWith("http://localhost") ||
    origin.startsWith("https://localhost") ||
    origin.startsWith("http://127.0.0.1") ||
    origin.startsWith("https://127.0.0.1")
  );
}

const STORAGE_KEY = "tlb-public-base-url";

export function PlayerQuickQr({
  playerId,
  playerName,
}: {
  playerId: string;
  playerName: string;
}) {
  const envBaseUrl = useMemo(
    () => normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL),
    [],
  );
  const [runtimeOrigin, setRuntimeOrigin] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const rafId = window.requestAnimationFrame(() => {
      setRuntimeOrigin(normalizeBaseUrl(window.location.origin));
      const saved = normalizeBaseUrl(window.localStorage.getItem(STORAGE_KEY) ?? "");
      if (saved) {
        setCustomBaseUrl(saved);
      }
    });

    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const effectiveBaseUrl = useMemo(() => {
    if (customBaseUrl) return customBaseUrl;
    if (envBaseUrl) return envBaseUrl;
    return runtimeOrigin;
  }, [customBaseUrl, envBaseUrl, runtimeOrigin]);

  const baseUrlSource = customBaseUrl
    ? "自訂公開網址"
    : envBaseUrl
      ? "系統設定網址"
      : runtimeOrigin
        ? "目前頁面網址"
        : "待偵測";

  const challengePath = `/arena?mode=single_stake&duelPlayerId=${encodeURIComponent(playerId)}`;
  const challengeUrl = effectiveBaseUrl ? `${effectiveBaseUrl}${challengePath}` : challengePath;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=6&data=${encodeURIComponent(
    challengeUrl,
  )}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(challengeUrl);
    } catch {
      // ignore clipboard permission errors
    }
  };

  const handleSaveCustomBaseUrl = () => {
    if (typeof window === "undefined") {
      return;
    }

    const normalized = normalizeBaseUrl(customBaseUrl);
    if (!normalized) {
      window.localStorage.removeItem(STORAGE_KEY);
      setCustomBaseUrl("");
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, normalized);
    setCustomBaseUrl(normalized);
  };

  const showLocalhostHint = runtimeOrigin && isLocalhostOrigin(runtimeOrigin) && !customBaseUrl;

  return (
    <div className="space-y-2 rounded-2xl border border-cyan-300/18 bg-cyan-300/5 p-3">
      <p className="text-xs tracking-[0.2em] text-cyan-100">快速約戰 QR（{playerName}）</p>
      <p className="text-xs leading-6 text-white/60">
        對手掃碼後會進入快速對戰建立流程，系統會自動帶入你作為指定對手，現場可直接開戰。
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Image
          src={qrUrl}
          alt={`${playerName} 的快速約戰 QR`}
          width={96}
          height={96}
          unoptimized
          className="h-24 w-24 rounded-xl border border-white/14 bg-black/30"
          loading="lazy"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="truncate rounded-xl border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-white/60">
            {challengeUrl}
          </p>
          <p className="text-[11px] tracking-[0.14em] text-white/45">網址來源：{baseUrlSource}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-full border border-white/16 px-3 py-1 text-xs tracking-[0.16em] text-white/78 transition hover:bg-white/8"
            >
              複製連結
            </button>
            <a
              href={challengeUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-amber-300/30 bg-amber-300/12 px-3 py-1 text-xs tracking-[0.16em] text-amber-100 transition hover:bg-amber-300/20"
            >
              立即開啟
            </a>
          </div>
        </div>
      </div>

      {showLocalhostHint ? (
        <div className="space-y-2 rounded-xl border border-amber-300/25 bg-amber-300/10 p-2.5">
          <p className="text-[11px] leading-5 text-amber-100">
            目前網址是 localhost，手機掃碼通常無法直連你的電腦。請先填入可外部連線網址（例如 Vercel 網址，或同 Wi-Fi 下的
            `http://你的電腦IP:3000`）。
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={customBaseUrl}
              onChange={(event) => setCustomBaseUrl(event.target.value)}
              placeholder="例如：https://tournament-live-board.vercel.app"
              className="w-full rounded-xl border border-white/14 bg-black/30 px-3 py-2 text-xs text-white outline-none placeholder:text-white/35 focus:border-cyan-300/35"
            />
            <button
              type="button"
              onClick={handleSaveCustomBaseUrl}
              className="shrink-0 rounded-xl border border-cyan-300/35 bg-cyan-300/15 px-3 py-2 text-xs tracking-[0.12em] text-cyan-100 transition hover:bg-cyan-300/25"
            >
              儲存網址
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.localStorage.removeItem(STORAGE_KEY);
                }
                setCustomBaseUrl("");
              }}
              className="shrink-0 rounded-xl border border-white/18 bg-white/10 px-3 py-2 text-xs tracking-[0.12em] text-white/80 transition hover:bg-white/18"
            >
              清除自訂
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
