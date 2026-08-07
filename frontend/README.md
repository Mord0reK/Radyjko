# Radyjko frontend

Aplikacja React 19 + Vite publikowana jako jeden Cloudflare Worker. Vite buduje
SPA, a `worker/index.ts` obsługuje `/api/*`, D1 i Durable Object WebSocket.

## Wymagania

- Bun zabezpieczony przez Socket Firewall (`sfw` lub `sfw-shims`)
- dostęp do bindingów Cloudflare wymagany dopiero dla preview/deploymentu

## Polecenia

```bash
bun install
bun run dev
bun run test
bun run lint
bun run build
bun run preview
bun run cf-typegen
```

`bun run deploy` wykonuje build i deployment. Nie uruchamiaj go bez świadomej
zgody i poprawnej autoryzacji Cloudflare.

Domyślnie klient używa `/api` z bieżącej domeny. Opcjonalne
`VITE_API_BASE_URL` pozwala wskazać pełny bazowy adres HTTP(S); klient wyprowadza
z niego również adres WebSocket `ws:` lub `wss:`.

## Android Auto

Katalog stacji dla Android Auto zawiera komplet danych potrzebnych do
odtwarzania i jest przechowywany w `SharedPreferences`. Przy pustym cache
natywny serwis pobiera go żądaniem `GET /api/stations`.

Build Androida wymaga ustawienia `VITE_API_BASE_URL` w `.env.desktop` (zobacz
`.env.desktop.example`); jest to bazowy adres API bez końcowego `/api`.
Na Androidzie jedynym silnikiem odtwarzania jest natywny ExoPlayer w
`RadyjkoAutoService`; HTML Audio i `tauri-plugin-media-session` nie są używane.
UI, systemowe powiadomienie multimedialne i Android Auto sterują tym samym
odtwarzaczem i MediaSession. Serwis utrzymuje własne powiadomienie foreground,
synchronizuje stan odtwarzania z Reactem i obsługuje głośność.

## Architektura

- `src/main.tsx` — wejście aplikacji i Browser Router;
- `src/components/`, `src/contexts/` — interfejs, player i stan klienta;
- `src/lib/api.ts` — HTTP i WebSocket `/api/nowplaying`;
- `worker/index.ts` — jawny router API;
- `worker/routes/` — D1, Durable Object, proxy i harmonogramy;
- `src/do/NowPlayingDO.ts` — Durable Object czasu rzeczywistego;
- `public/` — manifest, service worker i nieprzetwarzane ikony.

Konfiguracja `wrangler.jsonc` zachowuje binding `DB`, binding
`NOWPLAYING_DO`, migrację `v1` oraz fallback SPA. Wyłącznie `/api/*` uruchamia
kod Workera przed statycznymi assetami.
