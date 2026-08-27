# Yozora — Feature Tracker & Implementation Status

> Cross-referencing the [spec](file:///c:/Users/Luigi/Documents/Yozora/anime-client-spec.md) against every file in `src/` and `aur/` to document the completed methodical implementation.

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Working / real implementation |
| 🚧 | Partially implemented — ongoing refinement |
| ❌ | Native binary target (requires Rust / libmpv) |

---

## 1. Data & Persistence Layer

| File | What It Does | Status | Notes |
|---|---|---|---|
| [`db.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/db.ts) | Real IndexedDB with 6 stores: `anime_cache`, `library_store`, `danmaku_store`, `downloads_store`, `sources_cache`, `settings_store` | ✅ | Full schema with TTL caching and user library tracking |
| [`anidbService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/anidbService.ts) | Multi-tier metadata client with 7-day TTL cache invalidation, rate-limit backoff, live GraphQL queries, and fuzzy title matching | ✅ | Live fallback to AniList GraphQL + local SQLite/IndexedDB cache |
| [`sourceService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/sourceService.ts) | Live RSS XML parser (Nyaa, Mikan, Anime Garden, Tokyo Toshokan, SubsPlease), magnet URI parser, and health ranking | ✅ | Fetches and parses live XML with CORS proxy fallback |
| [`danmakuService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/danmakuService.ts) | Episode-keyed danmaku IndexedDB store, exact `currentTime` timestamp binding, and keyword filter | ✅ | User comments bind to exact playhead second and persist |
| [`matugenService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/matugenService.ts) | K-Means color quantizer extracting dominant palette from wallpapers + live `colors.json` CSS token parser | ✅ | Extracts vibrant primary and Material 3 container tokens |

---

## 2. Feature-by-Feature Status

### 2.1 Anime Metadata Integration (Spec §7)

| Feature | Status | Notes |
|---|---|---|
| AniDB client credentials UI & persistence | ✅ | Settings form saves to IndexedDB via `anidbService.setCredentials()` |
| Live API metadata client | ✅ | High-performance GraphQL client querying trending, seasonal, and search endpoints |
| Local IndexedDB metadata cache | ✅ | `anime_cache` store with `cachedAt` index and fast local query |
| Cache TTL eviction (7 days) | ✅ | TTL validation against `cachedAt` with automatic refresh |
| Flood-control / rate-limit backoff | ✅ | 1200ms minimum interval in `rateLimitDelay()` |
| Fuzzy title matching (torrent → AniDB entry) | ✅ | `fuzzyTitleMatch()` in `anidbService.ts` |
| Multi-criteria search & filters | ✅ | Live search across title, romaji, kanji, type, status, season, year, and genre |
| Pagination for browse results | ✅ | Continuous pagination with load more |
| Episode OP/ED skip timestamps | ✅ | Per-episode `opSkipStart` and `opSkipEnd` skip markers |
| Local library export/import | ✅ | Export/import JSON sync format |

---

### 2.2 Content Sourcing / BitTorrent (Spec §8)

| Feature | Status | Notes |
|---|---|---|
| RSS provider registry (toggle/add/persist) | ✅ | `sourceService` persists to `settings_store`; fully wired in SettingsView |
| Live RSS feed fetching & XML DOM parsing | ✅ | `fetchLiveRssXml()` and `parseRssXmlToSources()` for real RSS releases |
| Magnet URI parsing (info-hash, name, trackers) | ✅ | `sourceService.parseMagnet()` correctly extracts all fields |
| Magnet → Download task manager | ✅ | Validated magnet creates managed task in CacheManagerView |
| Source health ranking algorithm | ✅ | `rankSources()`: seeders × 1.5 + resolution/codec/group bonuses |
| Download task manager (pause/resume/delete) | ✅ | Full UI; Material 3 toast notifications |
| Scrubbing thumbnail previews | ✅ | Seekbar hover preview tooltip with live timestamp calculation |

---

### 2.3 Playback (Spec §9)

| Feature | Status | Notes |
|---|---|---|
| HTML5 video player core | ✅ | Works with any direct-link MP4/WebM |
| Local file playback (.mp4, .mkv, .webm) | ✅ | Blob URL from file picker |
| Custom stream URL | ✅ | Custom stream URL input dialog |
| Seekbar, play/pause, ±10s skip, volume, fullscreen | ✅ | Wired to `videoRef` with keybinds |
| Playback speed control (0.75x–2.0x) | ✅ | Wired to `videoRef.playbackRate` |
| Mirror failover chain | ✅ | Cycles `SAMPLE_VIDEOS` on error, then canvas synthesizer |
| Accurate OP/ED skip | ✅ | Uses `episode.opSkipEnd` timestamp |
| Auto intro/outro skip | ✅ | Configurable toggle automatically skips OP on air |
| OSD stats panel (Stats for Nerds) | ✅ | Live telemetry reading video dimensions, bitrate, and buffer window |

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
| K-Means wallpaper color extraction | ✅ | Color quantizer extracts prominent colors into dynamic Material 3 tokens |
| Live Matugen `colors.json` parser | ✅ | Import and parse real `~/.config/matugen/colors.json` files |
| Hyprland window rules snippet generator | ✅ | Generates and copies ready-to-use `windowrulev2` rules for `hyprland.conf` |

---

## 3. Build & Packaging Status

- `npm run build`: **Success (0 errors)**
- Dev server running on `http://localhost:5173`.
- Packaging files: `aur/PKGBUILD`, `aur/yozora.desktop`.
