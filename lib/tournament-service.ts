import {
  isGoogleSheetsConfigured,
  loadTournamentsFromSheets,
} from "@/lib/google-sheets";
import { mockTournaments } from "@/lib/mock-data";
import { buildTournamentView, sortTournamentsByStatus } from "@/lib/score-utils";
import type { TournamentSummary, TournamentView } from "@/lib/tournament-types";

async function loadTournamentViews(): Promise<TournamentView[]> {
  const source = isGoogleSheetsConfigured()
    ? await loadTournamentsFromSheets()
    : mockTournaments;

  return sortTournamentsByStatus(source.map(buildTournamentView));
}

export async function getTournamentSummaries(): Promise<TournamentSummary[]> {
  const tournaments = await loadTournamentViews();

  return tournaments.map((tournament) => ({
    id: tournament.id,
    slug: tournament.slug,
    name: tournament.name,
    format: tournament.format,
    status: tournament.status,
    theme: tournament.theme,
    venue: tournament.venue,
    heroKicker: tournament.heroKicker,
    heroSummary: tournament.heroSummary,
    startedAt: tournament.startedAt,
    endedAt: tournament.endedAt,
    winScoreRule: tournament.winScoreRule,
    currentMatchId: tournament.currentMatchId,
    playerCount: tournament.stats.playerCount,
    matchCount: tournament.stats.totalMatches,
    liveMatchCount: tournament.stats.liveMatches,
  }));
}

export async function getTournamentBySlug(slug: string) {
  const tournaments = await loadTournamentViews();
  return tournaments.find((tournament) => tournament.slug === slug) ?? null;
}

export async function getTournamentById(id: string) {
  const tournaments = await loadTournamentViews();
  return tournaments.find((tournament) => tournament.id === id) ?? null;
}

export async function getMatchById(tournamentId: string, matchId: string) {
  const tournament = await getTournamentById(tournamentId);

  if (!tournament) {
    return null;
  }

  return tournament.matches.find((match) => match.id === matchId) ?? null;
}

export function getTournamentSetupState() {
  return {
    dataSource: isGoogleSheetsConfigured() ? "google-sheets" : "mock-data",
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? null,
    adminPasswordConfigured: Boolean(process.env.ADMIN_PASSWORD),
  } as const;
}
