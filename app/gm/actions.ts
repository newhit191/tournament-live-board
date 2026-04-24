"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type GmActionState = {
  error: string | null;
  success: string | null;
};

const adjustSchema = z.object({
  targetPlayerId: z.uuid("玩家資料格式錯誤。"),
  delta: z.coerce.number().int().min(-9999).max(9999).refine((value) => value !== 0, {
    message: "補星數量不可為 0。",
  }),
  reason: z.string().trim().min(2, "請填寫補星原因。").max(80, "補星原因最多 80 字。"),
});

const deleteAccountSchema = z.object({
  targetAccountId: z.uuid("帳號識別錯誤。"),
});

async function ensureGm() {
  const client = await createSupabaseServerClient();
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

  return client;
}

export async function gmAdjustStarsAction(
  _prevState: GmActionState,
  formData: FormData,
): Promise<GmActionState> {
  const parsed = adjustSchema.safeParse({
    targetPlayerId: String(formData.get("targetPlayerId") ?? ""),
    delta: Number(formData.get("delta") ?? 0),
    reason: String(formData.get("reason") ?? ""),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "補星資料格式錯誤。",
      success: null,
    };
  }

  const client = await ensureGm();
  const { data, error } = await client.rpc("gm_adjust_player_stars", {
    p_target_player_id: parsed.data.targetPlayerId,
    p_delta: parsed.data.delta,
    p_reason: parsed.data.reason,
  });

  if (error || !data) {
    return {
      error: "補星失敗，請確認權限與數值後再試。",
      success: null,
    };
  }

  revalidatePath("/gm");
  revalidatePath("/hub");
  revalidatePath("/arena");
  revalidatePath("/rankings");
  return {
    error: null,
    success: `補星完成（${parsed.data.delta > 0 ? "+" : ""}${parsed.data.delta} 顆），已寫入帳本。`,
  };
}

export async function gmDeleteAccountAction(
  _prevState: GmActionState,
  formData: FormData,
): Promise<GmActionState> {
  const parsed = deleteAccountSchema.safeParse({
    targetAccountId: String(formData.get("targetAccountId") ?? ""),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "刪除帳號資料格式錯誤。",
      success: null,
    };
  }

  const client = await ensureGm();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return {
      error: "尚未登入，請重新登入。",
      success: null,
    };
  }

  if (parsed.data.targetAccountId === user.id) {
    return {
      error: "不可刪除目前登入中的 GM 帳號。",
      success: null,
    };
  }

  const adminClient = createSupabaseAdminClient();

  const { data: targetAccount } = await adminClient
    .from("accounts")
    .select("id, role")
    .eq("id", parsed.data.targetAccountId)
    .maybeSingle();

  if (!targetAccount) {
    const { error: deleteAuthMissingError } = await adminClient.auth.admin.deleteUser(
      parsed.data.targetAccountId,
    );
    const missingMessage = deleteAuthMissingError?.message?.toLowerCase() ?? "";
    if (deleteAuthMissingError && !missingMessage.includes("not found")) {
      return {
        error: `刪除帳號失敗：${deleteAuthMissingError.message}`,
        success: null,
      };
    }

    revalidatePath("/gm");
    revalidatePath("/hub");
    revalidatePath("/arena");
    revalidatePath("/rankings");
    return {
      error: null,
      success: "目標帳號已不存在，已同步最新清單。",
    };
  }

  if (targetAccount.role === "gm" || targetAccount.role === "admin") {
    return {
      error: "為避免誤刪管理權限帳號，目前僅允許刪除一般玩家帳號。",
      success: null,
    };
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(parsed.data.targetAccountId);
  if (deleteError) {
    const errorMessage = deleteError.message?.toLowerCase() ?? "";
    if (errorMessage.includes("not found")) {
      const { error: cleanupError } = await adminClient
        .from("accounts")
        .delete()
        .eq("id", parsed.data.targetAccountId);

      if (cleanupError) {
        return {
          error: `刪除帳號失敗：${cleanupError.message}`,
          success: null,
        };
      }

      revalidatePath("/gm");
      revalidatePath("/hub");
      revalidatePath("/arena");
      revalidatePath("/rankings");
      return {
        error: null,
        success: "目標登入帳號已不存在，已清理殘留資料。",
      };
    }

    return {
      error: `刪除帳號失敗：${deleteError.message}`,
      success: null,
    };
  }

  revalidatePath("/gm");
  revalidatePath("/hub");
  revalidatePath("/arena");
  revalidatePath("/rankings");
  return {
    error: null,
    success: "帳號已刪除，該帳號名下玩家與資料已一併清除。",
  };
}
