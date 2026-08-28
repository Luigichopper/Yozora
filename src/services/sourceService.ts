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
    // 1. Direct fetch
    try {
      const res = await fetch(feedUrl, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return await res.text();
    } catch {}

    // 2. High-speed CORS proxy failovers
    const proxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(feedUrl)}`
    ];

    for (const pUrl of proxies) {
      try {
        const pRes = await fetch(pUrl, { signal: AbortSignal.timeout(3500) });
        if (pRes.ok) return await pRes.text();
      } catch {}
    }

    return null;
  }

  /**
   * Parse RSS XML into TorrentSource array with smart title keyword filtering
   */
  public parseRssXmlToSources(xmlText: string, providerName: string, queryFilter?: string): TorrentSource[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const items = Array.from(doc.querySelectorAll('item'));
    const sources: TorrentSource[] = [];

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5\u3040-\u30ff]/g, ' ').replace(/\s+/g, ' ').trim();
    const cleanQuery = queryFilter ? normalize(queryFilter) : '';
    // Extract significant keywords (length >= 3 or CJK characters)
    const queryKeywords = cleanQuery.split(' ').filter(k => k.length >= 3 || /[\u4e00-\u9fa5\u3040-\u30ff]/.test(k));

    items.forEach((item, idx) => {
      const title = item.querySelector('title')?.textContent || '';
      if (!title.trim()) return;

      const cleanItemTitle = normalize(title);

      // If a queryFilter was supplied, verify relevance:
      // Either direct inclusion OR at least one significant keyword must match
      if (cleanQuery && queryKeywords.length > 0) {
        const hasDirectMatch = cleanItemTitle.includes(cleanQuery);
        const hasKeywordMatch = queryKeywords.some(kw => cleanItemTitle.includes(kw));
        if (!hasDirectMatch && !hasKeywordMatch) {
          return;
        }
      }

      const link = item.querySelector('link')?.textContent || item.querySelector('enclosure')?.getAttribute('url') || '';
      const guid = item.querySelector('guid')?.textContent || `${Date.now()}_${idx}`;
      const pubDate = item.querySelector('pubDate')?.textContent || new Date().toISOString();
      
      // Honest parsing of RSS seeders / leechers / size
      const nyaaSeeders = item.getElementsByTagNameNS('https://nyaa.si/xmlns/nyaa', 'seeders')[0]?.textContent;
      const nyaaLeechers = item.getElementsByTagNameNS('https://nyaa.si/xmlns/nyaa', 'leechers')[0]?.textContent;
      const nyaaSize = item.getElementsByTagNameNS('https://nyaa.si/xmlns/nyaa', 'size')[0]?.textContent;
      
      let seeders = nyaaSeeders ? parseInt(nyaaSeeders, 10) : 0;
      let leechers = nyaaLeechers ? parseInt(nyaaLeechers, 10) : 0;
      let size = nyaaSize || '';

      // Fallback: check enclosure length for byte size
      if (!size) {
        const enclosure = item.querySelector('enclosure');
        const lengthAttr = enclosure?.getAttribute('length');
        if (lengthAttr) {
          const bytes = parseInt(lengthAttr, 10);
          if (!isNaN(bytes) && bytes > 0) {
            size = bytes >= 1073741824 
              ? `${(bytes / 1073741824).toFixed(2)} GB`
              : `${(bytes / 1048576).toFixed(1)} MB`;
          }
        }
      }

      if (!size) {
        size = 'N/A';
      }

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
   * Build provider-specific search query URL for RSS endpoints
   */
  public buildProviderSearchUrl(prov: RSSFeedProvider, term: string): string {
    const cleanTerm = term.trim();
    if (!cleanTerm) return prov.url;

    if (prov.id === 'nyaa' || prov.url.includes('nyaa.si')) {
      return `https://nyaa.si/?page=rss&q=${encodeURIComponent(cleanTerm)}&c=1_2&f=0`;
    }
    if (prov.id === 'garden' || prov.url.includes('dmhy.org')) {
      return `https://share.dmhy.org/topics/rss/rss.xml?keyword=${encodeURIComponent(cleanTerm)}`;
    }
    if (prov.id === 'mikan' || prov.url.includes('mikanani.me')) {
      return `https://mikanani.me/RSS/Search?searchstr=${encodeURIComponent(cleanTerm)}`;
    }
    if (prov.id === 'subsplease' || prov.url.includes('subsplease.org')) {
      return `https://subsplease.org/rss/?r=1080&t=${encodeURIComponent(cleanTerm)}`;
    }
    if (prov.id === 'acgrip' || prov.url.includes('acg.rip')) {
      return `https://acg.rip/feed?term=${encodeURIComponent(cleanTerm)}`;
    }
    return `${prov.url}${prov.url.includes('?') ? '&' : '?'}q=${encodeURIComponent(cleanTerm)}`;
  }

  /**
   * Fetch live sources for an anime title from IndexedDB or enabled live RSS providers
   */
  public async getSourcesForAnime(
    animeId: string,
    animeTitle: string,
    romajiTitle?: string
  ): Promise<TorrentSource[]> {
    const searchTerms = [romajiTitle, animeTitle].filter((t): t is string => Boolean(t && t.trim()));
    const primaryTerm = searchTerms[0] || animeTitle;

    // 1. Check cached database sources and ensure relevance
    const cached = await db.getSourcesForAnime(animeId);
    if (cached && cached.length > 0) {
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
      const cleanTerm = normalize(primaryTerm);
      const keywords = cleanTerm.split(' ').filter(k => k.length >= 3);
      const relevantCached = cached.filter(src => {
        const cleanTitle = normalize(src.title);
        return cleanTitle.includes(cleanTerm) || (keywords.length > 0 && keywords.some(k => cleanTitle.includes(k)));
      });

      if (relevantCached.length > 0) {
        return this.rankSources(relevantCached);
      } else {
        // Cached sources belonged to an old bug/wrong feed, purge and re-fetch
        await db.clearSourcesForAnime(animeId);
      }
    }

    // 2. Query enabled live RSS providers in PARALLEL with primary search term
    const enabledProviders = this.providers.filter(p => p.enabled);
    const results = await Promise.allSettled(
      enabledProviders.map(async (prov) => {
        const queryUrl = this.buildProviderSearchUrl(prov, primaryTerm);
        const xml = await this.fetchLiveRssXml(queryUrl);
        if (xml) {
          return this.parseRssXmlToSources(xml, prov.name, primaryTerm);
        }
        return [];
      })
    );

    const liveResults: TorrentSource[] = [];
    results.forEach((res) => {
      if (res.status === 'fulfilled' && res.value.length > 0) {
        liveResults.push(...res.value);
      }
    });

    if (liveResults.length > 0) {
      const ranked = this.rankSources(liveResults);
      await db.saveSources(animeId, ranked);
      return ranked;
    }

    return [];
  }
}

export const sourceService = new SourceService();
