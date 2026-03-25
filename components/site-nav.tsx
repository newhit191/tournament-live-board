import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/tournaments", label: "Tournaments" },
  { href: "/admin/tournaments", label: "Admin" },
] as const;

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-white/12 bg-black/30 px-4 py-3 backdrop-blur-xl sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="rounded-full border border-amber-300/40 bg-amber-300/12 px-3 py-1 font-display text-sm uppercase tracking-[0.32em] text-amber-200">
            TLB
          </span>
          <div>
            <p className="font-display text-2xl uppercase leading-none tracking-[0.18em] text-white">
              Tournament Live Board
            </p>
            <p className="text-xs uppercase tracking-[0.3em] text-white/55">
              Broadcast-grade event control
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm uppercase tracking-[0.24em] text-white/72 transition hover:bg-white/8 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
