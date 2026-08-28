import { AnimeEpisode, StreamData } from '../../types/anime';

export interface AnimeProvider {
  name: string;
  search(query: string): Promise<{ id: string; title: string; subOrDub: 'sub' | 'dub' }[]>;
  fetchEpisodes(animeId: string): Promise<AnimeEpisode[]>;
  fetchSources(episodeId: string, server?: string): Promise<StreamData>;
}

export class ConsumetProvider implements AnimeProvider {
  public name = 'Consumet Unified Scraper';
  private defaultUrl: string = 'https://api.consumet.org/anime';

  private getBaseUrl(): string {
    if (typeof localStorage !== 'undefined') {
      const custom = localStorage.getItem('yozora_consumet_api_url');
      if (custom && custom.trim()) return custom.trim().replace(/\/$/, '');
    }
    return this.defaultUrl;
  }

  async search(query: string): Promise<{ id: string; title: string; subOrDub: 'sub' | 'dub' }[]> {
    const baseUrl = this.getBaseUrl();
    const providers = ['gogoanime', 'zoro', 'animepahe'];
    for (const provider of providers) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        const res = await fetch(`${baseUrl}/${provider}/${encodeURIComponent(query)}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) continue;
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          return data.results.map((item: any) => ({
            id: `${provider}:${item.id}`,
            title: item.title,
            subOrDub: item.subOrDub || 'sub',
          }));
        }
      } catch (err) {
        // Fail quietly on dead/offline public endpoints
      }
    }
    return [];
  }

  async fetchEpisodes(compoundId: string): Promise<AnimeEpisode[]> {
    const [provider, id] = compoundId.includes(':') ? compoundId.split(':') : ['gogoanime', compoundId];
    const res = await fetch(`${this.getBaseUrl()}/${provider}/info/${encodeURIComponent(id)}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch episode list for ${compoundId}: HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.episodes || !Array.isArray(data.episodes)) {
      throw new Error(`Invalid episode payload received for ${compoundId}`);
    }
    return data.episodes.map((ep: any) => ({
      id: `${provider}:${ep.id}`,
      number: ep.number,
      title: ep.title || `Episode ${ep.number}`,
      description: ep.description,
      image: ep.image,
      isFiller: Boolean(ep.isFiller),
    }));
  }

  async fetchSources(compoundEpisodeId: string): Promise<StreamData> {
    const [provider, epId] = compoundEpisodeId.includes(':') 
      ? compoundEpisodeId.split(':') 
      : ['gogoanime', compoundEpisodeId];
      
    const res = await fetch(`${this.getBaseUrl()}/${provider}/watch/${encodeURIComponent(epId)}`);
    if (!res.ok) {
      throw new Error(`Failed to resolve stream for ${compoundEpisodeId}: HTTP ${res.status}`);
    }
    const data = await res.json();
    
    if (!data.sources || data.sources.length === 0) {
      throw new Error(`No stream sources found for episode ${compoundEpisodeId}`);
    }

    const subtitles = (data.subtitles || []).map((sub: any) => ({
      url: sub.url,
      lang: sub.lang || 'Unknown',
      label: sub.label || sub.lang || 'Subtitles',
      isDefault: sub.lang?.toLowerCase() === 'english' || sub.default === true,
    }));

    return {
      headers: data.headers || {},
      sources: data.sources.map((s: any) => ({
        url: s.url,
        isM3U8: s.isM3U8 || s.url.includes('.m3u8'),
        quality: s.quality || 'auto',
      })),
      subtitles,
      download: data.download,
      intro: data.intro ? { start: data.intro.start, end: data.intro.end } : undefined,
      outro: data.outro ? { start: data.outro.start, end: data.outro.end } : undefined,
    };
  }
}

export const activeProvider = new ConsumetProvider();
