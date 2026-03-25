import { NextResponse } from "next/server";

import { getTournamentBySlug } from "@/lib/tournament-service";

type TournamentRouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(
  _request: Request,
  context: TournamentRouteContext,
) {
  const { slug } = await context.params;
  const tournament = await getTournamentBySlug(slug);

  if (!tournament) {
    return NextResponse.json(
      { error: "Tournament not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ tournament });
}
