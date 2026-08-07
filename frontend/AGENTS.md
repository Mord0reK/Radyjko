# AGENTS.md — Frontend

These instructions apply only to `frontend/`.

## Stack and commands

The frontend is a React 19 SPA built with Vite and deployed together with its
API as one Cloudflare Worker. Use Bun exclusively. Before every Bun or Bunx
operation, verify that the actual command is routed through a shell function or
`sfw-shims`. Invoke Bunx explicitly as `sfw bunx ...` when no protected Bunx
function exists.

- `bun run dev` — Vite development server with Cloudflare runtime integration
- `bun run test` — Bun unit tests
- `bun run lint` — ESLint for client, Worker, and service worker code
- `bun run build` — client and Worker typechecks followed by Vite build
- `bun run preview` — production preview in the Workers runtime
- `bun run cf-typegen` — regenerate `src/cloudflare-env.d.ts`

Do not deploy without explicit approval.

## Architecture

`src/main.tsx` mounts the SPA and Browser Router. UI state lives in
`src/contexts/`; shared browser API code lives in `src/lib/api.ts`. Static files
in `public/ikony/` retain their root-relative URLs.

`worker/index.ts` is the only Worker entry point. Keep its router explicit and
framework-free. Route implementations belong in `worker/routes/`. Access D1
and Durable Objects through the generated `CloudflareEnv` bindings; never
hand-write a replacement Env interface. Preserve the `DB` and
`NOWPLAYING_DO` binding names, the `NowPlayingDO` class name, and migration
tag `v1`.

## Conventions

Use strict TypeScript, explicit return types on exported functions, `import
type` for type-only imports, and the `@/*` alias for `src/*`. Keep API response
formats and CORS behavior stable. Stream audio proxy responses; only buffer
M3U8 manifests that require rewriting. Add a failing test before behavioral
changes, then run the focused test, full tests, lint, typechecks, build, and
`git diff --check` as appropriate.
