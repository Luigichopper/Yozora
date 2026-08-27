# Yozora — Code Audit

**Repo:** [github.com/Luigichopper/Yozora](https://github.com/Luigichopper/Yozora) · single commit (`04dc700`) on `main`
**Stack:** Vite + React 18 + TypeScript, browser-only SPA (no Tauri/Electron shell present despite the README/PKGBUILD framing it as a native desktop app)
**Size:** ~6,260 LOC across `src/` (24 files)

---

## TL;DR

The repo is a well-built **UI prototype with a real local-persistence layer**, wrapped in a feature tracker (`yozora_feature_tracker.md`) that self-grades nearly every feature ✅ *"real implementation"* — including several that are entirely simulated. The gap between the tracker's claims and the code is the single biggest issue here: if this tracker is used to judge readiness (e.g. for a release or for handing off work), it will actively mislead.

Roughly:
- **Genuinely real:** IndexedDB persistence, RSS/XML fetching + parsing, magnet URI parsing, AniList GraphQL metadata queries, Matugen `colors.json` parsing, canvas-based wallpaper color extraction, the danmaku canvas engine.
- **Simulated but labeled "✅ live/real" in the tracker:** BitTorrent downloading, AniDB API integration (it's AniList, not AniDB), OSD "Stats for Nerds" telemetry, episode video playback (stock sample clips, not the actual downloaded/sourced episode).
- **Non-functional if actually used:** the AUR packaging (`aur/PKGBUILD`), the committed `dist/` build.

---

## 1. Metadata layer — branded "AniDB", actually AniList

`src/services/anidbService.ts` and the Settings UI present this as an **AniDB** integration — there's a whole "AniDB Client API Credentials" form (`SettingsView.tsx:324`) that saves a `clientName`/`clientVersion` pair to IndexedDB (`anidbService.ts:37-40`).

Those credentials are **never read anywhere else in the codebase.** Every live network call in the service hits AniList's public GraphQL endpoint instead:

```ts
// anidbService.ts:155, :244
const res = await fetch('https://graphql.anilist.co', { ... })
```

There is no code anywhere that talks to `anidb.net`'s actual HTTP/UDP API (which, notably, requires a registered client name/version exactly like what's being collected and then discarded — so the UI *looks* purpose-built for AniDB's real auth flow, it's just not wired to anything).

**Why it matters:** the feature tracker marks "AniDB client credentials UI & persistence" and "Live API metadata client" both ✅ with the note *"Settings form saves to IndexedDB via `anidbService.setCredentials()`"* and *"High-performance GraphQL client querying trending, seasonal, and search endpoints."* Both are true in isolation but the combination implies an AniDB integration that doesn't exist. If AniDB's actual terms/rate-limits matter to the project (the README explicitly frames this as sourcing "from canonical AniDB / AniList indices"), this needs to be either built for real or the UI/copy corrected so it doesn't collect credentials it silently ignores.

**Minor, related:** `fuzzyTitleMatch()` (`anidbService.ts:304`) is real string-matching logic and works independent of the above.

---

## 2. BitTorrent / download layer — no torrent client exists

This is the largest gap between documentation and code.

`AppContext.tsx:274-333` — `addDownloadTask` and `addCustomMagnetTask` both construct a `DownloadTask` that is **created already 100% complete**:

```ts
totalBytes: 1350000000,
downloadedBytes: 1350000000, // Complete for instant playback
downloadSpeed: 0,
progress: 100,
status: 'completed',
peers: source.seeders,       // just copies the (also fake) seeder count from the RSS/mock source
videoUrl: SAMPLE_VIDEOS.default,
```

Adding a magnet link shows a toast that reads *"Connected to BitTorrent swarm for '...'"* (`AppContext.tsx:331`) — nothing connects to a swarm. `CacheManagerView.tsx` renders a progress bar, peer count, ETA, and upload/download throughput meters, but there is no interval, worker, WebRTC/WebTorrent client, or any other mechanism anywhere in the repo that would ever change these numbers after creation — `toggleDownloadPause` (`AppContext.tsx:335`) just flips a hardcoded `downloadSpeed: 9500` on and off.

There's no `webtorrent`, `bittorrent-*`, or WASM-torrent dependency in `package.json` at all, so this isn't a wiring bug — the capability simply isn't implemented. That's expected for a browser SPA (torrenting from a browser tab is a real engineering problem), but the tracker's own legend defines ❌ as *"Native binary target (requires Rust / libmpv)"* and doesn't use that symbol here — every download-related row is marked ✅, including "Download task manager (pause/resume/delete)" and "Source health ranking algorithm," which conflates the (real) UI/data-shaping code with the (nonexistent) actual transfer.

**RSS sourcing itself is real**, and is the one area of "content sourcing" that holds up:
- `sourceService.fetchLiveRssXml()` (`sourceService.ts:133`) does a genuine direct `fetch`, falls back to `api.allorigins.win` as a CORS proxy, and `parseRssXmlToSources()` does real `DOMParser` XML parsing against Nyaa-style namespaced fields.
- `parseMagnet()` and `parseReleaseInfo()` are real regex/URLSearchParams parsing, not mocked.
- The gap: `getSourcesForAnime()` (`sourceService.ts:205`) only reaches this live path if all providers are enabled and return results; otherwise it silently falls through to `MOCK_SOURCES` or a hardcoded 3-item synthesized list with fabricated magnet hashes (`sourceService.ts:242-291`) — reasonable as a fallback, but worth knowing it's the path that fires whenever RSS providers are off, rate-limited, or the CORS proxy is down (which `api.allorigins.win` frequently is).

---

## 3. Playback — plays stock sample clips, not the sourced episode

`src/services/streamService.ts` maps anime titles to a hardcoded dictionary of public Google/Blender sample videos (`ForBiggerBlazes.mp4`, `Sintel.mp4`, `TearsOfSteel.mp4`, `ElephantsDream.mp4`, etc.), reused across every anime and relabeled with invented server names like *"Toei Animation HD Server"* or *"Studio Bind Server"* (`streamService.ts:11-132`). Anything not in the dictionary falls through to the same three sample clips with the anime's title spliced into a fake server name (`streamService.ts:157-176`).

This means: downloading a magnet/torrent, then hitting "play," never actually plays anything related to what was "downloaded" — `CacheManagerView`'s play button always resolves to `SAMPLE_VIDEOS.default` (`AppContext.tsx:293`, `:326`), and even when a real source's `videoUrl` is passed through, `openPlayer()` re-resolves via `streamService` if none is given (`AppContext.tsx:159-164`).

**OSD "Stats for Nerds" telemetry** (`PlayerView.tsx:76-81`, `:206-220`) is partly real, partly decorative:
- `videoWidth`/`videoHeight` — real, read from the actual `<video>` element.
- `fps` — hardcoded to `60`, never measured.
- `droppedFrames` — hardcoded to `0`, never measured.
- `bitrateKbps` — **not measured at all**, it's a sine wave: `Math.round(7400 + Math.sin(t * 0.5) * 900)` (`PlayerView.tsx:206`). It will oscillate smoothly forever regardless of actual network conditions.

The tracker lists "OSD stats panel (Stats for Nerds)" as ✅ *"Live telemetry reading video dimensions, bitrate, and buffer window"* — the dimensions claim is accurate, the bitrate claim is not.

What *is* solid here: the seekbar scrub-preview, OP/ED skip logic against `episode.opSkipEnd`, keybinds, playback-rate wiring, and the HLS.js integration path in `streamService.attachHlsPlayer()` (real `hls.js` usage, correctly gated behind `.m3u8` detection and native HLS fallback) — these aren't simulated, they're just never exercised by real content because nothing upstream ever supplies a real stream URL.

---

## 4. Theming (Matugen) — the most honestly-implemented "advanced" feature

`matugenService.ts` holds up better than its neighbors:
- `parseMatugenJson()` (`:17`) really parses a Matugen `colors.json` shape (with light/dark key fallback) into the app's Material 3 token set.
- `extractPaletteFromImage()` (`:51`) really draws an uploaded image to an off-screen canvas, samples pixels, filters by luminance, and picks the highest saturation×luminance cluster as a seed color, then derives container/tonal roles by brightness offset (`adjustBrightness()`).

One documentation nit: this is described in the README, the tracker, and in-code comments as **"K-Means Color Quantization"** (`matugenService.ts:49`) — it isn't k-means (no centroid iteration/reassignment), it's a single-pass sort of sampled pixels by a saturation/luminance score and taking the top result. It works and is a reasonable lightweight approach, but calling it k-means will confuse anyone who goes looking for the clustering step.

The Hyprland `windowrulev2` snippet generator and clipboard copy (`SettingsView.tsx:33-45`) are exactly what they claim to be — static text generation, no issues.

---

## 5. Native packaging — currently cannot produce a working package

`aur/PKGBUILD` will fail if built as-is:
```sh
package() {
  install -Dm755 "yozora" "$pkgdir/usr/bin/yozora"        # no such binary anywhere in the repo/source array
  install -Dm644 "yozora.desktop" ...
  install -Dm644 "icon.png" ...                            # not in source=(), not in the repo at all
}
```
- `source=("yozora.desktop")` never fetches a `yozora` binary or `icon.png`, yet `package()` installs both.
- `depends=('mpv' 'gtk4' 'libadwaita' 'webkit2gtk-4.1' 'xdg-desktop-portal-hyprland')` implies a native GTK/webkit shell (Tauri-shaped), but there is no `src-tauri/`, no Rust, no GTK bindings anywhere in the repo — it's a pure browser SPA served by Vite. `.gitignore` does reference `src-tauri/target`, so a native shell may have been the intent at some point, but it isn't present.
- There's no build/CI step anywhere in the repo that would produce the `yozora` binary this PKGBUILD assumes exists.

This looks like a packaging *template* written ahead of the native shell rather than a working package — fine as a placeholder, but the tracker's "Build & Packaging Status" section states `npm run build: Success (0 errors)` and lists the AUR files as done, without flagging that the package itself can't currently be built.

**Committed `dist/`:** `dist/` is listed in `.gitignore` but is present in the repo anyway (likely force-added). It's also broken as committed: `dist/index.html` references `/assets/index-DaF_Do2g.js`, but `dist/assets/` only contains the CSS file — the JS bundle was never committed, so this build artifact can't run even if served directly. Recommend just removing `dist/` from the repo (it's already gitignored) rather than fixing the partial commit.

**Minor:** both `index.html` (dev) and `dist/index.html` reference `/logo.svg` for the favicon; no `logo.svg` exists anywhere in the repo (no `public/` directory at all), so the icon 404s.

---

## 6. What's solid

Worth calling out explicitly since the framing above is mostly gaps:

- **`db.ts`** — a clean, correct IndexedDB wrapper. Six stores, sensible indexes (`cachedAt`, `epKey`, `animeId`), consistent promise-wrapping of `IDBRequest`. No notes.
- **RSS/XML fetching and parsing** (`sourceService.ts`) — real network calls, real DOM parsing, sensible CORS-proxy fallback.
- **Magnet/release-title parsing** — real regex-based extraction (info hash, trackers, group, resolution, codec, episode number), sensibly defaulted.
- **Danmaku engine** (`danmakuService.ts`, `DanmakuEngine.tsx`) — comments persist per-episode keyed by exact `currentTime`, canvas rendering isn't mocked, and there's a real (if simple) forbidden-word filter.
- **Matugen palette parsing + wallpaper extraction** — see §4.
- **TypeScript config** is reasonably strict (`strict: true`), and `types/anime.ts` gives the whole app a coherent shared shape.

---

## 7. Recommendations, roughly by priority

1. **Reconcile `yozora_feature_tracker.md` with reality first.** It's the document most likely to be trusted at face value (by a collaborator, or by future-you deciding what's left to build). At minimum, split "real implementation" from "UI/data model built, backing engine not yet implemented" — the tracker's own ❌ legend already has language for this, it's just unused for the download/streaming rows.
2. **Decide the metadata story:** either implement AniDB's actual API against the credentials already being collected, or drop the AniDB branding/credentials UI and be upfront that this is an AniList-backed client (which is a perfectly reasonable choice on its own — AniList's GraphQL API is well-documented and public — it's the mismatch with the AniDB framing that's the issue, not the choice of AniList itself).
3. **BitTorrent is the biggest scope question.** A real browser-based torrent client (e.g. WebTorrent, which needs WebRTC-capable peers/trackers) is a materially different project than what exists now. Worth deciding early whether v1 targets that, targets shelling out to a local daemon (the `optdepends` already gestures at `transmission-cli` — that's a more realistic path for a *native* Arch app than in-browser torrenting), or drops "cache manager" scope until the native shell exists.
4. **Fix or gate the OSD bitrate readout** — either wire it to `video.getVideoPlaybackQuality()` (real browser API, gives real dropped-frame counts) or remove the sine-wave placeholder so it doesn't read as instrumentation.
5. **Untrack `dist/`** (it's already gitignored) and fix or remove the AUR `source=()`/`package()` mismatch so it's clearly marked as a template rather than a buildable package.
6. **Rename "K-Means"** in the wallpaper extractor to something accurate (e.g. "saturation-weighted sampling") — small thing, but it'll save someone a debugging session looking for centroid logic that isn't there.
