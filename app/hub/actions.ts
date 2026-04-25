"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { signOutAction } from "@/app/auth/actions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type HubActionState = {
  error: string | null;
  success: string | null;
};

const createPlayerSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "玩家名稱至少 2 個字。")
    .max(24, "玩家名稱最多 24 個字。"),
  isChild: z.boolean().default(false),
});

const familyTransferSchema = z.object({
  fromPlayerId: z.uuid("來源玩家格式錯誤。"),
  toPlayerId: z.uuid("目標玩家格式錯誤。"),
  amount: z.coerce.number().int().min(1, "轉帳最少 1 顆星。"),
});

const equipTitleSchema = z.object({
  playerId: z.uuid("玩家選擇錯誤。"),
  titleDefinitionId: z.string().optional(),
});

const renamePlayerSchema = z.object({
  playerId: z.uuid("玩家選擇錯誤。"),
  displayName: z
    .string()
    .trim()
    .min(2, "玩家 ID 至少 2 個字。")
    .max(24, "玩家 ID 最多 24 個字。"),
});

async function requireUserId() {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  return user.id;
}

export async function createPlayerProfileAction(
  _prevState: HubActionState,
  formData: FormData,
): Promise<HubActionState> {
  const ownerAccountId = await requireUserId();
  const parsed = createPlayerSchema.safeParse({
    displayName: String(formData.get("displayName") ?? ""),
    isChild: formData.get("isChild") === "on",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "玩家資料格式錯誤。",
      success: null,
    };
  }

  const admin = createSupabaseAdminClient();
  const normalizedName = parsed.data.displayName.trim();

  const { data: existingPlayer } = await admin
    .from("players")
    .select("id")
    .ilike("display_name", normalizedName)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (existingPlayer) {
    return {
      error: "玩家名稱已被使用，請換一個名稱。",
      success: null,
    };
  }

  const { error } = await admin.from("players").insert({
    owner_account_id: ownerAccountId,
    family_id: ownerAccountId,
    display_name: normalizedName,
    is_child: parsed.data.isChild,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        error: "玩家名稱重複，請改用其他名稱。",
        success: null,
      };
    }
    return {
      error: "建立玩家失敗，請稍後再試。",
      success: null,
    };
  }

  revalidatePath("/hub");
  return {
    error: null,
    success: "玩家建立成功。",
  };
}

export async function transferFamilyStarsAction(
  _prevState: HubActionState,
  formData: FormData,
): Promise<HubActionState> {
  await requireUserId();
  const parsed = familyTransferSchema.safeParse({
    fromPlayerId: String(formData.get("fromPlayerId") ?? ""),
    toPlayerId: String(formData.get("toPlayerId") ?? ""),
    amount: Number(formData.get("amount") ?? 0),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "轉帳資料格式錯誤。",
      success: null,
    };
  }

  if (parsed.data.fromPlayerId === parsed.data.toPlayerId) {
    return {
      error: "來源玩家與目標玩家不能相同。",
      success: null,
    };
  }

  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("transfer_family_stars", {
    p_from_player_id: parsed.data.fromPlayerId,
    p_to_player_id: parsed.data.toPlayerId,
    p_amount: parsed.data.amount,
    p_reason: "玩家中心轉帳",
  });

  if (error || !data) {
    return {
      error: "玩家轉帳失敗，請確認星星餘額或玩家狀態。",
      success: null,
    };
  }

  revalidatePath("/hub");
  return {
    error: null,
    success: "玩家轉帳成功。",
  };
}

export async function equipPlayerTitleAction(
  _prevState: HubActionState,
  formData: FormData,
): Promise<HubActionState> {
  const ownerAccountId = await requireUserId();
  const parsed = equipTitleSchema.safeParse({
    playerId: String(formData.get("playerId") ?? ""),
    titleDefinitionId: String(formData.get("titleDefinitionId") ?? "").trim(),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "稱號資料格式錯誤。",
      success: null,
    };
  }

  const admin = createSupabaseAdminClient();
  const { data: player } = await admin
    .from("players")
    .select("id, owner_account_id")
    .eq("id", parsed.data.playerId)
    .maybeSingle();

  if (!player || player.owner_account_id !== ownerAccountId) {
    return {
      error: "你只能修改自己帳號底下玩家的稱號。",
      success: null,
    };
  }

  await admin
    .from("player_titles")
    .update({ is_equipped: false })
    .eq("player_id", parsed.data.playerId);

  if (parsed.data.titleDefinitionId) {
    const { data: unlockedTitle } = await admin
      .from("player_titles")
      .select("id")
      .eq("player_id", parsed.data.playerId)
      .eq("title_definition_id", parsed.data.titleDefinitionId)
      .maybeSingle();

    if (!unlockedTitle) {
      return {
        error: "你尚未解鎖這個稱號。",
        success: null,
      };
    }

    await admin
      .from("player_titles")
      .update({ is_equipped: true })
      .eq("player_id", parsed.data.playerId)
      .eq("title_definition_id", parsed.data.titleDefinitionId);
  }

  revalidatePath("/hub");
  revalidatePath("/rankings");
  return {
    error: null,
    success: "稱號已更新。",
  };
}

export async function renamePlayerDisplayNameAction(
  _prevState: HubActionState,
  formData: FormData,
): Promise<HubActionState> {
  const ownerAccountId = await requireUserId();
  const parsed = renamePlayerSchema.safeParse({
    playerId: String(formData.get("playerId") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "玩家 ID 格式錯誤。",
      success: null,
    };
  }

  const admin = createSupabaseAdminClient();
  const normalizedName = parsed.data.displayName.trim();

  const { data: ownedPlayer } = await admin
    .from("players")
    .select("id, owner_account_id, display_name")
    .eq("id", parsed.data.playerId)
    .eq("is_active", true)
    .maybeSingle();

  if (!ownedPlayer || ownedPlayer.owner_account_id !== ownerAccountId) {
    return {
      error: "你只能修改自己帳號底下的玩家 ID。",
      success: null,
    };
  }

  if ((ownedPlayer.display_name ?? "").trim() === normalizedName) {
    return {
      error: "新 ID 與目前相同，請輸入不同名稱。",
      success: null,
    };
  }

  const { data: existingPlayer } = await admin
    .from("players")
    .select("id")
    .ilike("display_name", normalizedName)
    .eq("is_active", true)
    .neq("id", parsed.data.playerId)
    .limit(1)
    .maybeSingle();

  if (existingPlayer) {
    return {
      error: "這個玩家 ID 已被使用，請換一個名稱。",
      success: null,
    };
  }

  const { error } = await admin
    .from("players")
    .update({ display_name: normalizedName })
    .eq("id", parsed.data.playerId)
    .eq("owner_account_id", ownerAccountId);

  if (error) {
    if (error.code === "23505") {
      return {
        error: "這個玩家 ID 已被使用，請換一個名稱。",
        success: null,
      };
    }
    return {
      error: "更新玩家 ID 失敗，請稍後再試。",
      success: null,
    };
  }

  revalidatePath("/hub");
  revalidatePath("/arena");
  revalidatePath("/rankings");
  revalidatePath("/gm");

  return {
    error: null,
    success: "玩家 ID 更新成功。",
  };
}

export async function logoutFromHubAction() {
  await signOutAction();
}
