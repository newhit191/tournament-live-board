import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  ArenaChallenge,
  ArenaMatch,
  ArenaParticipant,
  ArenaPlayer,
  LeaderboardEntry,
} from "@/lib/arena-types";

type WalletRelation =
  | {
      balance: number;
      locked_balance: number;
    }
  | {
      balance: number;
      locked_balance: number;
    }[]
  | null;

type PlayerRow = {
  id: string;
  owner_account_id: string;
  family_id: string;
  display_name: string;
  is_child: boolean;
  is_active: boolean;
  player_wallets: WalletRelation;
};

function pickWallet(wallet: WalletRelation) {
  if (!wallet) return null;
  return Array.isArray(wallet) ? wallet[0] ?? null : wallet;
}

function mapPlayer(row: PlayerRow): ArenaPlayer {
  const wallet = pickWallet(row.player_wallets);
  return {
    id: row.id,
    ownerAccountId: row.owner_account_id,
    familyId: row.family_id,
    displayName: row.display_name,
    isChild: row.is_child,
    isActive: row.is_active,
    balance: wallet?.balance ?? 0,
    lockedBalance: wallet?.locked_balance ?? 0,
  };
}

export async function loadPlayersByOwner(ownerAccountId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("players")
    .select("id, owner_account_id, family_id, display_name, is_child, is_active, player_wallets(balance, locked_balance)")
    .eq("owner_account_id", ownerAccountId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`讀取玩家清單失敗：${error.message}`);
  }

  return ((data as PlayerRow[] | null) ?? []).map(mapPlayer);
}

export async function loadArenaPlayerById(playerId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("players")
    .select(
      "id, owner_account_id, family_id, display_name, is_child, is_active, player_wallets(balance, locked_balance)",
    )
    .eq("id", playerId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`讀取玩家資料失敗：${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapPlayer(data as PlayerRow);
}

export async function loadAccountRole(accountId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("accounts")
    .select("role")
    .eq("id", accountId)
    .maybeSingle();

  if (error) {
    throw new Error(`讀取帳號權限失敗：${error.message}`);
  }

  return (data?.role as "user" | "gm" | "admin" | null) ?? "user";
}

export async function loadArenaChallenges(limit = 80): Promise<ArenaChallenge[]> {
  const admin = createSupabaseAdminClient();

  const { data: challengesRaw, error: challengeError } = await admin
    .from("challenges")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (challengeError) {
    throw new Error(`讀取約戰清單失敗：${challengeError.message}`);
  }

  const challenges = (challengesRaw ?? []) as {
    id: string;
    mode: "single_stake" | "prize_pool";
    competition_format:
      | "single_match"
      | "manual_pool"
      | "single_elimination"
      | "double_elimination"
      | "round_robin"
      | null;
    title: string;
    description: string | null;
    city: string | null;
    venue: string | null;
    starts_at: string | null;
    status: "open" | "in_progress" | "completed" | "cancelled";
    created_by_account_id: string;
    host_player_id: string;
    participant_limit: number;
    entry_fee: number;
    reward_first: number;
    reward_second: number;
    reward_third: number;
    is_practice: boolean;
    counts_for_ranking: boolean;
    cross_family: boolean;
    completed_at: string | null;
    created_at: string;
  }[];

  if (challenges.length === 0) {
    return [];
  }

  const challengeIds = challenges.map((item) => item.id);
  const { data: participantsRaw, error: participantError } = await admin
    .from("challenge_participants")
    .select("id, challenge_id, player_id, joined_by_account_id, is_host, stake_offer, locked_amount, final_rank, result, created_at")
    .in("challenge_id", challengeIds)
    .order("created_at", { ascending: true });

  if (participantError) {
    throw new Error(`讀取約戰參戰者失敗：${participantError.message}`);
  }

  const { data: matchesRaw, error: matchError } = await admin
    .from("matches")
    .select("id, challenge_id, player_a_id, player_b_id, winner_player_id, status, notes, settled_at, created_at")
    .in("challenge_id", challengeIds)
    .order("created_at", { ascending: true });

  if (matchError) {
    throw new Error(`讀取約戰比賽失敗：${matchError.message}`);
  }

  const participantRows = (participantsRaw ?? []) as {
    id: string;
    challenge_id: string;
    player_id: string;
    joined_by_account_id: string;
    is_host: boolean;
    stake_offer: number;
    locked_amount: number;
    final_rank: number | null;
    result: ArenaParticipant["result"];
    created_at: string;
  }[];

  const playerIds = Array.from(
    new Set([
      ...participantRows.map((item) => item.player_id),
      ...challenges.map((item) => item.host_player_id),
    ]),
  );

  const playersMap = new Map<string, ArenaPlayer>();
  if (playerIds.length > 0) {
    const { data: playersRaw, error: playerError } = await admin
      .from("players")
      .select("id, owner_account_id, family_id, display_name, is_child, is_active, player_wallets(balance, locked_balance)")
      .in("id", playerIds);

    if (playerError) {
      throw new Error(`讀取玩家資料失敗：${playerError.message}`);
    }

    ((playersRaw as PlayerRow[] | null) ?? []).forEach((row) => {
      playersMap.set(row.id, mapPlayer(row));
    });
  }

  const participantMap = new Map<string, ArenaParticipant[]>();
  participantRows.forEach((row) => {
    const list = participantMap.get(row.challenge_id) ?? [];
    const normalizedFinalRank =
      row.result === "rank_other" && typeof row.final_rank === "number" && row.final_rank >= 900
        ? null
        : row.final_rank;

    list.push({
      id: row.id,
      challengeId: row.challenge_id,
      playerId: row.player_id,
      joinedByAccountId: row.joined_by_account_id,
      isHost: row.is_host,
      stakeOffer: row.stake_offer,
      lockedAmount: row.locked_amount,
      finalRank: normalizedFinalRank,
      result: row.result,
      createdAt: row.created_at,
      player: playersMap.get(row.player_id) ?? null,
    });
    participantMap.set(row.challenge_id, list);
  });

  const matchMap = new Map<string, ArenaMatch[]>();
  ((matchesRaw ?? []) as {
    id: string;
    challenge_id: string;
    player_a_id: string;
    player_b_id: string;
    winner_player_id: string | null;
    status: "pending" | "completed" | "cancelled";
    notes: string | null;
    settled_at: string | null;
    created_at: string;
  }[]).forEach((row) => {
    const list = matchMap.get(row.challenge_id) ?? [];
    list.push({
      id: row.id,
      challengeId: row.challenge_id,
      playerAId: row.player_a_id,
      playerBId: row.player_b_id,
      winnerPlayerId: row.winner_player_id,
      status: row.status,
      notes: row.notes,
      settledAt: row.settled_at,
      createdAt: row.created_at,
    });
    matchMap.set(row.challenge_id, list);
  });

  return challenges.map((row) => ({
    id: row.id,
    mode: row.mode,
    competitionFormat:
      row.competition_format ??
      (row.mode === "single_stake" ? "single_match" : "manual_pool"),
    title: row.title,
    description: row.description,
    city: row.city,
    venue: row.venue,
    startsAt: row.starts_at,
    status: row.status,
    createdByAccountId: row.created_by_account_id,
    hostPlayerId: row.host_player_id,
    participantLimit: row.participant_limit,
    entryFee: row.entry_fee,
    rewardFirst: row.reward_first,
    rewardSecond: row.reward_second,
    rewardThird: row.reward_third,
    isPractice: row.is_practice,
    countsForRanking: row.counts_for_ranking,
    crossFamily: row.cross_family,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    participants: participantMap.get(row.id) ?? [],
    matches: matchMap.get(row.id) ?? [],
  }));
}

export async function loadArenaChallengeDetail(challengeId: string) {
  const challenges = await loadArenaChallenges(500);
  return challenges.find((item) => item.id === challengeId) ?? null;
}

type PlayerTitleRow = {
  player_id: string;
  is_equipped: boolean;
  title_definition_id: string;
};

type TitleDefinitionRow = {
  id: string;
  name: string;
  code: string;
  rule_kind: "manual" | "max_balance" | "max_wins" | "max_cross_family_wins";
  is_active: boolean;
};

function calculateLeaderboardStats(
  players: ArenaPlayer[],
  challenges: ArenaChallenge[],
  scope: "overall" | "cross_family",
) {
  const statsMap = new Map<
    string,
    {
      wins: number;
      losses: number;
      totalMatches: number;
      crossFamilyWins: number;
    }
  >();

  players.forEach((player) => {
    statsMap.set(player.id, {
      wins: 0,
      losses: 0,
      totalMatches: 0,
      crossFamilyWins: 0,
    });
  });

  challenges.forEach((challenge) => {
    if (challenge.status !== "completed" || !challenge.countsForRanking || challenge.isPractice) {
      return;
    }
    if (scope === "cross_family" && !challenge.crossFamily) {
      return;
    }

    challenge.participants.forEach((participant) => {
      const target = statsMap.get(participant.playerId);
      if (!target) {
        return;
      }

      if (participant.result === "pending" || participant.result === "cancelled") {
        return;
      }

      target.totalMatches += 1;

      const isWin = participant.result === "winner" || participant.result === "rank_1";
      if (isWin) {
        target.wins += 1;
        if (challenge.crossFamily) {
          target.crossFamilyWins += 1;
        }
      } else {
        target.losses += 1;
      }
    });
  });

  return statsMap;
}

async function syncDynamicTitles(
  players: ArenaPlayer[],
  overallStats: Map<string, { wins: number; losses: number; totalMatches: number; crossFamilyWins: number }>,
  crossStats: Map<string, { wins: number; losses: number; totalMatches: number; crossFamilyWins: number }>,
  titleDefinitions: TitleDefinitionRow[],
) {
  const admin = createSupabaseAdminClient();

  const getTopPlayer = (
    score: (player: ArenaPlayer) => number,
    tieBreaker?: (player: ArenaPlayer) => number,
  ) => {
    const sorted = [...players].sort((a, b) => {
      const primary = score(b) - score(a);
      if (primary !== 0) return primary;
      const secondary = (tieBreaker?.(b) ?? 0) - (tieBreaker?.(a) ?? 0);
      if (secondary !== 0) return secondary;
      return a.displayName.localeCompare(b.displayName, "zh-Hant");
    });
    return sorted[0] ?? null;
  };

  const unlockRows: { player_id: string; title_definition_id: string }[] = [];

  const rookie = titleDefinitions.find((item) => item.code === "rookie");
  if (rookie) {
    players.forEach((player) => {
      unlockRows.push({
        player_id: player.id,
        title_definition_id: rookie.id,
      });
    });
  }

  const starKing = titleDefinitions.find((item) => item.code === "star_king");
  if (starKing) {
    const top = getTopPlayer((player) => player.balance, (player) => overallStats.get(player.id)?.wins ?? 0);
    if (top) {
      unlockRows.push({
        player_id: top.id,
        title_definition_id: starKing.id,
      });
    }
  }

  const winLord = titleDefinitions.find((item) => item.code === "win_lord");
  if (winLord) {
    const top = getTopPlayer(
      (player) => overallStats.get(player.id)?.wins ?? 0,
      (player) => player.balance,
    );
    if (top) {
      unlockRows.push({
        player_id: top.id,
        title_definition_id: winLord.id,
      });
    }
  }

  const crossAce = titleDefinitions.find((item) => item.code === "cross_family_ace");
  if (crossAce) {
    const top = getTopPlayer(
      (player) => crossStats.get(player.id)?.crossFamilyWins ?? 0,
      (player) => crossStats.get(player.id)?.wins ?? 0,
    );
    if (top && (crossStats.get(top.id)?.crossFamilyWins ?? 0) > 0) {
      unlockRows.push({
        player_id: top.id,
        title_definition_id: crossAce.id,
      });
    }
  }

  if (unlockRows.length > 0) {
    await admin.from("player_titles").upsert(unlockRows, {
      onConflict: "player_id,title_definition_id",
      ignoreDuplicates: true,
    });
  }
}

export async function loadLeaderboard(scope: "overall" | "cross_family") {
  const admin = createSupabaseAdminClient();

  const { data: playersRaw, error: playersError } = await admin
    .from("players")
    .select("id, owner_account_id, family_id, display_name, is_child, is_active, player_wallets(balance, locked_balance)")
    .eq("is_active", true);

  if (playersError) {
    throw new Error(`讀取排行榜玩家失敗：${playersError.message}`);
  }

  const players = ((playersRaw as PlayerRow[] | null) ?? []).map(mapPlayer);
  if (players.length === 0) {
    return [] satisfies LeaderboardEntry[];
  }

  const completedChallenges = (await loadArenaChallenges(500)).filter(
    (item) => item.status === "completed",
  );

  const overallStats = calculateLeaderboardStats(players, completedChallenges, "overall");
  const crossStats = calculateLeaderboardStats(players, completedChallenges, "cross_family");

  const { data: titleDefsRaw, error: titleDefError } = await admin
    .from("title_definitions")
    .select("id, name, code, rule_kind, is_active")
    .eq("is_active", true);

  if (titleDefError) {
    throw new Error(`讀取稱號定義失敗：${titleDefError.message}`);
  }

  const titleDefinitions = ((titleDefsRaw ?? []) as TitleDefinitionRow[]).filter(
    (item) => item.is_active,
  );

  await syncDynamicTitles(players, overallStats, crossStats, titleDefinitions);

  const playerIds = players.map((item) => item.id);
  const { data: playerTitlesRaw, error: playerTitlesError } = await admin
    .from("player_titles")
    .select("player_id, title_definition_id, is_equipped")
    .in("player_id", playerIds);

  if (playerTitlesError) {
    throw new Error(`讀取玩家稱號失敗：${playerTitlesError.message}`);
  }

  const playerTitles = (playerTitlesRaw ?? []) as PlayerTitleRow[];
  const titleNameById = new Map(titleDefinitions.map((item) => [item.id, item.name]));

  const equippedMap = new Map<string, string | null>();
  const unlockedMap = new Map<string, string[]>();

  playerTitles.forEach((row) => {
    const titleName = titleNameById.get(row.title_definition_id);
    if (!titleName) {
      return;
    }
    const unlocked = unlockedMap.get(row.player_id) ?? [];
    unlocked.push(titleName);
    unlockedMap.set(row.player_id, unlocked);
    if (row.is_equipped) {
      equippedMap.set(row.player_id, titleName);
    }
  });

  const stats = scope === "cross_family" ? crossStats : overallStats;

  const rows: LeaderboardEntry[] = players.map((player) => {
    const detail = stats.get(player.id) ?? {
      wins: 0,
      losses: 0,
      totalMatches: 0,
      crossFamilyWins: 0,
    };
    const points = detail.wins * 3 + detail.crossFamilyWins * 2 + player.balance;
    return {
      player,
      wins: detail.wins,
      losses: detail.losses,
      totalMatches: detail.totalMatches,
      crossFamilyWins: detail.crossFamilyWins,
      points,
      rank: 0,
      equippedTitle: equippedMap.get(player.id) ?? null,
      unlockedTitles: unlockedMap.get(player.id) ?? [],
    };
  });

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.crossFamilyWins !== a.crossFamilyWins) return b.crossFamilyWins - a.crossFamilyWins;
    if (b.player.balance !== a.player.balance) return b.player.balance - a.player.balance;
    return a.player.displayName.localeCompare(b.player.displayName, "zh-Hant");
  });

  rows.forEach((row, index) => {
    row.rank = index + 1;
  });

  return rows;
}
