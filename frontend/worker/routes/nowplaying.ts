import { corsHeaders, corsResponse } from "@/lib/cors";

export async function getNowPlaying(
  request: Request,
  env: Pick<CloudflareEnv, "NOWPLAYING_DO">,
): Promise<Response> {
  if (!env.NOWPLAYING_DO) {
    return corsResponse(JSON.stringify({ error: "Durable Object binding not found" }), 500);
  }

  try {
    const id = env.NOWPLAYING_DO.idFromName("singleton");
    const stub = env.NOWPLAYING_DO.get(id);
    const response = await stub.fetch(request);

    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      return response;
    }

    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(corsHeaders)) {
      headers.set(name, value);
    }
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    console.error("Failed to fetch now playing:", error);
    return corsResponse(JSON.stringify({ error: "Internal server error" }), 500);
  }
}
