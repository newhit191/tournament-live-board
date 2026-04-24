import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";

import { GmAdjustForm } from "@/app/gm/gm-adjust-form";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PlayerWithWallet = {
  id: string;
  display_name: string;
  owner_account_id: string;
  player_wallets:
    | {
        balance: number;
      }
    | {
        balance: number;
      }[]
    | null;
};

type AccountRow = {
  id: string;
  display_name: string | null;
  role: "user" | "gm" | "admin";
};

async function GmPageContent() {
  const client = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: account } = await client
    .from("accounts")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!account || !["gm", "admin"].includes(account.role)) {
    redirect("/hub");
  }

  // GM 頁面要看全部玩家，需使用 admin client（繞過一般玩家 RLS）
  const { data: playersRaw } = await admin
    .from("players")
    .select("id, display_name, owner_account_id, player_wallets(balance)")
    .order("created_at", { ascending: false })
    .limit(1000);

  const ownerIds = Array.from(
    new Set((playersRaw as PlayerWithWallet[] | null)?.map((player) => player.owner_account_id) ?? []),
  );

  const { data: owners } = ownerIds.length
    ? await admin.from("accounts").select("id, display_name").in("id", ownerIds)
    : { data: [] as { id: string; display_name: string | null }[] };

  const ownerNameMap = new Map((owners ?? []).map((owner) => [owner.id, owner.display_name]));
  const playerCountByOwner = new Map<string, number>();
  (playersRaw as PlayerWithWallet[] | null)?.forEach((player) => {
    const count = playerCountByOwner.get(player.owner_account_id) ?? 0;
    playerCountByOwner.set(player.owner_account_id, count + 1);
  });

  const players = (playersRaw as PlayerWithWallet[] | null)?.map((player) => {
    const wallet = Array.isArray(player.player_wallets)
      ? player.player_wallets[0]
      : player.player_wallets;

    return {
      id: player.id,
      displayName: player.display_name,
      ownerName: ownerNameMap.get(player.owner_account_id) ?? null,
      balance: wallet?.balance ?? 0,
    };
  }) ?? [];

  const { data: accountsRaw } = await admin
    .from("accounts")
    .select("id, display_name, role")
    .order("created_at", { ascending: false })
    .limit(1000);

  const authUsers: { id: string; email: string | null; displayName: string | null }[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data: authBatch, error: authError } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (authError) {
      break;
    }

    const users = authBatch.users ?? [];
    users.forEach((userRow) => {
      const metadata = userRow.user_metadata as { display_name?: string } | null;
      authUsers.push({
        id: userRow.id,
        email: userRow.email ?? null,
        displayName: metadata?.display_name?.trim() || null,
      });
    });

    if (users.length < perPage) {
      break;
    }
    page += 1;
  }

  const accountRowById = new Map(
    ((accountsRaw as AccountRow[] | null) ?? []).map((row) => [row.id, row]),
  );
  const authById = new Map(authUsers.map((item) => [item.id, item]));

  const mergedAccountIds = new Set<string>([
    ...Array.from(accountRowById.keys()),
    ...Array.from(authById.keys()),
  ]);

  const accounts = Array.from(mergedAccountIds)
    .map((accountId) => {
      const accountRow = accountRowById.get(accountId);
      const authRow = authById.get(accountId);

      const email = authRow?.email ?? null;
      const fallbackDisplayName =
        authRow?.displayName ??
        (email ? email.split("@")[0] : null) ??
        "未命名帳號";

      return {
        id: accountId,
        displayName: accountRow?.display_name ?? fallbackDisplayName,
        email,
        role: accountRow?.role ?? "user",
        playerCount: playerCountByOwner.get(accountId) ?? 0,
      };
    })
    .sort((a, b) => {
      const roleWeight = (role: "user" | "gm" | "admin") =>
        role === "admin" ? 2 : role === "gm" ? 1 : 0;
      const roleDiff = roleWeight(b.role) - roleWeight(a.role);
      if (roleDiff !== 0) return roleDiff;
      return (a.displayName ?? "").localeCompare(b.displayName ?? "", "zh-Hant");
    });

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="panel-strong rounded-[2rem] p-6 sm:p-8">
        <p className="eyebrow text-amber-200">GM 後台</p>
        <h1 className="mt-2 font-display text-4xl tracking-[0.08em] text-white sm:text-5xl">
          星星補正管理
        </h1>
        <p className="mt-3 text-sm leading-7 text-white/68 sm:text-base">
          你目前位於 GM 介面（權限：{account.role.toUpperCase()}），可針對玩家執行星星補正。所有操作都會寫入不可逆帳本。
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/hub"
            className="rounded-full border border-white/14 px-4 py-2 text-xs tracking-[0.18em] text-white/85 transition hover:bg-white/8"
          >
            返回玩家中心
          </Link>
          <Link
            href="/arena"
            className="rounded-full border border-cyan-300/30 bg-cyan-300/12 px-4 py-2 text-xs tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-300/20"
          >
            前往約戰看板
          </Link>
          <Link
            href="/rankings"
            className="rounded-full border border-amber-300/35 bg-amber-300/12 px-4 py-2 text-xs tracking-[0.18em] text-amber-100 transition hover:bg-amber-300/20"
          >
            查看排行榜
          </Link>
        </div>
      </section>

      <section className="panel rounded-[1.5rem] p-5 sm:p-6">
        <GmAdjustForm players={players} accounts={accounts} currentUserId={user.id} />
      </section>
    </main>
  );
}

export default async function GmPage() {
  const config = getSupabaseConfig();
  if (!config.isReady || !config.isServiceReady) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <SupabaseSetupNotice
          title="GM 後台尚未就緒"
          description="GM 後台需要 Supabase 公開金鑰與 Service Role 金鑰。請先補齊環境變數後重整。"
          requireServiceRole
        />
      </main>
    );
  }

  try {
    return await GmPageContent();
  } catch (error) {
    unstable_rethrow(error);
    const detail =
      error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <SupabaseSetupNotice
          title="GM 後台資料載入失敗"
          description="請確認 Supabase migration 已完整執行，再檢查 Vercel Runtime Logs。"
          requireServiceRole
          debugMessage={detail}
        />
      </main>
    );
  }
}
