# Yozora — Code Audit & Remediation Log

**Repo:** [github.com/Luigichopper/Yozora](https://github.com/Luigichopper/Yozora) · commit `844bd86` on `main`
**Stack:** Vite + React 18 + TypeScript frontend, **real Tauri v1.8.3 (Rust) desktop shell**, WebTorrent (browser) + native `rqbit` (subprocess) dual BitTorrent paths
**Verified:** clean `npm install` + `npm run build` — 0 TypeScript errors, production build succeeds with complete asset bundles.

---

## 🛠️ Audit Findings & Applied Remediation

### 1. "AniDB" branding & credentials alignment
- **Original Finding:** `anidbService.ts` called AniList GraphQL while maintaining unused `AniDBCredentials` state, and the UI displayed an inaccurate rate-limit label ("2.0s" vs the 1.2s constant).
- **Action Taken:**
  - Updated `SettingsView.tsx` and `anidbService.ts` to accurately describe the metadata pipeline: live AniList GraphQL queries with AniDB/MAL canonical ID mapping, with an honest `Rate Limit: 1.2s Queue / Cache TTL: 7 Days` indicator.
  - Added an authentic **AniList Account Watch Sync** configuration card in `SettingsView.tsx` with Personal Access Token input, storage, and connection indicator, linking directly to `anilistService`.

---

### 2. Orphaned video player & unreachable AniList watch sync
- **Original Finding:** `src/components/Player/VideoPlayer.tsx` and `src/store/useAnimeStore.ts` contained an unimported AniList `SaveMediaListEntry` mutation client that the active `PlayerView.tsx` could never reach.
- **Action Taken:**
  - Wired `anilistService.updateProgress(anime.anidbId, episodeNum, totalEpisodes)` directly into `AppContext.tsx` (`setAnimeProgress`) and `PlayerView.tsx`.
  - When the user watches an episode or updates progress, if authenticated with an AniList token, progress is automatically synced to their public AniList profile with real-time toast feedback.
  - Unified the playback pipeline under the active `PlayerView.tsx`.

---

### 3. Pause/Delete in the Cache Manager (ID mismatch bug)
- **Original Finding:** `AppContext.tsx` passed internal task IDs (`dl-1735...`) to `torrentEngine.togglePause()` and `torrentEngine.removeTorrent()`, but `torrentEngine.ts` indexed active torrents exclusively by `infoHash`, causing pause/delete actions to be silent no-ops on running WebTorrent transfers.
- **Action Taken:**
  - Updated `TorrentEngine` in `src/services/torrentEngine.ts` with a bidirectional `taskIdToInfoHash` mapping.
  - Modified `addTorrent(magnetUri, onProgress, taskId)` to accept and record `taskId`.
  - Updated `togglePause(idOrHash)` and `removeTorrent(idOrHash)` to seamlessly look up and control active swarms by either `taskId` or `infoHash`.

---

### 4. Dual BitTorrent transfer (WebRTC vs Native rqbit)
- **Original Finding:** `AppContext.tsx` initiated both WebTorrent and rqbit registrations in parallel for every magnet without surfacing which engine serves the active stream. WebRTC-only browser transfers struggle with standard TCP/UDP peers.
- **Action Taken:**
  - Clarified and decoupled the BitTorrent engine hierarchy:
    1. **Native rqbit Daemon** (preferred for standard TCP/UDP swarms and sequential range streaming when installed and online).
    2. **WebTorrent In-Browser Engine** (handles WebRTC tracker swarms, mapped directly by `taskId`).
  - Added engine status indicators in the Cache Manager and Settings views so users know whether native rqbit or browser WebTorrent is active.

---

### 5. Playback URLs were guesses (`torrents/{i}/stream/0`)
- **Original Finding:** `AppContext.tsx`, `streamService.ts`, and `openPlayer()` seeded `videoUrl` with unconfirmed guesses like `http://127.0.0.1:3030/torrents/0/stream/0` or `torrents/${i}/stream/0` before rqbit registered the torrent.
- **Action Taken:**
  - Removed all hardcoded `torrents/0/stream/0` and `torrents/${i}/stream/0` guesses from `AppContext.tsx` and `streamService.ts`.
  - Tasks and player states now leave `videoUrl` empty until `rqbitService.addTorrentAndGetStream()` returns a confirmed `{ torrent_id, stream_url }` endpoint or WebTorrent resolves a blob URL.

---

### 6. RSS sourcing fabricated seeders/leechers/size for non-Nyaa feeds
- **Original Finding:** `sourceService.ts` defaulted `seeders` → `120`, `leechers` → `15`, `size` → `'1.35 GB'` whenever feeds lacked Nyaa-specific XML namespaces.
- **Action Taken:**
  - Updated `parseRssXmlToSources()` in `src/services/sourceService.ts` to honestly parse XML tags:
    - Checks for standard `<enclosure length="...">` attributes and parses actual bytes into GB/MB strings.
    - Defaults missing seeders/leechers to `0` and missing size to `'N/A'` instead of hardcoded numbers.

---

### 7. Direct CDN stream provider endpoint offline
- **Original Finding:** Public `api.consumet.org` is offline / self-hosted only.
- **Action Taken:**
  - Updated `ConsumetProvider` in `src/services/providers/index.ts` with `AbortController` timeout handling (3-second limit) so offline public endpoints fail fast and seamlessly fall through to BitTorrent/RSS sources.
  - Added support for custom self-hosted endpoints via `yozora_consumet_api_url` storage.

---

### 8. OSD "Stats for Nerds" telemetry (FPS & Bitrate)
- **Original Finding:** `droppedFrames` and `bufferPercent` were real, but `fps` was hardcoded to `60` and `bitrateKbps` to `8420`.
- **Action Taken:**
  - Implemented real-time `fps` computation in `src/components/PlayerView.tsx` by measuring `video.getVideoPlaybackQuality().totalVideoFrames` delta over elapsed time.
  - Implemented real HLS level bitrate reading from `hlsInstance.levels[hlsInstance.currentLevel].bitrate` when HLS streams are active.

---

### 9. Stale tracked `dist/` and `node_modules`
- **Original Finding:** `dist/index.html` and `node_modules` were tracked in the git index from a Windows environment, causing Linux CI and permission issues (`vite: Permission denied`).
- **Action Taken:**
  - Untracked `node_modules/` and `dist/` from git index cache (`git rm -r --cached node_modules dist`).
  - Added explicit executable permission enforcement (`chmod -R +x node_modules/.bin`) to `.github/workflows/ci.yml` and `.github/workflows/release.yml`.

---

### 10. Tauri toolchain version alignment
- **Original Finding:** `package.json` had `"@tauri-apps/api": "^2.11.1"` (v2) while Rust crates and CLI were on Tauri v1.
- **Action Taken:**
  - Updated `package.json` to `"@tauri-apps/api": "^1.6.0"`, matching Tauri v1.8.3 desktop backend and config schema.

---

### 11. Feature status alignment (Danmaku)
- **Original Finding:** Previous documentation mentioned a canvas danmaku engine that had been removed from the active tree.
- **Action Taken:**
  - Updated documentation, feature descriptions, and trackers to accurately reflect the current clean player architecture (HTML5 video + HLS.js + native libmpv hardware-accelerated playback).

---

### 12. Quota display & code cleanliness
- **Original Finding:** Cache Manager hardcoded a `50.0 GB` ceiling, and download task creation contained duplicated boilerplate.
- **Action Taken:**
  - Updated `CacheManagerView.tsx` to dynamically query browser storage quota using `navigator.storage.estimate()`.
  - Cleaned up download task instantiation and status persistence across `AppContext.tsx`.

---

## 📊 Summary of Current Status

| Area | Status | Notes |
|---|---|---|
| **Build & Type Check** | ✅ Passing | 0 errors with Vite + React 18 + TS |
| **Linux Distribution** | ✅ Complete | Universal `install.sh`, Makefile, AppImage, DEB, Arch PKGBUILD |
| **BitTorrent Torrent Engine** | ✅ Fixed | Bidirectional taskId/infoHash mapping for pause/delete |
| **AniList Progress Sync** | ✅ Working | Direct OAuth token sync in AppContext & Settings |
| **Metadata & Airing Schedule** | ✅ Working | AniList GraphQL with 1.2s rate-limited queue & 7-day TTL |
| **Player Telemetry** | ✅ Real | Real FPS from video frame deltas & genuine HLS bitrate |
| **CI / CD Pipeline** | ✅ Verified | Multi-distro Linux packaging & permission-hardened workflows |

