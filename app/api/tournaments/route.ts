import { NextResponse } from "next/server";

import { getTournamentSummaries } from "@/lib/tournament-service";

export async function GET() {
  const tournaments = await getTournamentSummaries();
  return NextResponse.json({ tournaments });
}
