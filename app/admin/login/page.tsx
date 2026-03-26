import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/app/admin/login/login-form";
import { isAdminAuthenticated, isAdminPasswordConfigured } from "@/lib/auth";

export const metadata = {
  title: "後台登入",
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
        <p className="eyebrow text-cyan-200">主辦方登入</p>
        <h1 className="mt-3 font-display text-3xl tracking-[0.06em] text-white sm:text-5xl">
          進入賽事控制台
        </h1>
        <p className="mt-4 text-base leading-8 text-white/68">
          後台可建立賽事、設定展示場次、更新比分與查看資料同步狀態。
        </p>

        {demoMode ? (
          <div className="mt-6 rounded-[1.5rem] border border-amber-300/25 bg-amber-300/10 px-5 py-4 text-sm leading-7 text-amber-100">
            目前尚未設定 <code>ADMIN_PASSWORD</code>，本機以展示模式開放後台。
          </div>
        ) : null}

        <div className="mt-8">
          <AdminLoginForm demoMode={demoMode} />
        </div>
      </div>
    </div>
  );
}
