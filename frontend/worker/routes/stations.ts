export interface StationsEnv {
  DB?: D1Database;
}

export async function getStations(
  _request: Request,
  env: StationsEnv,
): Promise<Response> {
  if (!env.DB) {
    return corsResponse(JSON.stringify({ error: "Database binding not found" }), 500);
  }

  try {
    const { results } = await env.DB.prepare(
      "SELECT id, name, url, shortName, isOpenFM, openFmId, RmfID, EskaID, Opis, Jakosc, isExplicit, needsProxy FROM stations",
    ).all<Station>();

    return corsResponse(JSON.stringify(results));
  } catch (error) {
    console.error("Failed to fetch stations:", error);
    return corsResponse(JSON.stringify({ error: "Internal server error" }), 500);
  }
}
import { corsResponse } from "@/lib/cors";
import type { Station } from "@/lib/types";
