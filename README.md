
# Radyjko

Odtwarzacz radia internetowego zbudowany w React 19, Vite i Tauri 2.  
Wersja webowa działa jako Cloudflare Worker; wersja desktopowa to natywna aplikacja dla Linuxa i Windowsa.

## Funkcjonalności

- Odtwarzanie stacji radiowych (OpenFM, VoxFM, RMF, Eska, RadioParty)
- Informacje o aktualnie granej piosence (tytuł, wykonawca, okładka, ramówka)
- Ulubione stacje z persystencją w localStorage
- Obsługa strumieni HLS za pomocą hls.js
- Discord Rich Presence (tylko wersja desktopowa)
- Własny proxy strumieni dla stacji z ograniczeniami CORS
- Pobieranie instalatorów z najnowszego publicznego wydania (tylko wersja webowa)

## Stack technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4 |
| Desktop | Tauri 2 (Rust), Discord Rich Presence |
| Backend | Cloudflare Workers (router, baza D1, Durable Objects) |
| Build | Bun, `wrangler` do deployu Workera |

## Struktura projektu

```
Radyjko/
├── frontend/
│   ├── src/                  # SPA React
│   │   ├── components/       # Komponenty UI
│   │   ├── contexts/         # App, Player, Stations, Favorites
│   │   ├── lib/              # Klienci API, audio, fetchery
│   │   └── styles/           # Tailwind CSS
│   ├── worker/               # Backend Cloudflare Worker
│   │   ├── routes/           # API: stations, nowplaying, schedule, proxy
│   │   └── index.ts          # Punkt wejścia Workera + router
│   ├── src-tauri/            # Wrapper desktopowy Tauri 2 (Rust)
│   └── package.json
└── icon.png                  # Źródłowa ikona aplikacji
```

## Szybki start

### Wymagania

- [Bun](https://bun.sh/) (package manager i runtime)
- [Rust](https://rustup.rs/) (do budowania wersji desktopowej)

### Web (tryb deweloperski)

```sh
git clone https://github.com/dziaslo/Radyjko.git
cd Radyjko/frontend
bun install
bun run dev
```

Otwórz `http://localhost:5173` w przeglądarce.

### Pobieranie aplikacji

W zwykłej wersji przeglądarkowej przycisk „Pobierz aplikację” znajduje się pod
logo w desktopowym panelu bocznym oraz w menu mobilnym. Otwiera modal z APK,
instalatorem Windows oraz AppImage i pakietami dla Linuxa bezpośrednio z
najnowszego publicznego wydania
[GitHub Releases](https://github.com/Mord0reK/Radyjko/releases). Po wybraniu pliku
wyświetlana jest instrukcja instalacji, w tym szczegółowe kroki dla APK. Przycisk
nie jest widoczny w aplikacji Tauri.

Informacje o wydaniu są odświeżane najwyżej raz na 15 minut. Dopóki repozytorium
jest prywatne, GitHub zwraca anonimowym użytkownikom błąd 404; pobieranie zacznie
działać po jego upublicznieniu.

### Desktop (tryb deweloperski)

```sh
cd Radyjko/frontend
bun install
bun run desktop:dev
```

Wymaga zależności platformowych Tauri — patrz [wymagania wstępne Tauri](https://v2.tauri.app/start/prerequisites/).

### Budowanie

| Cel | Polecenie | Wynik |
|-----|-----------|-------|
| Web (Cloudflare Worker) | `bun run build && wrangler deploy` | Deploy na `radyjko.mordorek.dev` |
| Desktop (lokalne) | `bun run desktop:build` | `src-tauri/target/release/bundle/` |
| Web preview (lokalne) | `bun run build && bun run preview` | Podgląd lokalny Workers |

### Polecenia

| Polecenie | Opis |
|-----------|------|
| `bun run dev` | Serwer deweloperski Vite (web) |
| `bun run build` | Typcheck + build Vite (web) |
| `bun run build:desktop` | Typcheck + build Vite (tryb desktop) |
| `bun run test` | Testy jednostkowe Bun |
| `bun run lint` | ESLint |
| `bun run desktop:dev` | Serwer deweloperski Tauri |
| `bun run desktop:build` | Build release Tauri |

## CI/CD

Workflow GitHub Actions (`release-linux.yml`) buduje paczki release po tagu:

- **Linux** (Ubuntu 24.04): `.deb`, `.rpm`, `.AppImage` (z dołączonym GStreamer)
- **Arch Linux** (Docker): `.pkg.tar.zst` przez `makepkg`
- **Windows** (Windows runner): instalator NSIS `.exe`

Wszystkie artefakty publikowane są jako GitHub Release.

### Wydanie Androida

Workflow [Release Radyjko](.github/workflows/release-linux.yml) uruchamia się ręcznie z GitHub Actions. Job `build-android` używa inputu `version` w formacie SemVer bez prefiksu `v` (np. `1.2.3`). Ustawia on Androidowe `versionName` na tę wartość, a `versionCode` wylicza jako `MAJOR * 1_000_000 + MINOR * 1_000 + PATCH`. Budowane i przesyłane jako artefakt workflow są podpisane pliki APK i AAB.

Przed pierwszym uruchomieniem dodaj w ustawieniach repozytorium GitHub Secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` i `ANDROID_KEY_PASSWORD`.

Jeśli nie masz jeszcze keystore'a, wygeneruj go lokalnie (hasła podawaj tylko w interaktywnych promptach):

```sh
keytool -genkeypair -v -keystore radyjko-release.jks -storetype JKS -alias radyjko -keyalg RSA -keysize 4096 -validity 10000
```

Przechowaj plik `.jks` i hasła bezpiecznie. Wartość dla sekretu `ANDROID_KEYSTORE_BASE64` utworzysz w Linuxie poleceniem:

```sh
base64 -w 0 radyjko-release.jks
```

## Uwagi do wersji desktopowej

- **Linux AppImage**: GStreamer i frameworki multimedialne są dołączone. Wymaga X11 lub Wayland.
- **Paczka Arch**: Zależności runtime to `webkit2gtk-4.1`, `gst-plugins-base`, `gst-plugins-good`, `gst-libav`.
- **Windows**: Zbudowany jako aplikacja GUI (bez okna konsoli).
- **Proxy strumieni**: Stacje oznaczone `needsProxy` streamują przez `https://radyjko.mordorek.dev/api/stream?station=<id>`. Pozostałe stacje odtwarzają bezpośrednio z źródeł.

## Autorzy

- [Mord0reK](https://github.com/Mord0reK)
- [Jan Dziąsło](https://github.com/JanDziaslo)

## Licencja

MIT
