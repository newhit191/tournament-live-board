import Link from "next/link";

const links = [
  { href: "/", label: "首頁" },
  { href: "/tournaments", label: "賽事列表" },
  { href: "/admin/tournaments", label: "主辦方後台" },
] as const;

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 rounded-[1.75rem] border border-white/12 bg-black/30 px-4 py-3 backdrop-blur-xl sm:px-6 md:flex-row md:items-center md:justify-between md:rounded-full">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="rounded-full border border-amber-300/40 bg-amber-300/12 px-3 py-1 font-display text-sm tracking-[0.32em] text-amber-200">
            TLB
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-lg leading-none tracking-[0.08em] text-white sm:text-2xl sm:tracking-[0.18em]">
              Tournament Live Board
            </p>
            <p className="truncate text-xs tracking-[0.3em] text-white/55">
              專業賽事展示與控制台
            </p>
          </div>
        </Link>

        <nav className="grid w-full grid-cols-3 gap-2 md:flex md:w-auto md:items-center">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border border-white/10 px-3 py-2 text-center text-xs tracking-[0.14em] text-white/72 transition hover:bg-white/8 hover:text-white sm:text-sm sm:tracking-[0.24em] md:border-transparent md:px-4"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
