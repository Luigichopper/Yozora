import Hls from 'hls.js';
import { sourceService } from './sourceService';
import { rqbitService } from './rqbitService';
import { activeProvider } from './providers';
import { TorrentSource } from '../types/anime';

export interface AnimeStreamSource {
  url: string;
  isHls: boolean;
  quality: string;
  server: string;
  torrentSource?: TorrentSource;
  torrentId?: number;
}

class StreamService {
  /**
   * Resolve real video and BitTorrent stream sources for an anime episode
   */
  public async resolveEpisodeStream(
    animeId: string,
    animeTitle: string,
    romajiTitle?: string,
    episodeNum = 1
  ): Promise<AnimeStreamSource[]> {
    const streamSources: AnimeStreamSource[] = [];

    // 1. Try Consumet multi-provider stream resolver (HLS / MP4 direct streams)
    try {
      const searchTitle = romajiTitle || animeTitle;
      const searchResults = await activeProvider.search(searchTitle);
      if (searchResults.length > 0) {
        const bestMatch = searchResults[0];
        const episodes = await activeProvider.fetchEpisodes(bestMatch.id);
        const targetEp = episodes.find(e => e.number === episodeNum) || episodes[episodeNum - 1] || episodes[0];
        
        if (targetEp) {
          const streamData = await activeProvider.fetchSources(targetEp.id);
          for (const source of streamData.sources) {
            streamSources.push({
              url: source.url,
              isHls: source.isM3U8 || source.url.includes('.m3u8'),
              quality: source.quality || 'Auto',
              server: `[Direct CDN] ${bestMatch.title} - EP ${targetEp.number}`
            });
          }
        }
      }
    } catch (err) {
      console.warn('[StreamService] Provider stream resolution fallback:', err);
    }

    // 2. Fetch real BitTorrent sources from RSS indexers (Nyaa, SubsPlease, Anime Garden, Mikan)
    try {
      const sources = await sourceService.getSourcesForAnime(animeId || animeTitle, animeTitle, romajiTitle);
      if (sources && sources.length > 0) {
        const epSources = sources.filter(s => s.episodeNum === episodeNum || !s.episodeNum);
        const targetSources = epSources.length > 0 ? epSources : sources;

        for (let i = 0; i < Math.min(targetSources.length, 10); i++) {
          const src = targetSources[i];
          streamSources.push({
            url: '',
            isHls: false,
            quality: `${src.resolution} (${src.codec})`,
            server: `[${src.group}] ${src.title.slice(0, 34)}... (▲${src.seeders || 0})`,
            torrentSource: src
          });
        }

        // Only register the #1 top-ranked source with rqbit for immediate streaming
        if (streamSources.length > 0 && streamSources[0].torrentSource) {
          try {
            const topRes = await rqbitService.addTorrentAndGetStream(
              streamSources[0].torrentSource.magnetLink,
              animeTitle
            );
            if (topRes?.stream_url) {
              streamSources[0].url = topRes.stream_url;
              streamSources[0].torrentId = topRes.torrent_id;
            }
          } catch (e) {
            // Non-fatal; PlayerView will fallback to WebTorrent
          }
        }
      }
    } catch (err) {
      console.warn('[StreamService] BitTorrent stream resolution fallback:', err);
    }

    return streamSources;
  }

  /**
   * Universal playback handler: Starts sequential stream if magnet and optionally spawns hardware-accelerated MPV
   */
  public async playAnimeStream(
    magnetOrUrl: string,
    title: string,
    preferredPlayer: 'mpv' | 'webview' = 'webview'
  ): Promise<{ streamUrl: string; launchedMpv: boolean }> {
    let resolvedStreamUrl = magnetOrUrl;

    // 1. If input is a magnet link, start sequential download in rqbit backend
    if (magnetOrUrl.startsWith('magnet:?')) {
      try {
        const res = await rqbitService.addTorrentAndGetStream(magnetOrUrl, title);
        if (res && res.stream_url) {
          resolvedStreamUrl = res.stream_url;
        }
      } catch (err) {
        console.warn('[StreamService] Failed to start rqbit stream for magnet:', err);
        throw err;
      }
    }

    // 2. If external MPV is preferred (or if URL is raw 10-bit MKV), launch MPV directly
    if (preferredPlayer === 'mpv') {
      try {
        await rqbitService.launchExternalMpv(resolvedStreamUrl, title);
        return { streamUrl: resolvedStreamUrl, launchedMpv: true };
      } catch (mpvErr) {
        console.warn('[StreamService] Failed to launch external mpv, falling back to webview:', mpvErr);
      }
    }

    return { streamUrl: resolvedStreamUrl, launchedMpv: false };
  }

  /**
   * Attach video element with HLS.js or direct playback
   */
  public attachHlsPlayer(videoElement: HTMLVideoElement, streamUrl: string, onReady?: () => void): Hls | null {
    if (streamUrl.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true
        });
        hls.loadSource(streamUrl);
        hls.attachMedia(videoElement);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          onReady?.();
        });
        return hls;
      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        videoElement.src = streamUrl;
        onReady?.();
      }
    } else {
      videoElement.src = streamUrl;
      // Do NOT call onReady() here — PlayerView's else branch will call
      // video.load() + video.play() after this returns null, which is correct.
      // Calling onReady here causes a double-play race where load() aborts play().
    }
    return null;
  }
}

export const streamService = new StreamService();
