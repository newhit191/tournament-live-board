"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { bootstrapAccountAndPrimaryPlayer } from "@/lib/account-bootstrap";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { isSupabaseInvalidApiKeyError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthActionState = {
  error: string | null;
  success: string | null;
};

const signInSchema = z.object({
  email: z.email("請輸入有效的 Email 格式。"),
  password: z.string().min(6, "密碼至少需要 6 個字元。"),
});

const signUpSchema = signInSchema.extend({
  displayName: z
    .string()
    .trim()
    .min(2, "顯示名稱至少需要 2 個字元。")
    .max(24, "顯示名稱最多 24 個字元。"),
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
  if (!config.isReady) {
    return {
      error: "系統尚未完成 Supabase 公開金鑰設定，請先檢查環境變數。",
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
      error: parsed.error.issues[0]?.message ?? "登入資料格式不正確。",
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
    // 若 service key 異常，先不中斷登入流程，改由資料庫 trigger 補齊初始化。
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
  if (!config.isReady) {
    return {
      error: "系統尚未完成 Supabase 公開金鑰設定，請先檢查環境變數。",
      success: null,
    };
  }

  const parsed = signUpSchema.safeParse({
    displayName: String(formData.get("displayName") ?? ""),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    nextPath: String(formData.get("nextPath") ?? ""),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "註冊資料格式不正確。",
      success: null,
    };
  }

  const { displayName, email, password, nextPath } = parsed.data;
  const safeNextPath = getSafeNextPath(nextPath);
  const normalizedDisplayName = displayName.trim();

  // 先檢查玩家名稱是否已存在（避免後續 unique index 報錯）
  try {
    if (config.isServiceReady) {
      const admin = createSupabaseAdminClient();
      const { data: existingPlayerName } = await admin
        .from("players")
        .select("id")
        .ilike("display_name", normalizedDisplayName)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (existingPlayerName) {
        return {
          error: "這個玩家名稱已被使用，請改用其他名稱。",
          success: null,
        };
      }
    }
  } catch {
    // service key 異常時，名稱檢查由資料庫約束處理
  }

  let userId: string | null = null;
  let userEmail: string | null = null;

  // 優先走 admin 建帳（可立即確認 email），若 service key 無效則自動 fallback 到一般 signUp
  if (config.isServiceReady) {
    try {
      const admin = createSupabaseAdminClient();
      const createUserResult = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: normalizedDisplayName,
        },
      });

      if (!createUserResult.error && createUserResult.data.user) {
        userId = createUserResult.data.user.id;
        userEmail = createUserResult.data.user.email ?? email;
      } else if (!isSupabaseInvalidApiKeyError(createUserResult.error)) {
        const rawMessage = createUserResult.error?.message?.toLowerCase() ?? "";
        const message =
          rawMessage.includes("already") || rawMessage.includes("duplicate")
            ? "這個 Email 已經註冊過了。"
            : rawMessage.includes("ux_players_display_name_active")
              ? "這個玩家名稱已被使用，請改用其他名稱。"
              : "建立帳號失敗，請稍後再試。";
        return {
          error: message,
          success: null,
        };
      }
    } catch (error) {
      if (!isSupabaseInvalidApiKeyError(error)) {
        return {
          error: "建立帳號失敗，請稍後再試。",
          success: null,
        };
      }
    }
  }

  if (!userId) {
    const client = await createSupabaseServerClient();
    const signUpResult = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: normalizedDisplayName,
        },
      },
    });

    if (signUpResult.error || !signUpResult.data.user) {
      const rawMessage = signUpResult.error?.message?.toLowerCase() ?? "";
      const message =
        rawMessage.includes("already") || rawMessage.includes("duplicate")
          ? "這個 Email 已經註冊過了。"
          : rawMessage.includes("ux_players_display_name_active")
            ? "這個玩家名稱已被使用，請改用其他名稱。"
            : "建立帳號失敗，請稍後再試。";

      return {
        error: message,
        success: null,
      };
    }

    userId = signUpResult.data.user.id;
    userEmail = signUpResult.data.user.email ?? email;
  }

  try {
    await bootstrapAccountAndPrimaryPlayer({
      userId,
      email: userEmail,
      displayName: normalizedDisplayName,
    });
  } catch {
    // 由 DB trigger 兜底，避免註冊流程中斷
  }

  const client = await createSupabaseServerClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return {
      error: null,
      success: "建立帳號成功，請用新帳密登入。",
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

