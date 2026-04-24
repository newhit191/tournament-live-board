"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { bootstrapAccountAndPrimaryPlayer } from "@/lib/account-bootstrap";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthActionState = {
  error: string | null;
  success: string | null;
};

const signInSchema = z.object({
  email: z.email("請輸入正確的 Email 格式。"),
  password: z.string().min(6, "密碼至少需要 6 個字元。"),
});

const signUpSchema = signInSchema.extend({
  displayName: z.string().trim().min(2, "顯示名稱至少 2 個字。").max(24, "顯示名稱最多 24 個字。"),
  inviteCode: z.string().trim().min(4, "請輸入邀請碼。"),
  nextPath: z.string().trim().optional(),
});

function getSafeNextPath(raw: string | undefined) {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const config = getSupabaseConfig();
  if (!config.isReady || !config.isServiceReady) {
    return {
      error: "登入系統尚未完成設定，請稍後再試或聯繫管理者。",
      success: null,
    };
  }

  const safeNextPath = getSafeNextPath(String(formData.get("nextPath") ?? ""));
  const parsed = signInSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "登入資料格式錯誤。",
      success: null,
    };
  }

  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return {
      error: "登入失敗，請確認帳號密碼是否正確。",
      success: null,
    };
  }

  try {
    await bootstrapAccountAndPrimaryPlayer({
      userId: data.user.id,
      email: data.user.email ?? parsed.data.email,
      displayName:
        (data.user.user_metadata as { display_name?: string } | null)?.display_name ?? null,
    });
  } catch {
    // 帳號已登入成功，初始化失敗時不直接中斷登入流程。
  }

  if (safeNextPath) {
    redirect(safeNextPath);
  }
  redirect("/hub");
}

export async function signUpWithInviteAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const config = getSupabaseConfig();
  if (!config.isReady || !config.isServiceReady) {
    return {
      error: "註冊系統尚未完成設定，請稍後再試或聯繫管理者。",
      success: null,
    };
  }

  const parsed = signUpSchema.safeParse({
    displayName: String(formData.get("displayName") ?? ""),
    inviteCode: String(formData.get("inviteCode") ?? "").toUpperCase(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    nextPath: String(formData.get("nextPath") ?? ""),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "註冊資料格式錯誤。",
      success: null,
    };
  }

  const { displayName, inviteCode, email, password, nextPath } = parsed.data;
  const safeNextPath = getSafeNextPath(nextPath);
  const admin = createSupabaseAdminClient();
  const normalizedDisplayName = displayName.trim();

  const { data: invite } = await admin
    .from("invite_codes")
    .select("code, max_uses, used_count, is_active, expires_at")
    .eq("code", inviteCode)
    .maybeSingle();

  const inviteInvalid =
    !invite ||
    !invite.is_active ||
    invite.used_count >= invite.max_uses ||
    (invite.expires_at ? new Date(invite.expires_at).getTime() <= Date.now() : false);

  if (inviteInvalid) {
    return {
      error: "邀請碼無效、已過期或使用次數已滿。",
      success: null,
    };
  }

  const { data: existingPlayerName } = await admin
    .from("players")
    .select("id")
    .ilike("display_name", normalizedDisplayName)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (existingPlayerName) {
    return {
      error: "玩家名稱已被使用，請更換顯示名稱後再註冊。",
      success: null,
    };
  }

  const createUserResult = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: normalizedDisplayName,
    },
  });

  if (createUserResult.error || !createUserResult.data.user) {
    const rawMessage = createUserResult.error?.message?.toLowerCase() ?? "";
    const message =
      rawMessage.includes("already") || rawMessage.includes("duplicate")
        ? "此 Email 已被註冊。"
        : rawMessage.includes("ux_players_display_name_active")
          ? "玩家名稱已被使用，請更換顯示名稱後再註冊。"
        : "建立帳號失敗，請稍後再試。";

    return {
      error: message,
      success: null,
    };
  }

  const userId = createUserResult.data.user.id;
  const userEmail = createUserResult.data.user.email ?? email;

  const consumeInviteResult = await admin.rpc("consume_invite_code", {
    p_code: inviteCode,
  });

  if (consumeInviteResult.error || !consumeInviteResult.data) {
    await admin.auth.admin.deleteUser(userId);
    return {
      error: "邀請碼核銷失敗，請稍後再試。",
      success: null,
    };
  }

  await bootstrapAccountAndPrimaryPlayer({
    userId,
    email: userEmail,
    displayName: normalizedDisplayName,
  });

  const client = await createSupabaseServerClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return {
      error: null,
      success: "帳號建立成功，請重新登入一次。",
    };
  }

  if (safeNextPath) {
    redirect(safeNextPath);
  }
  redirect("/hub");
}

export async function signOutAction() {
  const config = getSupabaseConfig();
  if (!config.isReady) {
    redirect("/auth");
  }

  const client = await createSupabaseServerClient();
  await client.auth.signOut();
  redirect("/auth");
}
