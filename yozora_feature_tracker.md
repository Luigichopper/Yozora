# Yozora — Feature Tracker & Implementation Status

> Cross-referencing the [spec](file:///c:/Users/Luigi/Documents/Yozora/anime-client-spec.md) and [audit](file:///c:/Users/Luigi/Documents/Yozora/yozora-code-audit.md) against every file in `src/`, `src-tauri/`, and `aur/`.

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Working / real implementation |
| ⚡ | Real native subprocess integration (`rqbit` / `mpv` via Tauri daemon) |
| 🚧 | Partially implemented — ongoing refinement |
| ❌ | Future native milestone |

---

## 1. Data & Persistence Layer

| File | What It Does | Status | Notes |
|---|---|---|---|
| [`db.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/db.ts) | Real IndexedDB database with 6 stores: `anime_cache`, `library_store`, `danmaku_store`, `downloads_store`, `sources_cache`, `settings_store` | ✅ | Full schema with TTL caching and user library tracking |
| [`rqbitService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/rqbitService.ts) | Bridges Tauri IPC and REST API driving `rqbit server start` background subprocess for sequential piece prioritization | ⚡ | Exposes `POST /torrents` and Range-aware `GET /torrents/{id}/stream/{idx}` directly to player and mpv |
| [`streamService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/streamService.ts) | Anime stream resolver with native HLS (`.m3u8`) streaming support using `hls.js` | ✅ | Direct anime streams with multi-mirror failover |
| [`anidbService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/anidbService.ts) | Multi-tier metadata client querying public **AniList GraphQL** with canonical **AniDB ID** space mapping and 7-day TTL cache | ✅ | Live GraphQL queries for trending, seasonal schedules, and search |
| [`sourceService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/sourceService.ts) | Live RSS XML parser (Nyaa, Mikan, Anime Garden, Tokyo Toshokan, SubsPlease), magnet URI parser, and health ranking | ✅ | Real XML DOM parsing with CORS proxy failover |
| [`danmakuService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/danmakuService.ts) | Episode-keyed danmaku IndexedDB store, exact `currentTime` timestamp binding, and keyword filter | ✅ | User comments bind to exact playhead second and persist |
| [`matugenService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/matugenService.ts) | Saturation-weighted pixel cluster sampling from wallpapers + live `colors.json` CSS token parser | ✅ | Extracts vibrant primary and Material 3 container tokens |

---

## 2. Feature-by-Feature Status

### 2.1 Content Sourcing & rqbit BitTorrent Streaming (Spec §8, §9, §15)

| Feature | Status | Notes |
|---|---|---|
| RSS provider registry (toggle/add/persist) | ✅ | `sourceService` persists to `settings_store`; fully wired in SettingsView |
| Live RSS feed fetching & XML DOM parsing | ✅ | `fetchLiveRssXml()` and `parseRssXmlToSources()` for real RSS releases |
| Magnet URI parsing (info-hash, name, trackers) | ✅ | `sourceService.parseMagnet()` correctly extracts all fields |
| Tauri rqbit process manager | ⚡ | Spawns `rqbit server start <dir> --http-api-listen-addr 127.0.0.1:3030` as background subprocess |
| Sequential piece prioritization & streaming | ⚡ | Handled natively by `rqbit` serving Range-aware `http://127.0.0.1:3030/torrents/{id}/stream/0` |
| Direct Stream handoff | ⚡ | Direct Stream button passes sequential stream URL directly to player / external mpv |
| Source health ranking algorithm | ✅ | `rankSources()`: seeders × 1.5 + resolution/codec/group bonuses |
| Download task manager (pause/resume/delete) | ✅ | Managed task list in CacheManagerView |

---

### 2.2 Anime Metadata Integration (Spec §7)

| Feature | Status | Notes |
|---|---|---|
| Live GraphQL API metadata client | ✅ | High-performance queries against AniList GraphQL with AniDB ID mapping |
| Local IndexedDB metadata cache | ✅ | `anime_cache` store with `cachedAt` index and fast local query |
| Cache TTL eviction (7 days) | ✅ | TTL validation against `cachedAt` with automatic refresh |
| Flood-control / rate-limit backoff | ✅ | 1200ms minimum interval in `rateLimitDelay()` |
| Fuzzy title matching (torrent → AniDB entry) | ✅ | `fuzzyTitleMatch()` in `anidbService.ts` |
| Multi-criteria search & filters | ✅ | Live search across title, romaji, kanji, type, status, season, year, and genre |
| Pagination for browse results | ✅ | Continuous pagination with load more |
| Episode OP/ED skip timestamps | ✅ | Per-episode `opSkipStart` and `opSkipEnd` skip markers |
| Local library export/import | ✅ | Export/import JSON sync format |

---

### 2.3 Playback & Telemetry (Spec §9)

| Feature | Status | Notes |
|---|---|---|
| HTML5 / HLS video player core | ✅ | Plays direct MP4/WebM streams, live HLS (`.m3u8`), and rqbit HTTP stream endpoints |
| Local file playback (.mp4, .mkv, .webm) | ✅ | Blob URL from local file picker |
| Custom stream URL | ✅ | Custom stream URL input dialog |
| Seekbar, play/pause, ±10s skip, volume, fullscreen | ✅ | Wired to `videoRef` with keybinds |
| Playback speed control (0.75x–2.0x) | ✅ | Wired to `videoRef.playbackRate` |
| Accurate OP/ED skip | ✅ | Uses `episode.opSkipEnd` timestamp |
| Auto intro/outro skip | ✅ | Configurable toggle automatically skips OP on air |
| OSD stats panel (Stats for Nerds) | ✅ | Real video dimensions, measured dropped frames via `getVideoPlaybackQuality()`, and buffer window |
| Scrubbing preview tooltip | ✅ | Seekbar hover preview tooltip with live timestamp calculation |

---

### 2.4 Danmaku Engine (Spec §9)

| Feature | Status | Notes |
|---|---|---|
| Canvas danmaku renderer | ✅ | High-fps Canvas loop with rolling, top, and bottom bullet comments |
| Exact playhead timestamp binding | ✅ | User comments submitted during playback bind to the **exact `currentTime`** and persist in `db.ts` |
| Danmaku toggle & configuration | ✅ | Dynamic opacity slider, font size, and speed multipliers |
| Content filtering & moderation | ✅ | Moderation filter in `danmakuService.ts` |

---

### 2.5 Library & Watch Tracking (Spec §11)

| Feature | Status | Notes |
|---|---|---|
| Local library state (CRUD) | ✅ | Fully persisted in IndexedDB `library_store` |
| Watch status tabs | ✅ | Watching, Plan to Watch, Completed, On Hold, Dropped |
| Episode progress tracker | ✅ | EP +1 increment and auto-advancement on playback |
| Personal rating / score editor | ✅ | Interactive 10-point rating editor with half-point precision |
| Watch analytics & metrics | ✅ | Real-time calculation of hours watched, completion count, and mean score |
| AniDB sync import / export | ✅ | Complete import & export pipeline |

---

### 2.6 Theming — Matugen / Material You (Spec §10)

| Feature | Status | Notes |
|---|---|---|
| Preset Material 3 palettes | ✅ | End4-pC Twilight Sakura, Catppuccin Mocha, Tokyo Night, AniDB Amber, Rosé Pine, Emerald, Cyberpunk |
| Saturation-weighted wallpaper extraction | ✅ | Pixel cluster sampler extracts prominent colors into dynamic Material 3 tokens |
| Live Matugen `colors.json` parser | ✅ | Import and parse real `~/.config/matugen/colors.json` files |
| Hyprland window rules snippet generator | ✅ | Generates and copies ready-to-use `windowrulev2` rules for `hyprland.conf` |

---

## 3. Build & Packaging Status

- `npm run build`: **Success (0 errors)**
- Tauri Desktop Backend: [`src-tauri/`](file:///c:/Users/Luigi/Documents/Yozora/src-tauri/) (`Cargo.toml`, `tauri.conf.json`, `build.rs`, `src/main.rs`).
- AUR Packaging: [`aur/PKGBUILD`](file:///c:/Users/Luigi/Documents/Yozora/aur/PKGBUILD), [`aur/yozora.desktop`](file:///c:/Users/Luigi/Documents/Yozora/aur/yozora.desktop), and [`public/logo.svg`](file:///c:/Users/Luigi/Documents/Yozora/public/logo.svg).
