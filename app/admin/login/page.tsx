import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/app/admin/login/login-form";
import { isAdminAuthenticated, isAdminPasswordConfigured } from "@/lib/auth";

export const metadata = {
  title: "Admin Login",
};

export default async function AdminLoginPage() {
  const passwordConfigured = isAdminPasswordConfigured();
  const authenticated = await isAdminAuthenticated();

  if (passwordConfigured && authenticated) {
    redirect("/admin/tournaments");
  }

  const demoMode = !passwordConfigured;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="panel-strong w-full max-w-xl rounded-[2rem] px-6 py-8 sm:px-8">
        <p className="eyebrow text-cyan-200">Backstage Access</p>
        <h1 className="mt-3 font-display text-5xl uppercase tracking-[0.08em] text-white sm:text-6xl">
          Admin Login
        </h1>
        <p className="mt-4 text-base leading-8 text-white/68">
          One shared password keeps the operator console separate from the public
          display. This is the fast, lightweight version-one gate for small event
          teams.
        </p>

        {demoMode ? (
          <div className="mt-6 rounded-[1.5rem] border border-amber-300/25 bg-amber-300/10 px-5 py-4 text-sm leading-7 text-amber-100">
            Demo mode is open because <code>ADMIN_PASSWORD</code> is not
            configured. Submit once to create the local admin session.
          </div>
        ) : null}

        <div className="mt-8">
          <AdminLoginForm demoMode={demoMode} />
        </div>
      </div>
    </div>
  );
}
