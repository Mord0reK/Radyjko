export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, X-Api-Token, Authorization",
  "Access-Control-Max-Age": "600",
};

export function corsResponse(
  body: string | null,
  status = 200,
  extraHeaders: Record<string, string> = {}
) {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

export function handleOptions() {
  return new Response(null, { headers: corsHeaders });
}
