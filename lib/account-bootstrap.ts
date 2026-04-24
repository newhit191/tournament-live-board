import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type BootstrapInput = {
  userId: string;
  email: string | null;
  displayName: string | null;
};

function buildDefaultName(email: string | null, displayName: string | null) {
  const raw = (displayName ?? "").trim();
  if (raw.length > 0) return raw;
  if (email) return email.split("@")[0];
  return "玩家";
}

async function resolveUniquePlayerName(baseName: string) {
  const admin = createSupabaseAdminClient();
  let candidate = baseName.trim() || "玩家";
  let suffix = 1;

  while (suffix <= 100) {
    const { data: conflict } = await admin
      .from("players")
      .select("id")
      .ilike("display_name", candidate)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!conflict) {
      return candidate;
    }

    suffix += 1;
    candidate = `${baseName}_${suffix}`;
  }

  return `${baseName}_${Date.now().toString().slice(-4)}`;
}

export async function bootstrapAccountAndPrimaryPlayer(input: BootstrapInput) {
  const admin = createSupabaseAdminClient();
  const normalizedEmail = input.email?.trim().toLowerCase() ?? null;
  const defaultName = buildDefaultName(normalizedEmail, input.displayName);
  const shouldBeAdmin = normalizedEmail === "newhit191@gmail.com";

  const { data: existingAccount } = await admin
    .from("accounts")
    .select("id, role, display_name")
    .eq("id", input.userId)
    .maybeSingle();

  if (!existingAccount) {
    await admin.from("accounts").insert({
      id: input.userId,
      display_name: defaultName,
      role: shouldBeAdmin ? "admin" : "user",
    });
  } else {
    const patch: { role?: "admin"; display_name?: string } = {};
    if (shouldBeAdmin && existingAccount.role !== "admin") {
      patch.role = "admin";
    }
    if (!existingAccount.display_name) {
      patch.display_name = defaultName;
    }
    if (Object.keys(patch).length > 0) {
      await admin.from("accounts").update(patch).eq("id", input.userId);
    }
  }

  const { data: existingPlayer } = await admin
    .from("players")
    .select("id")
    .eq("owner_account_id", input.userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let primaryPlayerId = existingPlayer?.id ?? null;
  if (!primaryPlayerId) {
    const uniqueName = await resolveUniquePlayerName(defaultName);
    const { data: createdPlayer, error: createPlayerError } = await admin
      .from("players")
      .insert({
        owner_account_id: input.userId,
        family_id: input.userId,
        display_name: uniqueName,
        is_child: false,
      })
      .select("id")
      .single();

    if (createPlayerError) {
      throw new Error(`建立主玩家失敗：${createPlayerError.message}`);
    }
    primaryPlayerId = createdPlayer.id;
  }

  if (!primaryPlayerId) return;

  const { data: wallet } = await admin
    .from("player_wallets")
    .select("player_id, balance")
    .eq("player_id", primaryPlayerId)
    .maybeSingle();

  if (!wallet) {
    await admin.from("player_wallets").insert({
      player_id: primaryPlayerId,
      balance: 0,
      locked_balance: 0,
    });
  }

  const { data: hasSignupBonus } = await admin
    .from("wallet_ledger")
    .select("id")
    .eq("player_id", primaryPlayerId)
    .eq("event_type", "signup_bonus")
    .limit(1)
    .maybeSingle();

  if (!hasSignupBonus) {
    await admin
      .from("player_wallets")
      .update({
        balance: (wallet?.balance ?? 0) + 20,
      })
      .eq("player_id", primaryPlayerId);

    await admin.from("wallet_ledger").insert({
      player_id: primaryPlayerId,
      movement: "credit",
      amount: 20,
      event_type: "signup_bonus",
      reason: "新帳號註冊贈送 20 顆星星",
      created_by_account_id: input.userId,
    });
  }
}
