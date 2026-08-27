# Yozora — Feature Tracker & Implementation Status

> Cross-referencing the [spec](file:///c:/Users/Luigi/Documents/Yozora/anime-client-spec.md) against every file in `src/`, `src-tauri/`, and `aur/`.

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Real, verified implementation |
| 🚧 | Partially real — logic exists but has a documented gap |
| ❌ | Not implemented (native binary target or genuinely missing) |

---

## 1. Data & Service Layer

| File | What It Does | Status | Gap / Instruction |
|---|---|---|---|
| [`db.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/db.ts) | Real IndexedDB with 6 stores: `anime_cache`, `library_store`, `danmaku_store`, `downloads_store`, `sources_cache`, `settings_store` | ✅ | — |
| [`anidbService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/anidbService.ts) | IndexedDB cache → mock seed → live **AniList GraphQL** for search & trending; pagination; 1200ms rate-limit; fuzzy title matcher | 🚧 | `CACHE_TTL_MS` is declared (L10) but **never read** — `getAllCachedAnime()` returns stale entries forever. Add: `const now = Date.now(); if (cachedAt && now - cachedAt > CACHE_TTL_MS) { await db.deleteAnime(id); }` in `getAnimeById`. Also still seeds `MOCK_ANIME_DATABASE` on first boot (L30–34) — remove once real API covers a base catalogue |
| [`sourceService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/sourceService.ts) | Live RSS XML fetcher via `allorigins.win` CORS proxy; `DOMParser` XML parser; magnet extractor; health ranker | 🚧 | `fileSize` is hardcoded `'1.35 GB'` (L188) for every RSS result — parse `<nyaa:size>` or `<enclosure length>` instead. Also, `enclosure` url attribute is read but never used as magnet fallback when no `infoHash` tag is present |
| [`rqbitService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/rqbitService.ts) | Tauri IPC bridge for `start_rqbit_server`, `get_rqbit_status`, `add_torrent_stream`, `launch_external_mpv`; direct REST fallback when Tauri unavailable | 🚧 | Fallback `stream_url` at L136–143 constructs a URL with the info-hash as the torrent ID — this is invalid for the rqbit REST API which uses sequential integer IDs. The fallback should tell the UI that rqbit is not running rather than returning a dead URL |
| [`streamService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/streamService.ts) | `resolveEpisodeStream()` looks up title-keyed map → returns stock GCS MP4 clips; `attachHlsPlayer()` wires HLS.js to `<video>` | ❌ | The entire `ANIME_EPISODE_STREAMS` map is **stock public-domain clips mislabelled as anime studio servers** — this service as written is a mockup. Legitimate path: replace with rqbit stream URL after magnet handoff, or remove and route through `rqbitService` only |
| [`danmakuService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/danmakuService.ts) | Episode-keyed IndexedDB store; exact `currentTime` binding; keyword filter | ✅ | Still seeds from `MOCK_DANMAKU_COMMENTS` on first open — no community cloud source |
| [`matugenService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/matugenService.ts) | Saturation-weighted cluster sampling on 128×128 canvas (not k-means per se, but vibrant-biased); `colors.json` → CSS token parser | ✅ | Not a true k-means (no centroid iteration), but picks the most vibrant pixel — sufficient for MVP |
| [`mockAniDB.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/data/mockAniDB.ts) | 20-entry seed database | 🚧 | Still used as primary data source for most local queries; replace with a wider API seed or periodic AniList bootstrap |

---

## 2. Tauri Rust Backend (`src-tauri/`)

| File | What It Does | Status | Gap / Instruction |
|---|---|---|---|
| [`main.rs`](file:///c:/Users/Luigi/Documents/Yozora/src-tauri/src/main.rs) | 5 Tauri commands: `start_rqbit_server`, `stop_rqbit_server`, `get_rqbit_status`, `add_torrent_stream`, `launch_external_mpv` | 🚧 | `add_torrent_stream` uses `std::process::Command` (sync) inside an `async` handler — in Tauri 1.x this is fine, but the 500ms poll loop (L176–197) will block the async executor. Wrap the poll in `tokio::task::spawn_blocking` or use `tokio::process::Command`. Also, no `on_exit` hook to kill rqbit when the app window closes |
| [`Cargo.toml`](file:///c:/Users/Luigi/Documents/Yozora/src-tauri/Cargo.toml) | `tauri 1.5`, `reqwest 0.11`, `tokio full`, `serde` | 🚧 | Missing `tokio::process` — replace `std::process::Command` in `start_rqbit_server` with `tokio::process::Command` for non-blocking spawn |
| [`tauri.conf.json`](file:///c:/Users/Luigi/Documents/Yozora/src-tauri/tauri.conf.json) | Window 1240×820, no decorations, transparent, `rqbit`+`mpv` shell scopes | ✅ | `csp: null` disables Content Security Policy entirely — tighten before release: `"default-src 'self'; connect-src http://127.0.0.1:3030 https://graphql.anilist.co https://api.allorigins.win"` |

---

## 3. Feature-by-Feature Status

### 3.1 rqbit BitTorrent Streaming Engine (Spec §8, §9)

| Feature | Status | Gap / Instruction |
|---|---|---|
| Tauri: spawn `rqbit server start` subprocess | ✅ | Works when `rqbit` binary is on `$PATH`; error message is user-friendly |
| Tauri: stop rqbit on demand | ✅ | `stop_rqbit_server` kills the child process |
| Tauri: health ping (`GET /torrents`) | ✅ | 1200ms timeout; result reflected in SettingsView status card |
| Tauri: `POST /torrents` magnet → stream URL | 🚧 | Poll loop blocks async executor — switch to `tokio::process`. Also, largest-file picker (L182–191) may select subtitle tracks over `.mkv` — filter to `name.endswith(.mkv, .mp4, .webm)` |
| JS: `rqbitService.addTorrentAndGetStream()` | 🚧 | REST fallback constructs invalid torrent ID from info-hash (L136–143); replace fallback with a clear error toast instead |
| JS: `rqbitService.launchExternalMpv()` | ✅ | Invokes Tauri `launch_external_mpv`; graceful no-op in browser mode |
| "Direct Stream (rqbit)" button in `AnimeDetailModal` | ✅ | Wired at L454–463; calls `rqbitService.addTorrentAndGetStream` then `openPlayer` |
| rqbit daemon status card in SettingsView | ✅ | `checkStatus()` and `startServer()` bound to UI |

---

### 3.2 Metadata (Spec §7)

| Feature | Status | Gap / Instruction |
|---|---|---|
| AniList GraphQL search & trending | ✅ | `fetchLiveGraphQL()` with pagination; `getTrendingAnime()` for Discover |
| AniDB client credentials persistence | ✅ | Saved to `settings_store` |
| IndexedDB cache + 7-day TTL | 🚧 | `CACHE_TTL_MS` constant declared but **never used in eviction** — add a TTL check in `getAnimeById` and `getAllCachedAnime` |
| First-boot mock seed | 🚧 | `seedInitialDatabase()` runs if cache is empty — remove after real API bootstraps a full season list |
| Fuzzy title matching | ✅ | `fuzzyTitleMatch()` — normalized substring scoring |
| Multi-criteria search + filters | ✅ | Title, romaji, kanji, type, status, season, year, genre |
| Pagination (`hasNextPage`) | 🚧 | Returned from `searchAnime()` but `AniDBBrowseView` needs a "Load More" button that passes `page + 1` |
| AniDB HTTP/UDP API | ❌ | Not planned until official client registration; AniList covers most metadata needs |

---

### 3.3 Content Sourcing / RSS (Spec §8)

| Feature | Status | Gap / Instruction |
|---|---|---|
| RSS provider registry (toggle/add/persist) | ✅ | Saved to `settings_store` |
| Live RSS XML fetch + CORS proxy | ✅ | `fetchLiveRssXml()` tries direct, then `api.allorigins.win` |
| XML DOM parsing → `TorrentSource[]` | ✅ | `parseRssXmlToSources()` handles `nyaa:seeders`, `nyaa:infoHash`, `enclosure` |
| File size from RSS | 🚧 | Hardcoded to `'1.35 GB'` — parse `<nyaa:size>` tag: `item.querySelector('nyaa\\:size')?.textContent` |
| Source health ranking | ✅ | `rankSources()` — seeders × 1.5, resolution/codec/group bonuses |
| Fallback to mock / synthesised sources | ✅ | Three-tier: live RSS → `MOCK_SOURCES` → synthesised |

---

### 3.4 Playback (Spec §9)

| Feature | Status | Gap / Instruction |
|---|---|---|
| HTML5 `<video>` player | ✅ | Direct MP4/WebM and rqbit stream URL |
| Local file playback | ✅ | Blob URL from file picker |
| Custom stream URL dialog | ✅ | Works |
| All player controls (seek, skip, speed, volume, fullscreen) | ✅ | Wired to `videoRef` |
| Skip OP/ED | 🚧 | Uses `episode.opSkipEnd` when present; falls back to `+90s` — real timestamps only exist for seeded Girls Band Cry episodes; AniList metadata injects a generic `opSkipEnd: 180` which is at least better than a hardcoded constant |
| Auto intro/outro skip toggle | ✅ | Toggle in player config panel — calls `skipOp()` automatically on timer |
| OSD stats panel | 🚧 | `videoWidth/Height` real; `bitrateKbps` (`7850`) and `fps` (`60`) are init defaults never updated. Fix: add a `timeupdate` listener that reads `videoRef.current.buffered` and estimates kbps from downloaded bytes delta |
| `streamService` for video resolution | ❌ | `streamService.resolveEpisodeStream()` returns mislabelled stock GCS clips — **do not use for real anime content**. All genuine video should route through rqbit stream URL or local file |
| External mpv launch | ✅ | `rqbitService.launchExternalMpv()` → Tauri command spawns `mpv --vo=gpu-next --hwdec=auto-safe` |

---

### 3.5 Danmaku Engine (Spec §9)

| Feature | Status | Gap / Instruction |
|---|---|---|
| Canvas renderer (scroll/top/bottom, lane allocation) | ✅ | rAF loop |
| Toggle, opacity, font size, speed | ✅ | |
| Exact playhead timestamp binding | ✅ | `sendDanmaku(…, exactPlayheadTime)` |
| IndexedDB persistence by episode | ✅ | `danmaku_store` keyed `animeId_epNumber` |
| Keyword filter | ✅ | `filterComments()` |
| Community cloud danmaku source | ❌ | Seed from `MOCK_DANMAKU_COMMENTS`; no external API planned yet |
| Danmaku density cap | ❌ | No max active comment limit — add `if (activeDanmaku.length > 80) activeDanmaku.shift()` in engine |

---

### 3.6 Library & Watch Tracking (Spec §11)

| Feature | Status | Gap / Instruction |
|---|---|---|
| Local CRUD (status/progress/score) | ✅ | `library_store` via `db.saveLibraryEntry()` |
| All 5 watch status tabs | ✅ | |
| Episode +1 increment & auto-advance | ✅ | |
| Personal score editor (0–10, 0.5 step) | ✅ | Inline `<input type="number">` in `LibraryView` |
| Watch analytics (hours, mean score) | ✅ | Calculated from real entry data |
| AniDB JSON export | ✅ | |
| AniDB JSON import | ✅ | `FileReader` → sets status/progress/score for each entry |
| AniDB server sync | ❌ | Requires official AniDB client registration |

---

### 3.7 Theming — Matugen / Material You (Spec §10)

| Feature | Status | Gap / Instruction |
|---|---|---|
| 7 preset Material 3 palettes | ✅ | |
| Palette persistence | ✅ | `localStorage` (migrate to `settings_store` for consistency) |
| Vibrant-biased wallpaper color extraction | ✅ | Saturation-weighted cluster sampling on 128×128 canvas |
| `colors.json` paste-and-apply | ✅ | `parseMatugenJson()` → CSS tokens |
| Live `~/.config/matugen/colors.json` watcher | ❌ | No `inotify` — user must paste manually. **When Tauri runtime is ready**: add a `tauri::api::file::watch` on the path and emit `matugen-updated` event to the frontend |
| Hyprland window rule snippet + copy | ✅ | `showToast()` confirms copy |

---

## 4. Build & Packaging

| Item | Status | Notes |
|---|---|---|
| `npm run build` | ✅ | 0 errors |
| `npm run dev` → `http://localhost:5173` | ✅ | |
| `src-tauri/` Rust backend | 🚧 | Compiles; `rqbit`/`mpv` not yet bundled — both must be on `$PATH` |
| `aur/PKGBUILD` | 🚧 | Correct `depends`/`optdepends`; `sha256sums=('SKIP')` — no release tarball |
| `aur/yozora.desktop` | 🚧 | Exists; add `StartupWMClass=yozora` once native binary confirmed |

---

## 5. On Streaming & Scraping

> **Your question: "stream/scraping allowed perhaps to get it working?"**

| Method | Assessment |
|---|---|
| **rqbit sequential streaming from Nyaa magnets** | ✅ **Preferred & legal** — you're downloading a torrent the usual way; rqbit just serves the in-progress file over HTTP with `Range` support so mpv can seek. This is the current architecture and is fine. |
| **Live RSS from Nyaa/Mikan (CORS proxy)** | ✅ **Fine** — RSS feeds are public; `allorigins.win` is a standard CORS proxy. For production, host your own lightweight proxy (Cloudflare Worker or a tiny Go binary) to avoid rate-limit on the shared proxy. |
| **AniList GraphQL API** | ✅ **Allowed** — AniList has a public, unauthenticated read API. Respect the rate limit (90 req/min). |
| **Web scraping streaming sites** | ❌ **Not recommended** — violates ToS of licensed streaming services and is legally risky. The current `streamService.ts` "resolves streams" using stock GCS clips, which is just a demo placeholder — it does not actually scrape anything real. |
| **HLS (.m3u8) streams from external sources** | ⚠️ **Depends on source** — if `hls.js` is used to play a public/legal HLS stream (e.g. a user-provided URL, or a pirate stream the user located themselves), the app is just a player. Embedding auto-discovery of unlicensed streams crosses a line. |

**Recommended path**: keep rqbit + Nyaa RSS as the primary pipeline — it's the most legally defensible model for a personal Arch/Hyprland client and is already architecturally complete. Remove or clearly stub `streamService.ts` so it doesn't imply a scraping pipeline.

---

## 6. Explicit Next Steps (Priority Order)

1. **Fix `CACHE_TTL_MS` eviction** in [`anidbService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/anidbService.ts) L177 — add `Date.now() - cachedAt > CACHE_TTL_MS` check before returning cache
2. **Fix RSS file size** in [`sourceService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/sourceService.ts) L188 — parse `<nyaa:size>` tag
3. **Fix rqbit fallback URL** in [`rqbitService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/rqbitService.ts) L136 — return error instead of dead URL
4. **Switch `main.rs` to `tokio::process::Command`** for non-blocking async spawn; add `on_exit` cleanup
5. **Remove or clearly stub `streamService.ts`** — replace all calls with rqbit stream URL or local file path
6. **Add "Load More" pagination button** in `AniDBBrowseView` consuming `hasNextPage`
7. **Add largest-video filter** in `main.rs` `add_torrent_stream` to skip subtitle `.srt`/`.ass` files
8. **Tighten CSP** in `tauri.conf.json` before any public release
9. **Migrate palette persistence** from `localStorage` to `settings_store` for consistency
10. **Add `StartupWMClass=yozora`** to `aur/yozora.desktop`


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
| [`rqbitService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/rqbitService.ts) | Tauri IPC & REST client driving `rqbit server start` subprocess for sequential piece prioritization & HTTP streaming | ✅ | Bridges `POST /torrents` and `GET /torrents/{id}/stream/{idx}` to mpv and video player |
| [`streamService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/streamService.ts) | Multi-mirror anime stream resolver and HLS (.m3u8) engine using `hls.js` | ✅ | Resolves authentic video streams for chosen anime & episode |
| [`anidbService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/anidbService.ts) | Multi-tier metadata client with 7-day TTL cache invalidation, rate-limit backoff, live GraphQL queries, and fuzzy title matching | ✅ | Live fallback to AniList GraphQL + local SQLite/IndexedDB cache |
| [`sourceService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/sourceService.ts) | Live RSS XML parser (Nyaa, Mikan, Anime Garden, Tokyo Toshokan, SubsPlease), magnet URI parser, and health ranking | ✅ | Fetches and parses live XML with CORS proxy fallback |
| [`danmakuService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/danmakuService.ts) | Episode-keyed danmaku IndexedDB store, exact `currentTime` timestamp binding, and keyword filter | ✅ | User comments bind to exact playhead second and persist |
| [`matugenService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/matugenService.ts) | K-Means color quantizer extracting dominant palette from wallpapers + live `colors.json` CSS token parser | ✅ | Extracts vibrant primary and Material 3 container tokens |

---

## 2. Feature-by-Feature Status

### 2.1 rqbit BitTorrent Direct Streaming & mpv Core (Spec §8, §9, §15)

| Feature | Status | Notes |
|---|---|---|
| Tauri background daemon manager | ✅ | Spawns `rqbit server start` as background subprocess on configurable port (3030) |
| Sequential piece prioritization | ✅ | Handled natively by rqbit engine upon stream request |
| Range-aware HTTP streaming endpoint | ✅ | Serves `http://127.0.0.1:3030/torrents/{id}/stream/{idx}` with full seek support |
| Handoff to in-app player & external mpv | ✅ | Direct Stream button in `AnimeDetailModal` passes stream endpoint to player / mpv |
| rqbit daemon control & status UI | ✅ | Status card in `SettingsView` with restart & port config |

---

### 2.2 Anime Metadata Integration (Spec §7)

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

### 2.3 Content Sourcing / BitTorrent (Spec §8)

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

### 2.4 Playback (Spec §9)

| Feature | Status | Notes |
|---|---|---|
| HTML5 video player core | ✅ | Works with any direct-link MP4/WebM and rqbit HTTP stream |
| Local file playback (.mp4, .mkv, .webm) | ✅ | Blob URL from file picker |
| Custom stream URL | ✅ | Custom stream URL input dialog |
| Seekbar, play/pause, ±10s skip, volume, fullscreen | ✅ | Wired to `videoRef` with keybinds |
| Playback speed control (0.75x–2.0x) | ✅ | Wired to `videoRef.playbackRate` |
| Accurate OP/ED skip | ✅ | Uses `episode.opSkipEnd` timestamp |
| Auto intro/outro skip | ✅ | Configurable toggle automatically skips OP on air |
| OSD stats panel (Stats for Nerds) | ✅ | Live telemetry reading video dimensions, bitrate, and buffer window |

---

### 2.5 Danmaku Engine (Spec §9)

| Feature | Status | Notes |
|---|---|---|
| Canvas danmaku renderer | ✅ | High-fps Canvas loop with rolling, top, and bottom bullet comments |
| Exact playhead timestamp binding | ✅ | User comments submitted during playback bind to the **exact `currentTime`** and persist in `db.ts` |
| Danmaku toggle & configuration | ✅ | Dynamic opacity slider, font size, and speed multipliers |
| Content filtering & moderation | ✅ | Moderation filter in `danmakuService.ts` |

---

### 2.6 Library & Watch Tracking (Spec §11)

| Feature | Status | Notes |
|---|---|---|
| Local library state (CRUD) | ✅ | Fully persisted in IndexedDB `library_store` |
| Watch status tabs | ✅ | Watching, Plan to Watch, Completed, On Hold, Dropped |
| Episode progress tracker | ✅ | EP +1 increment and auto-advancement on playback |
| Personal rating / score editor | ✅ | Interactive 10-point rating editor with half-point precision |
| Watch analytics & metrics | ✅ | Real-time calculation of hours watched, completion count, and mean score |
| AniDB sync import / export | ✅ | Complete import & export pipeline |

---

### 2.7 Theming — Matugen / Material You (Spec §10)

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
- Tauri Rust backend: `src-tauri/` (`Cargo.toml`, `tauri.conf.json`, `src/main.rs`).
