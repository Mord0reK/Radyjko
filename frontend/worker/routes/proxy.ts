import { corsHeaders } from "@/lib/cors";
import { rewriteM3U8Manifest } from "@/lib/proxy/rewriteM3U8";

export const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;

class ManifestTooLargeError extends Error {}

interface StreamStation {
  url: string;
  needsProxy: number | boolean | null;
}

function parseTargetUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

async function readManifest(response: Response): Promise<string> {
  const declaredLength = Number.parseInt(response.headers.get("Content-Length") ?? "", 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MANIFEST_BYTES) {
    throw new ManifestTooLargeError();
  }

  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalLength += value.byteLength;
      if (totalLength > MAX_MANIFEST_BYTES) {
        await reader.cancel("Manifest exceeds the size limit");
        throw new ManifestTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(body);
}

function buildResourceUrl(request: Request, resourceUrl: string): string {
  const url = new URL(request.url);
  url.searchParams.set("resource", resourceUrl);
  return `${url.pathname}${url.search}`;
}

export async function getStream(
  request: Request,
  env: Pick<CloudflareEnv, "DB">,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const shortName = requestUrl.searchParams.get("station")?.trim();
  if (!shortName) {
    return new Response("Missing 'station' query parameter", { status: 400 });
  }

  let station: StreamStation | null;
  try {
    station = await env.DB.prepare(
      "SELECT url, needsProxy FROM stations WHERE shortName = ? LIMIT 1",
    ).bind(shortName).first<StreamStation>();
  } catch (error) {
    console.error("Failed to resolve stream station:", error);
    return new Response(JSON.stringify({ error: "Failed to resolve station" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!station?.needsProxy) {
    return new Response(JSON.stringify({ error: "Station not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stationUrl = parseTargetUrl(station.url);
  if (!stationUrl) {
    return new Response(JSON.stringify({ error: "Station stream URL is invalid" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resourceUrlValue = requestUrl.searchParams.get("resource");
  const targetUrl = resourceUrlValue ? parseTargetUrl(resourceUrlValue) : stationUrl;
  if (!targetUrl || (resourceUrlValue && targetUrl.origin !== stationUrl.origin)) {
    return new Response(JSON.stringify({ error: "Invalid stream resource" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Radyjko/1.0)",
        Accept: "*/*",
      },
    });

    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(corsHeaders)) {
      headers.set(name, value);
    }
    headers.delete("Content-Length");

    const contentType = response.headers.get("Content-Type") ?? "";
    const isManifest =
      contentType.includes("application/vnd.apple.mpegurl") ||
      contentType.includes("application/x-mpegURL") ||
      targetUrl.pathname.toLowerCase().includes(".m3u8");

    if (isManifest) {
      const manifest = await readManifest(response);
      return new Response(rewriteM3U8Manifest(
        manifest,
        targetUrl.toString(),
        (resourceUrl) => buildResourceUrl(request, resourceUrl),
      ), {
        status: response.status,
        headers,
      });
    }

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    if (error instanceof ManifestTooLargeError) {
      return new Response(JSON.stringify({ error: "Manifest exceeds the size limit" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.error("Proxy fetch error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch target URL" }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}
