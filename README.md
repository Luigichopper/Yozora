# 🌌 Yozora (夜空)

<p align="center">
  <img src="https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx164212-eKh15LQxkTEx.jpg" width="140" alt="Yozora Cover" style="border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />
</p>

<p align="center">
  <b>A native Arch Linux + Hyprland anime tracking, browsing, and playback client.</b><br/>
  Styled to match the <b>end4-pC</b> Quickshell / Material 3 desktop aesthetic with live <b>Matugen</b> theming, <b>AniDB</b> metadata, pluggable <b>BitTorrent/RSS</b> sourcing, and a canvas-based <b>Danmaku</b> playback layer.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Arch_Linux_%7C_Hyprland-blue?style=flat-square&logo=archlinux" />
  <img src="https://img.shields.io/badge/Theme-Material_3_%2F_Matugen-e4b5cb?style=flat-square" />
  <img src="https://img.shields.io/badge/Metadata-anidb.net-orange?style=flat-square" />
  <img src="https://img.shields.io/badge/Player-libmpv_+_Danmaku-purple?style=flat-square" />
  <img src="https://img.shields.io/badge/License-GPL--3.0-green?style=flat-square" />
</p>

---

## ✨ Features

- 🎨 **Material 3 / end4-pC Quickshell Aesthetic**:
  - Live dynamic palette integration with Matugen (`~/.config/matugen/colors.json`).
  - Wallpaper color extractor generating real-time Material You tokens from desktop backgrounds.
  - Curated presets: *Twilight Sakura*, *Catppuccin Mocha*, *Tokyo Night*, *AniDB Amber*, *Rosé Pine*, *Emerald Aurora*, and *Cyberpunk Neon*.
  - Layer-shell compositor blur, tonal surfaces, and rounded containers (16–28px radii).

- 🧭 **Discover & Airing Timetable (探索)**:
  - 16:9 widescreen **Top Trending** banner showcase (最高热度).
  - Day-by-day weekly **Seasonal Airing Schedule** modal (新番时间表).
  - **Continue Watching** shelf with episode progress bars and quick resume (继续观看).
  - Curated recommendations and season picks (推荐).

- 📚 **AniDB Catalog & Metadata Browser (浏览)**:
  - Multi-criteria filtering by title/romaji/kanji, type (TV, Movie, OVA, ONA, Special), status, seasons, years, genres, and ratings.
  - Rich anime details view with synopsis, Japanese/Romaji titles, tags, relations graph (prequels/sequels), and episode lists.
  - Flood-control rate limiter queue (1500ms backoff) and fuzzy title matching against BitTorrent releases.

- ⚡ **Pluggable BitTorrent & RSS Content Sourcing**:
  - Pluggable RSS feed registry (Nyaa, Mikan Project, Anime Garden, Tokyo Toshokan, SubsPlease, ACG.RIP) with live latency checks.
  - Magnet link parser (`xt=urn:btih:...`) extracting info-hashes, display names, and trackers.
  - Intelligent health ranking algorithm scoring releases by seeders, resolution (1080p, 4K HDR), codecs (HEVC, AV1), and fansub groups.

- 🎬 **mpv Playback Layer & Canvas Danmaku Engine**:
  - High-performance HTML5 Canvas bullet comment engine (rolling, top-fixed, bottom-fixed) with opacity, size, and speed controls.
  - Exact `currentTime` timestamp binding when posting bullet comments, persisted in local storage.
  - mpv OSD HUD with **Stats for Nerds** telemetry (resolution, live bitrate, audio codecs, dropped frames).
  - Precise episode intro skip (`opSkipEnd`) markers and local video file loader (`.mp4`, `.mkv`, `.webm`).

- 📦 **Local-First Library & Cache Manager (追番 & 缓存)**:
  - Watch status categories: *Watching*, *Plan to Watch*, *Completed*, *On Hold*, *Dropped*.
  - 10-point personal rating score editor and AniDB JSON/XML sync import/export.
  - Offline BitTorrent cache manager with throughput meters and offline playback launcher.

---

## 🏗️ Architecture & Tech Stack

```mermaid
flowchart TD
    UI[Desktop UI — Quickshell / Material 3] --> Core[App Core / React + TypeScript]
    Core --> DB[(IndexedDB / yozora_db)]
    Core --> Meta[AniDB & Metadata Service]
    Core --> Src[Source Aggregation Layer]
    Core --> Play[mpv Playback + Canvas Danmaku]
    Core --> Theme[Matugen Theme Engine]

    Meta -->|Rate-limited API / Cache| AniDB[(AniDB / AniList)]
    Src -->|RSS / Magnet Search| Feeds[(Pluggable RSS Indexes)]
    Theme -->|Watches / Extracted| Matugen[(Matugen colors.json)]
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Installation & Local Run

```bash
# Clone repository
git clone https://github.com/pctrade/yozora.git
cd Yozora

# Install dependencies
npm install

# Start local development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
npm run build
```

---

## 🐧 Arch Linux & Hyprland Integration

### Hyprland Window Rules
Add the following snippet to your `~/.config/hypr/hyprland.conf`:

```ini
# Yozora Desktop Window Rules
windowrulev2 = float, class:^(yozora)$
windowrulev2 = size 1200 800, class:^(yozora)$
windowrulev2 = center, class:^(yozora)$
windowrulev2 = opacity 0.95 0.90, class:^(yozora)$
windowrulev2 = rounding 20, class:^(yozora)$
windowrulev2 = noborder, class:^(yozora)$
windowrulev2 = idleinhibit focus, class:^(yozora)$
```

### AUR Packaging
Packaging templates are provided in the [`aur/`](file:///c:/Users/Luigi/Documents/Yozora/aur/) directory:
- [`aur/PKGBUILD`](file:///c:/Users/Luigi/Documents/Yozora/aur/PKGBUILD)
- [`aur/yozora.desktop`](file:///c:/Users/Luigi/Documents/Yozora/aur/yozora.desktop)

---

## 📜 Content & Legal Policy
- Metadata is sourced from canonical AniDB / AniList indices under API rate limits.
- Content sourcing is BitTorrent/RSS-shaped and user-configured; Yozora ships with no default unlicensed streaming scrapers.
- `anidb.app` is not affiliated with AniDB and is explicitly out of scope.

---

## 📄 License
This project is licensed under the [GPL-3.0-or-later License](LICENSE).
