import {
  isGoogleSheetsConfigured,
  loadTournamentsFromSheets,
} from "@/lib/google-sheets";
import { mockTournaments } from "@/lib/mock-data";
import { buildTournamentView, sortTournamentsByStatus } from "@/lib/score-utils";
import type { TournamentSummary, TournamentView } from "@/lib/tournament-types";

type TournamentViewCache = {
  expiresAt: number;
  data: TournamentView[] | null;
  pending: Promise<TournamentView[]> | null;
};

const CACHE_TTL_MS = 1500;
const cache: TournamentViewCache = {
  expiresAt: 0,
  data: null,
  pending: null,
};

export function invalidateTournamentServiceCache() {
  cache.expiresAt = 0;
  cache.data = null;
  cache.pending = null;
}

async function loadTournamentViews(): Promise<TournamentView[]> {
  const now = Date.now();

  if (cache.data && now < cache.expiresAt) {
    return cache.data;
  }

  if (cache.pending) {
    return cache.pending;
  }

  cache.pending = (async () => {
    try {
      const source = isGoogleSheetsConfigured()
        ? await loadTournamentsFromSheets()
        : mockTournaments;
      const views = sortTournamentsByStatus(source.map(buildTournamentView));
      cache.data = views;
      cache.expiresAt = Date.now() + CACHE_TTL_MS;
      return views;
    } catch (error) {
      if (cache.data) {
        cache.expiresAt = Date.now() + CACHE_TTL_MS;
        return cache.data;
      }

      throw error;
    }
  })();

  try {
    return await cache.pending;
  } finally {
    cache.pending = null;
  }
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
    scoringMode: tournament.scoringMode,
    targetScore: tournament.targetScore,
    setCount: tournament.setCount,
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
