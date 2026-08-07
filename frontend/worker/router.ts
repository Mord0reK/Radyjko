export type ApiHandler<Env> = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
) => Response | Promise<Response>;

export type ApiRoutes<Env> = Record<
  string,
  Partial<Record<"GET" | "OPTIONS", ApiHandler<Env>>>
>;

export async function routeApiRequest<Env>(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  routes: ApiRoutes<Env>,
): Promise<Response> {
  const route = routes[new URL(request.url).pathname];
  if (!route) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const method = request.method as keyof typeof route;
  const handler = route[method];
  if (!handler) {
    return Response.json(
      { error: "Method not allowed" },
      {
        status: 405,
        headers: { Allow: Object.keys(route).join(", ") },
      },
    );
  }

  return handler(request, env, ctx);
}
