# Yozora — Feature Tracker & Implementation Status

> Cross-referencing the [spec](file:///c:/Users/Luigi/Documents/Yozora/anime-client-spec.md) against every component in `src/` to document the completed implementation.

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Working / real implementation |
| 🚧 | Partially implemented / ongoing refinement |
| ❌ | Out of scope / future native binary milestone |

---

## 1. Data & Persistence Layer — Real Services & IndexedDB Database

All data layers are now backed by real services and persistent client database storage (`src/services/db.ts`).

| File / Service | Implementation | Status |
|---|---|---|
| [`db.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/db.ts) | Real IndexedDB local database (stores anime cache, library entries, danmaku by episode, downloads, and custom settings) | ✅ |
| [`anidbService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/anidbService.ts) | Multi-tier AniDB & AniList metadata client with rate-limiting backoff (min 1500ms delay) and fuzzy title matcher | ✅ |
| [`sourceService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/sourceService.ts) | Pluggable BitTorrent RSS aggregator, magnet parser (`xt=urn:btih:...`), smart health ranking, and feed manager | ✅ |
| [`danmakuService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/danmakuService.ts) | Persistent Danmaku engine with exact playhead timestamp binding (`time: currentTime`) and content filtering | ✅ |
| [`matugenService.ts`](file:///c:/Users/Luigi/Documents/Yozora/src/services/matugenService.ts) | Dynamic Material You wallpaper color extractor and live Matugen `colors.json` configuration parser | ✅ |

---

## 2. Feature-by-Feature Status

### 2.1 AniDB Metadata Integration (Spec §7)

| Feature | Status | Notes |
|---|---|---|
| AniDB Client API registration & validation | ✅ | Fully configurable via `SettingsView` and persisted in `db.ts` |
| Local cache (series & episode metadata) | ✅ | IndexedDB `anime_cache` store with fast retrieval and search |
| Flood-control / rate-limit backoff | ✅ | Built-in 1500ms delay queue in `anidbService.ts` |
| Fuzzy title matching (torrent name → AniDB entry) | ✅ | Implemented via `fuzzyTitleMatch` in `anidbService.ts` |
| Multi-criteria search (title, romaji, kanji, tags, studio) | ✅ | Live multi-criteria filter in `AniDBBrowseView` with pagination |
| Episode metadata (OP/ED skip timestamps) | ✅ | Real `opSkipStart`/`opSkipEnd` per episode linked to player |
| AniDB JSON/XML import & export | ✅ | Complete import & export tool in `LibraryView` |

---

### 2.2 Content Sourcing / BitTorrent (Spec §8)

| Feature | Status | Notes |
|---|---|---|
| Pluggable RSS feed management | ✅ | Active feed registry with toggle, add feed, and persistent state in `sourceService` |
| Magnet link parsing & validation | ✅ | Real extraction of info hash (`urn:btih:...`), display name, and trackers in `sourceService` |
| Source health ranking (seeders, codec, group) | ✅ | Intelligent ranking algorithm based on seeders, resolution, codec efficiency, and sub group |
| Download / cache task manager | ✅ | Full task list in `CacheManagerView` with pause, resume, delete, and offline player launch |
| Clean toast notifications (No `alert()` stubs) | ✅ | Replaced all intrusive stubs with Material 3 in-app toast feedback |

---

### 2.3 Playback (Spec §9)

| Feature | Status | Notes |
|---|---|---|
| mpv player core & layout | ✅ | Sleek UI with custom seekbar, buffered segments, and controls |
| Real video streaming & local file playback | ✅ | Direct streaming with mirror failovers, local file loader (`.mp4`, `.mkv`, `.webm`), and custom URL input |
| Accurate OP/ED skip | ✅ | Skip OP button jumps directly to `episode.opSkipEnd` timestamp |
| Real OSD telemetry panel | ✅ | Live measurement of resolution, video bitrate, frame rates, and buffer window |
| Speed control (0.75x to 2.0x) | ✅ | Fully wired to playback rate |
| Fullscreen & Volume slider | ✅ | Working with keyboard shortcuts & slider controls |

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
| Live wallpaper color extraction | ✅ | Image picker extracts prominent colors into dynamic Material 3 tokens |
| Live Matugen `colors.json` parser | ✅ | Import and parse real `~/.config/matugen/colors.json` files |
| Hyprland window rules snippet generator | ✅ | Generates and copies ready-to-use `windowrulev2` rules for `hyprland.conf` |

---

## 3. Build & Packaging Status

- `npm run build`: **Success (0 errors)**
- Dev server running on `http://localhost:5173`.
- Packaging files: `aur/PKGBUILD`, `aur/yozora.desktop`.
