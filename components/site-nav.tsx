import Link from "next/link";

import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type NavRole = "user" | "gm" | "admin";

const baseLinks = [
  { href: "/", label: "首頁" },
  { href: "/arena", label: "約戰看板" },
  { href: "/rankings", label: "排行榜" },
  { href: "/hub", label: "玩家中心" },
  { href: "/tournaments", label: "賽事列表" },
] as const;

export async function SiteNav() {
  const config = getSupabaseConfig();
  if (!config.isReady) {
    return (
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 rounded-[1.5rem] border border-white/12 bg-black/35 px-4 py-3 backdrop-blur-xl sm:px-6 md:flex-row md:items-center md:justify-between md:rounded-full">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="rounded-full border border-amber-300/40 bg-amber-300/12 px-3 py-1 font-display text-sm tracking-[0.32em] text-amber-200">
              TLB
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-base leading-none tracking-[0.08em] text-white sm:text-2xl sm:tracking-[0.18em]">
                Tournament Live Board
              </p>
              <p className="truncate text-[11px] tracking-[0.2em] text-white/55 sm:text-xs sm:tracking-[0.3em]">
                戰鬥陀螺約戰競技場
              </p>
            </div>
          </Link>
          <nav className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto pb-1 pr-1 md:w-auto md:overflow-visible md:pb-0">
            {baseLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 whitespace-nowrap rounded-full border border-white/10 px-3 py-2.5 text-center text-xs tracking-[0.14em] text-white/72 transition hover:bg-white/8 hover:text-white sm:text-sm sm:tracking-[0.24em] md:border-transparent md:px-4"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
    );
  }

  let user: { id: string } | null = null;
  try {
    const client = await createSupabaseServerClient();
    const { data } = await client.auth.getUser();
    user = data.user ? { id: data.user.id } : null;
  } catch {
    user = null;
  }

  let role: NavRole = "user";
  if (user) {
    try {
      const client = await createSupabaseServerClient();
      const { data: account } = await client
        .from("accounts")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      role = (account?.role as NavRole | undefined) ?? "user";
    } catch {
      role = "user";
    }
  }

  const links = [
    ...baseLinks,
    ...(role === "gm" || role === "admin" ? ([{ href: "/gm", label: "GM後台" }] as const) : []),
    ...(role === "admin" ? ([{ href: "/admin/tournaments", label: "賽務後台" }] as const) : []),
  ];

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 rounded-[1.5rem] border border-white/12 bg-black/35 px-4 py-3 backdrop-blur-xl sm:px-6 md:flex-row md:items-center md:justify-between md:rounded-full">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="rounded-full border border-amber-300/40 bg-amber-300/12 px-3 py-1 font-display text-sm tracking-[0.32em] text-amber-200">
            TLB
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-base leading-none tracking-[0.08em] text-white sm:text-2xl sm:tracking-[0.18em]">
              Tournament Live Board
            </p>
            <p className="truncate text-[11px] tracking-[0.2em] text-white/55 sm:text-xs sm:tracking-[0.3em]">
              戰鬥陀螺約戰競技場
            </p>
          </div>
        </Link>

        <nav className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto pb-1 pr-1 md:w-auto md:overflow-visible md:pb-0">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 whitespace-nowrap rounded-full border border-white/10 px-3 py-2.5 text-center text-xs tracking-[0.14em] text-white/72 transition hover:bg-white/8 hover:text-white sm:text-sm sm:tracking-[0.24em] md:border-transparent md:px-4"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
