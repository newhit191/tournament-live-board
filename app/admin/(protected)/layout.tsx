import Link from "next/link";

import { logoutAction } from "@/app/admin/actions";
import { isAdminPasswordConfigured, requireAdminSession } from "@/lib/auth";
import { getTournamentSetupState } from "@/lib/tournament-service";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (isAdminPasswordConfigured()) {
    await requireAdminSession();
  }

  const setup = getTournamentSetupState();

  return (
    <div className="min-h-screen bg-black/20 pb-12">
      <header className="px-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 rounded-[1.75rem] border border-white/12 bg-black/35 px-5 py-4 backdrop-blur-xl">
          <div>
            <p className="eyebrow text-amber-200">Admin Control Room</p>
            <h1 className="mt-2 font-display text-4xl uppercase tracking-[0.08em] text-white">
              Tournament Live Board
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="rounded-full border border-white/14 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/76 transition hover:bg-white/8"
            >
              Public site
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-full border border-white/14 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/76 transition hover:bg-white/8"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-6 flex max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
        {!setup.adminPasswordConfigured ? (
          <div className="rounded-[1.5rem] border border-amber-300/25 bg-amber-300/10 px-5 py-4 text-sm leading-7 text-amber-100">
            Demo mode is active because <code>ADMIN_PASSWORD</code> is not set.
            Add it to your environment before deployment to enable the shared
            backstage password gate.
          </div>
        ) : null}

        {children}
      </main>
    </div>
  );
}
