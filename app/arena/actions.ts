"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  buildNextSingleEliminationRoundMatches,
  calculateRoundRobinStandings,
  calculateSingleEliminationPodium,
  generateRoundRobinMatches,
  generateSingleEliminationFirstRound,
  parseArenaMatchMeta,
  stringifyArenaMatchMeta,
  type ArenaMatchMeta,
} from "@/lib/arena-schedule";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ChallengeCompetitionFormat } from "@/lib/arena-types";

export type ArenaActionState = {
  error: string | null;
  success: string | null;
};

const createChallengeSchema = z
  .object({
    mode: z.enum(["single_stake", "prize_pool"]),
    competitionFormat: z.enum([
      "single_match",
      "manual_pool",
      "single_elimination",
      "double_elimination",
      "round_robin",
    ]),
    title: z.string().trim().min(2, "約戰標題至少 2 個字。").max(80, "約戰標題最多 80 個字。"),
    hostPlayerId: z.uuid("主辦玩家格式錯誤。"),
    duelPlayerId: z.uuid("指定對手格式錯誤。").optional(),
    description: z.string().trim().max(240, "簡述最多 240 字。").optional(),
    city: z.string().trim().max(40, "城市最多 40 字。").optional(),
    venue: z.string().trim().max(80, "場地最多 80 字。").optional(),
    startsAt: z.string().trim().optional(),
    hostStake: z.coerce.number().int().min(0).max(9999).default(0),
    participantLimit: z.coerce.number().int().min(2).max(128).default(2),
    entryFee: z.coerce.number().int().min(0).max(9999).default(0),
    rewardFirst: z.coerce.number().int().min(0).max(99999).default(0),
    rewardSecond: z.coerce.number().int().min(0).max(99999).default(0),
    rewardThird: z.coerce.number().int().min(0).max(99999).default(0),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "single_stake") {
      return;
    }

    if (value.competitionFormat === "single_match") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["competitionFormat"],
        message: "多人獎池不可使用單場賽制。",
      });
    }

    if (value.participantLimit < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["participantLimit"],
        message: "多人獎池至少需要 3 位參賽者。",
      });
    }

    if (value.entryFee <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entryFee"],
        message: "多人獎池每人參賽費至少 1 顆。",
      });
    }

    const pool = value.participantLimit * value.entryFee;
    const rewardTotal = value.rewardFirst + value.rewardSecond + value.rewardThird;
    if (rewardTotal !== pool) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rewardFirst"],
        message: `獎勵總和需等於總獎池（${pool} 顆）。`,
      });
    }
  });

const joinChallengeSchema = z.object({
  challengeId: z.uuid("約戰識別錯誤。"),
  playerId: z.uuid("玩家識別錯誤。"),
  stake: z.coerce.number().int().min(0).max(9999).default(0),
});

const cancelChallengeSchema = z.object({
  challengeId: z.uuid("約戰識別錯誤。"),
  reason: z.string().trim().max(80, "取消原因最多 80 字。").optional(),
});

const settleSingleSchema = z.object({
  challengeId: z.uuid("約戰識別錯誤。"),
  winnerPlayerId: z.uuid("勝方玩家格式錯誤。"),
});

const settlePoolSchema = z.object({
  challengeId: z.uuid("約戰識別錯誤。"),
  firstPlayerId: z.uuid("第一名玩家格式錯誤。"),
  secondPlayerId: z.uuid("第二名玩家格式錯誤。"),
  thirdPlayerId: z.string().optional(),
});

const generateScheduleSchema = z.object({
  challengeId: z.uuid("約戰識別錯誤。"),
});

const settleMatchSchema = z.object({
  challengeId: z.uuid("約戰識別錯誤。"),
  matchId: z.uuid("場次識別錯誤。"),
  winnerPlayerId: z.uuid("勝方玩家格式錯誤。"),
  playerAScore: z.coerce.number().int().min(0).max(999).optional(),
  playerBScore: z.coerce.number().int().min(0).max(999).optional(),
});

type LoadedChallenge = {
  id: string;
  mode: "single_stake" | "prize_pool";
  status: "open" | "in_progress" | "completed" | "cancelled";
  competition_format: ChallengeCompetitionFormat;
  created_by_account_id: string;
  participant_limit: number;
  entry_fee: number;
  reward_first: number;
  reward_second: number;
  reward_third: number;
  completed_at: string | null;
};

type LoadedParticipant = {
  id: string;
  player_id: string;
  locked_amount: number;
  result:
    | "pending"
    | "winner"
    | "loser"
    | "rank_1"
    | "rank_2"
    | "rank_3"
    | "rank_other"
    | "cancelled";
  final_rank: number | null;
  players: {
    id: string;
    display_name: string;
  } | null;
};

type LoadedParticipantRow = Omit<LoadedParticipant, "players"> & {
  players:
    | {
        id: string;
        display_name: string;
      }
    | {
        id: string;
        display_name: string;
      }[]
    | null;
};

type LoadedMatch = {
  id: string;
  player_a_id: string;
  player_b_id: string;
  winner_player_id: string | null;
  status: "pending" | "completed" | "cancelled";
  notes: string | null;
};

function normalizeOptionalText(raw: string | undefined) {
  const value = raw?.trim();
  return value ? value : null;
}

function normalizeDateTime(raw: string | undefined) {
  const value = raw?.trim();
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

async function getViewerAndRole() {
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

  return {
    userId: user.id,
    role: (account?.role as "user" | "gm" | "admin" | undefined) ?? "user",
  };
}

function canManageChallenge(challenge: LoadedChallenge, userId: string, role: "user" | "gm" | "admin") {
  if (challenge.created_by_account_id === userId) return true;
  return role === "gm" || role === "admin";
}

async function loadChallengeBundle(challengeId: string) {
  const admin = createSupabaseAdminClient();

  const { data: challenge, error: challengeError } = await admin
    .from("challenges")
    .select(
      "id, mode, status, competition_format, created_by_account_id, participant_limit, entry_fee, reward_first, reward_second, reward_third, completed_at",
    )
    .eq("id", challengeId)
    .maybeSingle();

  if (challengeError || !challenge) {
    return {
      challenge: null,
      participants: [] as LoadedParticipant[],
      matches: [] as LoadedMatch[],
    };
  }

  const [participantsRes, matchesRes] = await Promise.all([
    admin
      .from("challenge_participants")
      .select("id, player_id, locked_amount, result, final_rank, players(id, display_name)")
      .eq("challenge_id", challengeId)
      .order("created_at", { ascending: true }),
    admin
      .from("matches")
      .select("id, player_a_id, player_b_id, winner_player_id, status, notes")
      .eq("challenge_id", challengeId)
      .order("created_at", { ascending: true }),
  ]);

  const participants = ((participantsRes.data ?? []) as LoadedParticipantRow[]).map((item) => ({
    ...item,
    players: Array.isArray(item.players) ? item.players[0] ?? null : item.players,
  }));

  return {
    challenge: challenge as LoadedChallenge,
    participants,
    matches: (matchesRes.data ?? []) as LoadedMatch[],
  };
}

function getPlayerNameMap(participants: LoadedParticipant[]) {
  const map = new Map<string, string>();
  participants.forEach((item) => {
    map.set(item.player_id, item.players?.display_name ?? "未知玩家");
  });
  return map;
}

function mapScheduleErrorMessage(message: string) {
  if (message.includes("UNSUPPORTED_COMPETITION_FORMAT")) {
    return "此賽制暫不支援自動賽程。";
  }
  if (message.includes("NO_PARTICIPANTS")) {
    return "參賽人數不足，尚無法產生賽程。";
  }
  if (message.includes("SCHEDULE_ALREADY_EXISTS")) {
    return "此約戰已存在賽程。";
  }
  return "賽程處理失敗，請稍後再試。";
}

async function createInitialScheduleRows(input: {
  challenge: LoadedChallenge;
  participants: LoadedParticipant[];
}) {
  const { challenge, participants } = input;
  const playerIds = participants.map((item) => item.player_id);

  if (playerIds.length < 2) {
    throw new Error("NO_PARTICIPANTS");
  }

  if (challenge.competition_format === "single_elimination") {
    return generateSingleEliminationFirstRound(challenge.id, playerIds);
  }
  if (challenge.competition_format === "round_robin") {
    return generateRoundRobinMatches(challenge.id, playerIds);
  }

  throw new Error("UNSUPPORTED_COMPETITION_FORMAT");
}

async function settlePrizePoolByOrder(params: {
  challengeId: string;
  firstPlayerId: string;
  secondPlayerId: string;
  thirdPlayerId: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("settle_prize_pool_challenge", {
    p_challenge_id: params.challengeId,
    p_first_player_id: params.firstPlayerId,
    p_second_player_id: params.secondPlayerId,
    p_third_player_id: params.thirdPlayerId,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "PRIZE_POOL_SETTLEMENT_FAILED");
  }
}

async function maybeAdvanceSingleElimination(input: {
  challenge: LoadedChallenge;
  participants: LoadedParticipant[];
  matches: LoadedMatch[];
}) {
  if (input.challenge.competition_format !== "single_elimination") {
    return { autoMessage: null as string | null };
  }

  const admin = createSupabaseAdminClient();
  let matches = [...input.matches];
  let generatedRoundCount = 0;

  while (true) {
    const roundNumbers = matches
      .map((match) => parseArenaMatchMeta(match.notes)?.round ?? 0)
      .filter((round) => round > 0);

    const currentMaxRound = roundNumbers.length ? Math.max(...roundNumbers) : 0;
    if (currentMaxRound === 0) {
      break;
    }

    const currentRoundMatches = matches.filter(
      (match) => (parseArenaMatchMeta(match.notes)?.round ?? 0) === currentMaxRound,
    );
    const allCompleted = currentRoundMatches.every((match) => match.status === "completed");
    if (!allCompleted) {
      break;
    }

    const nextRound = currentMaxRound + 1;
    const hasNextRound = matches.some(
      (match) => (parseArenaMatchMeta(match.notes)?.round ?? 0) === nextRound,
    );
    if (hasNextRound) {
      break;
    }

    const rows = buildNextSingleEliminationRoundMatches(
      input.challenge.id,
      currentRoundMatches.map((item) => ({
        id: item.id,
        playerAId: item.player_a_id,
        playerBId: item.player_b_id,
        winnerPlayerId: item.winner_player_id,
        status: item.status,
        notes: item.notes,
      })),
      nextRound,
    );

    if (rows.length === 0) {
      break;
    }

    const { error: insertError } = await admin.from("matches").insert(rows);
    if (insertError) {
      throw new Error(insertError.message);
    }
    generatedRoundCount += 1;

    const { data: nextMatches } = await admin
      .from("matches")
      .select("id, player_a_id, player_b_id, winner_player_id, status, notes")
      .eq("challenge_id", input.challenge.id)
      .order("created_at", { ascending: true });
    matches = (nextMatches ?? []) as LoadedMatch[];
  }

  const pendingCount = matches.filter((item) => item.status === "pending").length;
  if (pendingCount > 0) {
    if (generatedRoundCount > 0) {
      return { autoMessage: "已自動建立下一輪賽程。" };
    }
    return { autoMessage: null };
  }

  const podium = calculateSingleEliminationPodium(
    input.participants.map((participant) => ({
      playerId: participant.player_id,
      displayName: participant.players?.display_name ?? "未知玩家",
    })),
    matches.map((item) => ({
      id: item.id,
      playerAId: item.player_a_id,
      playerBId: item.player_b_id,
      winnerPlayerId: item.winner_player_id,
      status: item.status,
      notes: item.notes,
    })),
  );

  if (!podium.first || !podium.second) {
    return { autoMessage: null };
  }

  const third =
    podium.third ??
    input.participants
      .map((participant) => participant.player_id)
      .find((playerId) => playerId !== podium.first && playerId !== podium.second) ??
    null;

  await settlePrizePoolByOrder({
    challengeId: input.challenge.id,
    firstPlayerId: podium.first,
    secondPlayerId: podium.second,
    thirdPlayerId: third,
  });

  return { autoMessage: "賽程已完賽，已自動完成獎池結算。" };
}

async function maybeAdvanceRoundRobin(input: {
  challenge: LoadedChallenge;
  participants: LoadedParticipant[];
  matches: LoadedMatch[];
}) {
  if (input.challenge.competition_format !== "round_robin") {
    return { autoMessage: null as string | null };
  }

  const admin = createSupabaseAdminClient();
  const allMatches = [...input.matches];
  const regularMatches = allMatches.filter(
    (match) => (parseArenaMatchMeta(match.notes)?.stage ?? "regular") === "regular",
  );
  const playoffMatches = allMatches.filter(
    (match) => (parseArenaMatchMeta(match.notes)?.stage ?? "regular") === "playoff",
  );

  const regularPending = regularMatches.some((match) => match.status === "pending");
  if (regularPending) {
    return { autoMessage: null };
  }

  const standings = calculateRoundRobinStandings(
    input.participants.map((participant) => ({
      playerId: participant.player_id,
      displayName: participant.players?.display_name ?? "未知玩家",
    })),
    regularMatches.map((item) => ({
      id: item.id,
      playerAId: item.player_a_id,
      playerBId: item.player_b_id,
      winnerPlayerId: item.winner_player_id,
      status: item.status,
      notes: item.notes,
    })),
  );

  if (standings.length < 2) {
    return { autoMessage: null };
  }

  const maxRegularRound = regularMatches
    .map((match) => parseArenaMatchMeta(match.notes)?.round ?? 0)
    .reduce((max, round) => (round > max ? round : max), 1);

  const semifinal = playoffMatches.find(
    (match) => (parseArenaMatchMeta(match.notes)?.matchOrder ?? 0) === 1,
  );
  const final = playoffMatches.find(
    (match) => (parseArenaMatchMeta(match.notes)?.matchOrder ?? 0) === 2,
  );

  if (standings.length >= 3 && !semifinal) {
    const second = standings[1]?.playerId;
    const third = standings[2]?.playerId;
    if (second && third && second !== third) {
      const { error } = await admin.from("matches").insert({
        challenge_id: input.challenge.id,
        player_a_id: second,
        player_b_id: third,
        winner_player_id: null,
        status: "pending",
        settled_at: null,
        notes: stringifyArenaMatchMeta({
          format: "round_robin",
          stage: "playoff",
          round: maxRegularRound + 1,
          matchOrder: 1,
        }),
      });
      if (error) {
        throw new Error(error.message);
      }
      return { autoMessage: "循環賽已完成，已自動建立季後賽（2 vs 3）。" };
    }
  }

  if (standings.length >= 3 && semifinal && semifinal.status === "completed" && semifinal.winner_player_id && !final) {
    const topOne = standings[0]?.playerId;
    if (topOne && topOne !== semifinal.winner_player_id) {
      const { error } = await admin.from("matches").insert({
        challenge_id: input.challenge.id,
        player_a_id: topOne,
        player_b_id: semifinal.winner_player_id,
        winner_player_id: null,
        status: "pending",
        settled_at: null,
        notes: stringifyArenaMatchMeta({
          format: "round_robin",
          stage: "playoff",
          round: maxRegularRound + 2,
          matchOrder: 2,
        }),
      });
      if (error) {
        throw new Error(error.message);
      }
      return { autoMessage: "已自動建立冠軍賽（第 1 名 vs 季後賽勝者）。" };
    }
  }

  if (standings.length === 2 && playoffMatches.length === 0) {
    await settlePrizePoolByOrder({
      challengeId: input.challenge.id,
      firstPlayerId: standings[0].playerId,
      secondPlayerId: standings[1].playerId,
      thirdPlayerId: null,
    });
    return { autoMessage: "循環賽已完賽，已依名次完成結算。" };
  }

  if (!final || final.status !== "completed" || !final.winner_player_id) {
    return { autoMessage: null };
  }

  const first = final.winner_player_id;
  const second = final.player_a_id === first ? final.player_b_id : final.player_a_id;
  const third = semifinal
    ? semifinal.player_a_id === semifinal.winner_player_id
      ? semifinal.player_b_id
      : semifinal.player_a_id
    : standings[2]?.playerId ?? null;

  await settlePrizePoolByOrder({
    challengeId: input.challenge.id,
    firstPlayerId: first,
    secondPlayerId: second,
    thirdPlayerId: third ?? null,
  });
  return { autoMessage: "循環賽季後賽已完賽，已自動完成獎池結算。" };
}

function revalidateArena(challengeId?: string) {
  revalidatePath("/arena");
  if (challengeId) {
    revalidatePath(`/arena/${challengeId}`);
  }
  revalidatePath("/hub");
  revalidatePath("/rankings");
  revalidatePath("/gm");
}

function mapRpcError(errorMessage: string) {
  if (errorMessage.includes("HOST_PLAYER_NOT_ALLOWED")) return "主辦玩家不屬於目前登入帳號。";
  if (errorMessage.includes("INSUFFICIENT_BALANCE")) return "星星不足，無法鎖定。";
  if (errorMessage.includes("PRIZE_DISTRIBUTION_NOT_MATCH_POOL")) return "獎勵總和需等於總獎池。";
  if (errorMessage.includes("PRIZE_POOL_ENTRY_FEE_REQUIRED")) return "多人獎池每人參賽費至少 1 顆。";
  if (errorMessage.includes("PRIZE_POOL_PARTICIPANT_LIMIT_TOO_LOW")) return "多人獎池至少 3 人。";
  if (errorMessage.includes("UNSUPPORTED_COMPETITION_FORMAT")) return "這個賽制目前不支援。";
  return "操作失敗，請稍後再試。";
}

export async function createChallengeAction(
  _prevState: ArenaActionState,
  formData: FormData,
): Promise<ArenaActionState> {
  const parsed = createChallengeSchema.safeParse({
    mode: String(formData.get("mode") ?? "single_stake"),
    competitionFormat: String(formData.get("competitionFormat") ?? "single_match"),
    title: String(formData.get("title") ?? ""),
    hostPlayerId: String(formData.get("hostPlayerId") ?? ""),
    duelPlayerId: (() => {
      const raw = String(formData.get("duelPlayerId") ?? "").trim();
      return raw.length > 0 ? raw : undefined;
    })(),
    description: String(formData.get("description") ?? ""),
    city: String(formData.get("city") ?? ""),
    venue: String(formData.get("venue") ?? ""),
    startsAt: String(formData.get("startsAt") ?? ""),
    hostStake: Number(formData.get("hostStake") ?? 0),
    participantLimit: Number(formData.get("participantLimit") ?? 2),
    entryFee: Number(formData.get("entryFee") ?? 0),
    rewardFirst: Number(formData.get("rewardFirst") ?? 0),
    rewardSecond: Number(formData.get("rewardSecond") ?? 0),
    rewardThird: Number(formData.get("rewardThird") ?? 0),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "建立約戰資料格式錯誤。",
      success: null,
    };
  }

  const { mode } = parsed.data;
  if (
    mode === "single_stake" &&
    parsed.data.duelPlayerId &&
    parsed.data.duelPlayerId === parsed.data.hostPlayerId
  ) {
    return {
      error: "指定對手不可與主辦玩家相同。",
      success: null,
    };
  }

  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  let description = normalizeOptionalText(parsed.data.description);
  let duelTargetLabel: string | null = null;
  if (mode === "single_stake" && parsed.data.duelPlayerId) {
    const admin = createSupabaseAdminClient();
    const { data: duelTarget } = await admin
      .from("players")
      .select("display_name, is_active")
      .eq("id", parsed.data.duelPlayerId)
      .maybeSingle();

    if (duelTarget?.is_active) {
      duelTargetLabel = `指定對手：${duelTarget.display_name}`;
      description = description ? `${description}\n${duelTargetLabel}` : duelTargetLabel;
    }
  }

  const rpcPayload = {
    p_mode: mode,
    p_competition_format: mode === "single_stake" ? "single_match" : parsed.data.competitionFormat,
    p_title: parsed.data.title,
    p_host_player_id: parsed.data.hostPlayerId,
    p_description: description,
    p_city: normalizeOptionalText(parsed.data.city),
    p_venue: normalizeOptionalText(parsed.data.venue),
    p_starts_at: normalizeDateTime(parsed.data.startsAt),
    p_host_stake: mode === "single_stake" ? parsed.data.hostStake : 0,
    p_participant_limit: mode === "single_stake" ? 2 : parsed.data.participantLimit,
    p_entry_fee: mode === "single_stake" ? 0 : parsed.data.entryFee,
    p_reward_first: mode === "single_stake" ? 0 : parsed.data.rewardFirst,
    p_reward_second: mode === "single_stake" ? 0 : parsed.data.rewardSecond,
    p_reward_third: mode === "single_stake" ? 0 : parsed.data.rewardThird,
  };

  const { data: challengeId, error } = await client.rpc("create_challenge_with_host", rpcPayload);
  if (error || !challengeId) {
    return {
      error: mapRpcError(error?.message ?? ""),
      success: null,
    };
  }

  revalidateArena(challengeId as string);
  return {
    error: null,
    success: duelTargetLabel
      ? `建立成功，已完成主辦方入場與鎖定（${duelTargetLabel}）。`
      : "建立成功，已完成主辦方入場與鎖定。",
  };
}

export async function joinChallengeAction(
  _prevState: ArenaActionState,
  formData: FormData,
): Promise<ArenaActionState> {
  const parsed = joinChallengeSchema.safeParse({
    challengeId: String(formData.get("challengeId") ?? ""),
    playerId: String(formData.get("playerId") ?? ""),
    stake: Number(formData.get("stake") ?? 0),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "加入資料格式錯誤。",
      success: null,
    };
  }

  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    redirect("/auth");
  }

  const { data, error } = await client.rpc("join_challenge", {
    p_challenge_id: parsed.data.challengeId,
    p_player_id: parsed.data.playerId,
    p_stake: parsed.data.stake,
  });

  if (error || !data) {
    return {
      error: "加入失敗，請確認名額、星星餘額或玩家是否重複參賽。",
      success: null,
    };
  }

  const bundle = await loadChallengeBundle(parsed.data.challengeId);
  let message = "加入成功。";

  if (
    bundle.challenge &&
    bundle.challenge.mode === "prize_pool" &&
    bundle.challenge.status === "in_progress" &&
    bundle.matches.length === 0 &&
    (bundle.challenge.competition_format === "single_elimination" ||
      bundle.challenge.competition_format === "round_robin")
  ) {
    try {
      const rows = await createInitialScheduleRows({
        challenge: bundle.challenge,
        participants: bundle.participants,
      });
      if (rows.length > 0) {
        const admin = createSupabaseAdminClient();
        const { error: scheduleError } = await admin.from("matches").insert(rows);
        if (!scheduleError) {
          message = "加入成功，已自動生成賽程。";
        }
      }
    } catch {
      // 賽程生成失敗不阻擋加入成功
    }
  }

  revalidateArena(parsed.data.challengeId);
  return {
    error: null,
    success: message,
  };
}

export async function cancelChallengeAction(
  _prevState: ArenaActionState,
  formData: FormData,
): Promise<ArenaActionState> {
  const parsed = cancelChallengeSchema.safeParse({
    challengeId: String(formData.get("challengeId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "取消資料格式錯誤。",
      success: null,
    };
  }

  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    redirect("/auth");
  }

  const { data, error } = await client.rpc("cancel_challenge", {
    p_challenge_id: parsed.data.challengeId,
    p_reason: normalizeOptionalText(parsed.data.reason) ?? "主辦方取消約戰",
  });

  if (error || !data) {
    return {
      error: "取消失敗，請確認是否具備主辦/GM 權限。",
      success: null,
    };
  }

  revalidateArena(parsed.data.challengeId);
  return {
    error: null,
    success: "已取消約戰，鎖定星星已退回。",
  };
}

export async function settleSingleChallengeAction(
  _prevState: ArenaActionState,
  formData: FormData,
): Promise<ArenaActionState> {
  const parsed = settleSingleSchema.safeParse({
    challengeId: String(formData.get("challengeId") ?? ""),
    winnerPlayerId: String(formData.get("winnerPlayerId") ?? ""),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "結算資料格式錯誤。",
      success: null,
    };
  }

  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    redirect("/auth");
  }

  const { data, error } = await client.rpc("settle_single_stake_challenge", {
    p_challenge_id: parsed.data.challengeId,
    p_winner_player_id: parsed.data.winnerPlayerId,
  });

  if (error || !data) {
    return {
      error: "單場對賭結算失敗，請確認權限與勝方。",
      success: null,
    };
  }

  revalidateArena(parsed.data.challengeId);
  return {
    error: null,
    success: "單場對賭已結算完成。",
  };
}

export async function settlePrizePoolChallengeAction(
  _prevState: ArenaActionState,
  formData: FormData,
): Promise<ArenaActionState> {
  const parsed = settlePoolSchema.safeParse({
    challengeId: String(formData.get("challengeId") ?? ""),
    firstPlayerId: String(formData.get("firstPlayerId") ?? ""),
    secondPlayerId: String(formData.get("secondPlayerId") ?? ""),
    thirdPlayerId: String(formData.get("thirdPlayerId") ?? ""),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "結算資料格式錯誤。",
      success: null,
    };
  }

  const thirdRaw = (parsed.data.thirdPlayerId ?? "").trim();
  const thirdPlayerId = thirdRaw.length > 0 ? thirdRaw : null;
  if (
    parsed.data.firstPlayerId === parsed.data.secondPlayerId ||
    (thirdPlayerId &&
      (parsed.data.firstPlayerId === thirdPlayerId || parsed.data.secondPlayerId === thirdPlayerId))
  ) {
    return {
      error: "名次玩家不可重複。",
      success: null,
    };
  }

  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    redirect("/auth");
  }

  const { data, error } = await client.rpc("settle_prize_pool_challenge", {
    p_challenge_id: parsed.data.challengeId,
    p_first_player_id: parsed.data.firstPlayerId,
    p_second_player_id: parsed.data.secondPlayerId,
    p_third_player_id: thirdPlayerId,
  });

  if (error || !data) {
    return {
      error: "多人獎池結算失敗，請確認名次玩家與獎池設定。",
      success: null,
    };
  }

  revalidateArena(parsed.data.challengeId);
  return {
    error: null,
    success: "多人獎池已完成結算。",
  };
}

export async function generateChallengeScheduleAction(
  _prevState: ArenaActionState,
  formData: FormData,
): Promise<ArenaActionState> {
  const parsed = generateScheduleSchema.safeParse({
    challengeId: String(formData.get("challengeId") ?? ""),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "賽程資料格式錯誤。",
      success: null,
    };
  }

  const { userId, role } = await getViewerAndRole();
  const bundle = await loadChallengeBundle(parsed.data.challengeId);
  if (!bundle.challenge) {
    return {
      error: "找不到這場約戰。",
      success: null,
    };
  }

  if (!canManageChallenge(bundle.challenge, userId, role)) {
    return {
      error: "你沒有權限建立此賽程。",
      success: null,
    };
  }

  if (bundle.challenge.mode !== "prize_pool") {
    return {
      error: "只有多人獎池可建立賽程。",
      success: null,
    };
  }

  if (bundle.challenge.competition_format === "manual_pool") {
    return {
      error: "手動名次模式不需要賽程，請直接指定名次結算。",
      success: null,
    };
  }

  if (bundle.challenge.competition_format === "double_elimination") {
    return {
      error: "雙敗淘汰自動賽程即將上線，目前先使用手動名次結算。",
      success: null,
    };
  }

  if (bundle.matches.length > 0) {
    return {
      error: "此約戰已建立賽程。",
      success: null,
    };
  }

  try {
    const rows = await createInitialScheduleRows({
      challenge: bundle.challenge,
      participants: bundle.participants,
    });

    if (rows.length === 0) {
      return {
        error: "目前人數不足，尚無法生成賽程。",
        success: null,
      };
    }

    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("matches").insert(rows);
    if (error) {
      return {
        error: "建立賽程失敗，請稍後再試。",
        success: null,
      };
    }

    revalidateArena(parsed.data.challengeId);
    return {
      error: null,
      success: "賽程已建立。",
    };
  } catch (error) {
    return {
      error: mapScheduleErrorMessage(error instanceof Error ? error.message : ""),
      success: null,
    };
  }
}

export async function settleChallengeMatchAction(
  _prevState: ArenaActionState,
  formData: FormData,
): Promise<ArenaActionState> {
  const parsed = settleMatchSchema.safeParse({
    challengeId: String(formData.get("challengeId") ?? ""),
    matchId: String(formData.get("matchId") ?? ""),
    winnerPlayerId: String(formData.get("winnerPlayerId") ?? ""),
    playerAScore: formData.get("playerAScore")
      ? Number(formData.get("playerAScore"))
      : undefined,
    playerBScore: formData.get("playerBScore")
      ? Number(formData.get("playerBScore"))
      : undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "場次資料格式錯誤。",
      success: null,
    };
  }

  const { userId, role } = await getViewerAndRole();
  const bundle = await loadChallengeBundle(parsed.data.challengeId);
  if (!bundle.challenge) {
    return {
      error: "找不到這場約戰。",
      success: null,
    };
  }

  if (!canManageChallenge(bundle.challenge, userId, role)) {
    return {
      error: "你沒有權限更新這場比賽。",
      success: null,
    };
  }

  if (bundle.challenge.mode !== "prize_pool") {
    return {
      error: "此功能僅適用於多人獎池賽程。",
      success: null,
    };
  }

  const targetMatch = bundle.matches.find((match) => match.id === parsed.data.matchId);
  if (!targetMatch) {
    return {
      error: "找不到指定場次。",
      success: null,
    };
  }

  if (targetMatch.status === "completed") {
    return {
      error: "這場比賽已結算。",
      success: null,
    };
  }

  const validWinner =
    parsed.data.winnerPlayerId === targetMatch.player_a_id ||
    parsed.data.winnerPlayerId === targetMatch.player_b_id;
  if (!validWinner) {
    return {
      error: "勝方玩家必須是該場參賽者。",
      success: null,
    };
  }

  const oldMeta = parseArenaMatchMeta(targetMatch.notes);
  const newMeta: ArenaMatchMeta = {
    format: oldMeta?.format ?? bundle.challenge.competition_format,
    round: oldMeta?.round ?? 1,
    matchOrder: oldMeta?.matchOrder ?? 1,
    stage: oldMeta?.stage,
    autoBye: oldMeta?.autoBye,
    player1Score: parsed.data.playerAScore,
    player2Score: parsed.data.playerBScore,
  };

  const admin = createSupabaseAdminClient();
  const { error: updateError } = await admin
    .from("matches")
    .update({
      winner_player_id: parsed.data.winnerPlayerId,
      status: "completed",
      settled_at: new Date().toISOString(),
      notes: stringifyArenaMatchMeta(newMeta),
    })
    .eq("id", parsed.data.matchId)
    .eq("challenge_id", parsed.data.challengeId);

  if (updateError) {
    return {
      error: "更新場次失敗，請稍後再試。",
      success: null,
    };
  }

  const fresh = await loadChallengeBundle(parsed.data.challengeId);
  if (!fresh.challenge) {
    return {
      error: "更新後找不到約戰資料，請重新整理。",
      success: null,
    };
  }

  let autoMessage: string | null = null;
  try {
    if (fresh.challenge.competition_format === "single_elimination") {
      const result = await maybeAdvanceSingleElimination({
        challenge: fresh.challenge,
        participants: fresh.participants,
        matches: fresh.matches,
      });
      autoMessage = result.autoMessage;
    } else if (fresh.challenge.competition_format === "round_robin") {
      const result = await maybeAdvanceRoundRobin({
        challenge: fresh.challenge,
        participants: fresh.participants,
        matches: fresh.matches,
      });
      autoMessage = result.autoMessage;
    }
  } catch {
    revalidateArena(parsed.data.challengeId);
    return {
      error: "場次已記錄，但自動推進賽程失敗，請重新整理後重試。",
      success: null,
    };
  }

  revalidateArena(parsed.data.challengeId);

  const playerNameMap = getPlayerNameMap(fresh.participants);
  const winnerName = playerNameMap.get(parsed.data.winnerPlayerId) ?? "勝方";
  const scoreText =
    parsed.data.playerAScore != null && parsed.data.playerBScore != null
      ? `（${parsed.data.playerAScore} : ${parsed.data.playerBScore}）`
      : "";

  return {
    error: null,
    success: autoMessage
      ? `已登記 ${winnerName} 勝出${scoreText}。${autoMessage}`
      : `已登記 ${winnerName} 勝出${scoreText}。`,
  };
}
