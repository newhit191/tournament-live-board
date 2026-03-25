"use client";

import { startTransition, useEffect, useEffectEvent } from "react";

import { useRouter } from "next/navigation";

type DisplayAutoRefreshProps = {
  intervalMs?: number;
};

export function DisplayAutoRefresh({
  intervalMs = 5000,
}: DisplayAutoRefreshProps) {
  const router = useRouter();

  const refresh = useEffectEvent(() => {
    startTransition(() => {
      router.refresh();
    });
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      refresh();
    }, intervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [intervalMs]);

  return null;
}
