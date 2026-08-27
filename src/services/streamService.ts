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
      const sources = await sourceService.getSourcesForAnime(animeId || animeTitle, animeTitle);
      if (sources && sources.length > 0) {
        const epSources = sources.filter(s => s.episodeNum === episodeNum || !s.episodeNum);
        const targetSources = epSources.length > 0 ? epSources : sources;

        for (let i = 0; i < Math.min(targetSources.length, 5); i++) {
          const src = targetSources[i];
          let streamUrl = `http://127.0.0.1:3030/torrents/${i}/stream/0`;

          try {
            const streamRes = await rqbitService.addTorrentAndGetStream(src.magnetLink, animeTitle);
            if (streamRes?.stream_url) {
              streamUrl = streamRes.stream_url;
            }
          } catch (e) {
            console.warn('rqbit registration fallback:', e);
          }

          streamSources.push({
            url: streamUrl,
            isHls: false,
            quality: `${src.resolution} (${src.codec})`,
            server: `[${src.group}] ${src.title.slice(0, 32)}... (▲${src.seeders})`,
            torrentSource: src,
            torrentId: i
          });
        }
      }
    } catch (err) {
      console.warn('[StreamService] BitTorrent stream resolution fallback:', err);
    }

    return streamSources;
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
      onReady?.();
    }
    return null;
  }
}

export const streamService = new StreamService();
