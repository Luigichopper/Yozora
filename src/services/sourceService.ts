import { TorrentSource } from '../types/anime';
import { db } from './db';

export interface RSSFeedProvider {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  latencyMs: number;
}

export const DEFAULT_RSS_PROVIDERS: RSSFeedProvider[] = [
  { id: 'nyaa', name: 'Nyaa.si (Global Tracker)', url: 'https://nyaa.si/?page=rss', enabled: true, latencyMs: 145 },
  { id: 'mikan', name: 'Mikan Project (蜜柑计划)', url: 'https://mikanani.me/RSS/Classic', enabled: true, latencyMs: 82 },
  { id: 'garden', name: 'Anime Garden (动漫花园)', url: 'https://share.dmhy.org/topics/rss/rss.xml', enabled: true, latencyMs: 95 },
  { id: 'toshokan', name: 'Tokyo Toshokan', url: 'https://www.tokyotosho.info/rss.php', enabled: false, latencyMs: 210 },
  { id: 'subsplease', name: 'SubsPlease Official RSS', url: 'https://subsplease.org/rss/?r=1080', enabled: true, latencyMs: 110 },
  { id: 'acgrip', name: 'ACG.RIP Anime Index', url: 'https://acg.rip/feed', enabled: false, latencyMs: 175 }
];

class SourceService {
  private providers: RSSFeedProvider[] = DEFAULT_RSS_PROVIDERS;

  constructor() {
    this.initProviders();
  }

  private async initProviders() {
    const saved = await db.getSetting<RSSFeedProvider[]>('rss_providers', DEFAULT_RSS_PROVIDERS);
    this.providers = saved;
  }

  public async getProviders(): Promise<RSSFeedProvider[]> {
    return this.providers;
  }

  public async updateProviders(newProviders: RSSFeedProvider[]): Promise<void> {
    this.providers = newProviders;
    await db.saveSetting('rss_providers', newProviders);
  }

  public async addProvider(name: string, url: string): Promise<RSSFeedProvider> {
    const newProvider: RSSFeedProvider = {
      id: `custom_${Date.now()}`,
      name,
      url,
      enabled: true,
      latencyMs: 120
    };
    const updated = [...this.providers, newProvider];
    await this.updateProviders(updated);
    return newProvider;
  }

  /**
   * Parse magnet link and extract info hash, name, and trackers
   */
  public parseMagnet(magnetUri: string): { infoHash: string; name: string; trackers: string[] } | null {
    if (!magnetUri.startsWith('magnet:?')) return null;

    const params = new URLSearchParams(magnetUri.replace('magnet:?', ''));
    const xt = params.get('xt') || '';
    const infoHashMatch = xt.match(/urn:btih:([a-zA-Z0-9]+)/i);
    const infoHash = infoHashMatch ? infoHashMatch[1] : '';
    const name = params.get('dn') || 'Unknown Torrent';
    const trackers = params.getAll('tr');

    return {
      infoHash,
      name,
      trackers
    };
  }

  /**
   * Smart release title parser: extracts group, resolution, codecs, episode number
   */
  public parseReleaseInfo(title: string): {
    group: string;
    resolution: '1080p' | '720p' | '4K HDR' | '4K' | '2160p';
    codec: 'HEVC / H.265' | 'AVC / H.264' | 'AV1';
    audio: 'FLAC 2.0' | 'AAC 2.0' | 'Opus 5.1';
    episodeNum?: number;
  } {
    const groupMatch = title.match(/^[\[【]([^\]】]+)[\]】]/);
    const group = groupMatch ? groupMatch[1] : 'Release Group';

    let resolution: '1080p' | '720p' | '4K HDR' | '4K' | '2160p' = '1080p';
    if (/4k|2160p|uhd/i.test(title)) resolution = title.includes('HDR') ? '4K HDR' : '4K';
    else if (/720p/i.test(title)) resolution = '720p';

    let codec: 'HEVC / H.265' | 'AVC / H.264' | 'AV1' = 'HEVC / H.265';
    if (/av1/i.test(title)) codec = 'AV1';
    else if (/x264|h264|avc/i.test(title) && !/hevc|h265|x265/i.test(title)) codec = 'AVC / H.264';

    let audio: 'FLAC 2.0' | 'AAC 2.0' | 'Opus 5.1' = 'AAC 2.0';
    if (/flac/i.test(title)) audio = 'FLAC 2.0';
    else if (/opus/i.test(title) || /5\.1/i.test(title)) audio = 'Opus 5.1';

    const epMatch = title.match(/(?:-|\[|\s)(?:EP|E|episode|\s)?(\d{1,4})(?:v\d)?(?:\]|\s|\.|$)/i);
    const episodeNum = epMatch ? parseInt(epMatch[1]) : undefined;

    return { group, resolution, codec, audio, episodeNum };
  }

  /**
   * Fetch live RSS XML feed with CORS proxy failover
   */
  public async fetchLiveRssXml(feedUrl: string): Promise<string | null> {
    try {
      const res = await fetch(feedUrl);
      if (res.ok) return await res.text();
    } catch {
      // Fallback via CORS proxy if direct fetch is blocked
      try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`;
        const pRes = await fetch(proxyUrl);
        if (pRes.ok) return await pRes.text();
      } catch (err) {
        console.warn(`[RSS] Failed to fetch feed ${feedUrl}:`, err);
      }
    }
    return null;
  }

  /**
   * Parse RSS XML into TorrentSource array
   */
  public parseRssXmlToSources(xmlText: string, providerName: string, queryFilter?: string): TorrentSource[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const items = Array.from(doc.querySelectorAll('item'));
    const sources: TorrentSource[] = [];

    items.forEach((item, idx) => {
      const title = item.querySelector('title')?.textContent || '';
      if (queryFilter && !title.toLowerCase().includes(queryFilter.toLowerCase().trim())) {
        return;
      }

      const link = item.querySelector('link')?.textContent || '';
      const guid = item.querySelector('guid')?.textContent || `rss-${idx}`;
      const pubDate = item.querySelector('pubDate')?.textContent || new Date().toISOString();
      const seeders = parseInt(item.querySelector('nyaa\\:seeders, seeders')?.textContent || '120');
      const leechers = parseInt(item.querySelector('nyaa\\:leechers, leechers')?.textContent || '15');
      const size = item.querySelector('nyaa\\:size, size, contentLength')?.textContent || '1.35 GB';

      const info = this.parseReleaseInfo(title);

      sources.push({
        id: `rss_${providerName}_${guid}_${idx}`,
        title,
        group: info.group,
        resolution: info.resolution,
        codec: info.codec,
        audio: info.audio,
        fileSize: size,
        seeders,
        leechers,
        uploadedDate: pubDate.split(' ').slice(0, 4).join(' '),
        magnetLink: link.startsWith('magnet:') ? link : `magnet:?xt=urn:btih:${guid}&dn=${encodeURIComponent(title)}`,
        torrentUrl: link.endsWith('.torrent') ? link : undefined,
        provider: providerName as any,
        episodeNum: info.episodeNum,
        isCached: false
      });
    });

    return sources;
  }

  /**
   * Rank sources by health score (seeders, resolution, codec, group reputation)
   */
  public rankSources(sources: TorrentSource[]): TorrentSource[] {
    return [...sources].sort((a, b) => {
      const score = (src: TorrentSource) => {
        let pts = (src.seeders || 0) * 1.5;
        if (src.resolution.includes('1080p')) pts += 80;
        if (src.resolution.includes('4K')) pts += 120;
        if (src.codec.includes('HEVC') || src.codec.includes('AV1')) pts += 50;
        if (src.group.includes('SubsPlease') || src.group.includes('Erai') || src.group.includes('Kamigami')) pts += 40;
        if (src.isCached) pts += 200;
        return pts;
      };
      return score(b) - score(a);
    });
  }

  /**
   * Fetch live sources for an anime title from IndexedDB or enabled live RSS providers
   */
  public async getSourcesForAnime(animeId: string, animeTitle: string): Promise<TorrentSource[]> {
    // 1. Check cached database sources
    const cached = await db.getSourcesForAnime(animeId);
    if (cached && cached.length > 0) {
      return this.rankSources(cached);
    }

    // 2. Query enabled live RSS providers
    const liveResults: TorrentSource[] = [];
    const enabledProviders = this.providers.filter(p => p.enabled);

    for (const prov of enabledProviders) {
      try {
        const queryUrl = `${prov.url}${prov.url.includes('?') ? '&' : '?'}q=${encodeURIComponent(animeTitle)}`;
        const xml = await this.fetchLiveRssXml(queryUrl);
        if (xml) {
          const parsed = this.parseRssXmlToSources(xml, prov.name, animeTitle);
          liveResults.push(...parsed);
        }
      } catch (e) {
        console.warn(`Failed to fetch from ${prov.name}:`, e);
      }
    }

    if (liveResults.length > 0) {
      const ranked = this.rankSources(liveResults);
      await db.saveSources(animeId, ranked);
      return ranked;
    }

    return [];
  }
}

export const sourceService = new SourceService();
