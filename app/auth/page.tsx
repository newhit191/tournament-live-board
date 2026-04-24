import { redirect } from "next/navigation";

import { AuthPanel } from "@/app/auth/auth-panel";
import { SiteNav } from "@/components/site-nav";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "登入與註冊",
};

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const config = getSupabaseConfig();
  if (!config.isReady) {
    return (
      <div className="min-h-screen pb-24 safe-bottom-pad">
        <SiteNav />
        <main className="mx-auto flex min-h-[calc(100vh-100px)] max-w-7xl items-center px-4 py-12 sm:px-6 lg:px-8">
          <SupabaseSetupNotice
            title="登入系統尚未就緒"
            description="登入與註冊需要 Supabase 公開環境變數，請先完成設定後再嘗試登入。"
          />
        </main>
      </div>
    );
  }

  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  const query = await searchParams;
  const next = typeof query.next === "string" ? query.next : "";

  if (user) {
    if (next.startsWith("/") && !next.startsWith("//")) {
      redirect(next);
    }
    redirect("/hub");
  }

  return (
    <div className="min-h-screen pb-24 safe-bottom-pad">
      <SiteNav />
      <main className="mx-auto flex min-h-[calc(100vh-100px)] max-w-7xl items-center px-4 py-12 sm:px-6 lg:px-8">
        <AuthPanel nextPath={next} />
      </main>
    </div>
  );
}
