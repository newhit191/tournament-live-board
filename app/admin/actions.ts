"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  clearAdminSession,
  createAdminSession,
  requireAdminSession,
  verifyAdminPassword,
} from "@/lib/auth";
import {
  addMatchSet,
  adjustSetScore,
  createTournamentWithSchedule,
  overrideMatchTotal,
  setCurrentMatch,
  setSetScore,
} from "@/lib/tournament-admin";
import { invalidateTournamentServiceCache } from "@/lib/tournament-service";

export type LoginState = {
  error: string | null;
};

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");

  if (!verifyAdminPassword(password)) {
    return { error: "後台密碼不正確，請重新輸入。" };
  }

  await createAdminSession();
  redirect("/admin/tournaments");
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/admin/login");
}

export async function createTournamentAction(formData: FormData) {
  await requireAdminSession();

  const playerNames = formData
    .getAll("playerNames")
    .map((value) => String(value).trim())
    .filter(Boolean);

  const scoringMode =
    formData.get("scoringMode") === "set_total" ? "set_total" : "target_score";

  const result = await createTournamentWithSchedule({
    name: String(formData.get("name") ?? ""),
    format:
      formData.get("format") === "round_robin"
        ? "round_robin"
        : formData.get("format") === "double_elimination"
          ? "double_elimination"
          : "single_elimination",
    venue: String(formData.get("venue") ?? ""),
    scoringMode,
    targetScore:
      scoringMode === "target_score"
        ? Number(formData.get("targetScore") ?? 0)
        : null,
    setCount:
      scoringMode === "set_total" ? Number(formData.get("setCount") ?? 0) : null,
    playerNames,
    randomize: formData.get("randomize") === "on",
    status: formData.get("status") === "draft" ? "draft" : "live",
  });

  invalidateTournamentServiceCache();
  revalidatePath("/");
  revalidatePath("/tournaments");
  revalidatePath("/admin/tournaments");
  redirect(`/admin/tournaments/${result.tournamentId}`);
}

export async function setCurrentMatchAction(formData: FormData) {
  await requireAdminSession();

  const tournamentId = String(formData.get("tournamentId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  const redirectToRaw = String(formData.get("redirectTo") ?? "").trim();
  const redirectTo =
    redirectToRaw.startsWith("/")
      ? redirectToRaw
      : `/admin/tournaments/${tournamentId}`;

  await setCurrentMatch(tournamentId, matchId);

  invalidateTournamentServiceCache();
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/admin/tournaments/${tournamentId}/matches/${matchId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}/display`);
  revalidatePath("/tournaments");
  redirect(redirectTo);
}

export async function adjustSetScoreAction(formData: FormData) {
  await requireAdminSession();

  const tournamentId = String(formData.get("tournamentId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");

  await adjustSetScore({
    tournamentId,
    matchId,
    setId: String(formData.get("setId") ?? ""),
    side: formData.get("side") === "player2" ? "player2" : "player1",
    delta: Number(formData.get("delta") ?? 0),
  });

  invalidateTournamentServiceCache();
  revalidatePath(`/admin/tournaments/${tournamentId}/matches/${matchId}`);
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/tournaments");
  redirect(`/admin/tournaments/${tournamentId}/matches/${matchId}`);
}

export async function setSetScoreAction(formData: FormData) {
  await requireAdminSession();

  const tournamentId = String(formData.get("tournamentId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");

  await setSetScore({
    tournamentId,
    matchId,
    setId: String(formData.get("setId") ?? ""),
    player1Score: Number(formData.get("player1Score") ?? 0),
    player2Score: Number(formData.get("player2Score") ?? 0),
  });

  invalidateTournamentServiceCache();
  revalidatePath(`/admin/tournaments/${tournamentId}/matches/${matchId}`);
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/tournaments");
  redirect(`/admin/tournaments/${tournamentId}/matches/${matchId}`);
}

export async function addMatchSetAction(formData: FormData) {
  await requireAdminSession();

  const tournamentId = String(formData.get("tournamentId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");

  await addMatchSet({
    tournamentId,
    matchId,
  });

  invalidateTournamentServiceCache();
  revalidatePath(`/admin/tournaments/${tournamentId}/matches/${matchId}`);
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/tournaments");
  redirect(`/admin/tournaments/${tournamentId}/matches/${matchId}`);
}

export async function overrideMatchTotalAction(formData: FormData) {
  await requireAdminSession();

  const tournamentId = String(formData.get("tournamentId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");

  await overrideMatchTotal({
    tournamentId,
    matchId,
    player1Total: Number(formData.get("player1Total") ?? 0),
    player2Total: Number(formData.get("player2Total") ?? 0),
  });

  invalidateTournamentServiceCache();
  revalidatePath(`/admin/tournaments/${tournamentId}/matches/${matchId}`);
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/tournaments");
  redirect(`/admin/tournaments/${tournamentId}/matches/${matchId}`);
}
