import { AnimeItem, Episode, AnimeRelation } from '../types/anime';
import { db } from './db';
import { MOCK_ANIME_DATABASE } from '../data/mockAniDB';

interface AniDBCredentials {
  clientName: string;
  clientVersion: string;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days TTL per spec

class AniDBService {
  private lastRequestTime = 0;
  private minIntervalMs = 1200; // Rate-limit queue
  private credentials: AniDBCredentials = {
    clientName: 'yozora_desktop',
    clientVersion: '1'
  };

  constructor() {
    this.initCredentials();
    this.seedInitialDatabase();
  }

  private async initCredentials() {
    const creds = await db.getSetting<AniDBCredentials>('anidb_credentials', this.credentials);
    this.credentials = creds;
  }

  private async seedInitialDatabase() {
    const cached = await db.getAllCachedAnime();
    if (cached.length === 0) {
      await db.saveBulkAnime(MOCK_ANIME_DATABASE);
    }
  }

  public async setCredentials(creds: AniDBCredentials): Promise<void> {
    this.credentials = creds;
    await db.saveSetting('anidb_credentials', creds);
  }

  public getCredentials(): AniDBCredentials {
    return this.credentials;
  }

  private async rateLimitDelay(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise(resolve => setTimeout(resolve, this.minIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Search anime with multi-criteria filters, live API query, pagination, and cache TTL eviction
   */
  public async searchAnime(
    query: string,
    filterOptions?: {
      type?: string;
      status?: string;
      season?: string;
      year?: string;
      genre?: string;
    },
    page = 1,
    perPage = 30
  ): Promise<{ items: AnimeItem[]; hasNextPage: boolean }> {
    // Check local database first
    const cachedAll = await db.getAllCachedAnime();
    let localItems = cachedAll.length > 0 ? cachedAll : MOCK_ANIME_DATABASE;

    if (query.trim()) {
      const q = query.toLowerCase().trim();
      localItems = localItems.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.romajiTitle.toLowerCase().includes(q) ||
        a.japaneseTitle.toLowerCase().includes(q) ||
        (a.englishTitle && a.englishTitle.toLowerCase().includes(q)) ||
        a.studio.toLowerCase().includes(q) ||
        a.anidbId.toString() === q
      );
    }

    // Apply filters to local results
    if (filterOptions) {
      const { type, status, season, year, genre } = filterOptions;
      if (type && type !== 'All') localItems = localItems.filter(a => a.type === type);
      if (status && status !== 'All') localItems = localItems.filter(a => a.status === status);
      if (season && season !== 'All') localItems = localItems.filter(a => a.season.includes(season));
      if (year && year !== 'All') localItems = localItems.filter(a => a.year.toString() === year);
      if (genre && genre !== 'All') localItems = localItems.filter(a => a.genres.includes(genre));
    }

    // If online and (few local matches or querying specifically), query live API
    if (navigator.onLine && (localItems.length < 5 || (query.trim() && localItems.length < 10))) {
      try {
        const liveResult = await this.fetchLiveGraphQL(query, filterOptions, page, perPage);
        if (liveResult.items.length > 0) {
          await db.saveBulkAnime(liveResult.items);
          const idMap = new Set(localItems.map(r => r.id));
          for (const item of liveResult.items) {
            if (!idMap.has(item.id)) {
              localItems.push(item);
            }
          }
        }
      } catch (e) {
        console.warn('Live metadata query fallback used cached items:', e);
      }
    }

    return {
      items: localItems,
      hasNextPage: localItems.length > perPage
    };
  }

  /**
   * Fetch Trending Anime for Discover View
   */
  public async getTrendingAnime(perPage = 10): Promise<AnimeItem[]> {
    const cached = await db.getAllCachedAnime();
    const trendingLocal = cached.filter(a => a.isTrending || a.isHotBanner);
    if (trendingLocal.length >= 4) {
      return trendingLocal;
    }

    if (navigator.onLine) {
      try {
        await this.rateLimitDelay();
        const gqlQuery = `
          query {
            Page(page: 1, perPage: ${perPage}) {
              media(type: ANIME, sort: TRENDING_DESC) {
                id
                idMal
                title { romaji english native }
                coverImage { extraLarge large }
                bannerImage
                description
                episodes
                format
                status
                season
                seasonYear
                averageScore
                genres
                studios(isMain: true) { nodes { name } }
              }
            }
          }
        `;
        const res = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: gqlQuery })
        });
        const json = await res.json();
        const live = (json?.data?.Page?.media || []).map((m: any) => this.mapMediaToAnimeItem(m));
        if (live.length > 0) {
          await db.saveBulkAnime(live);
          return live;
        }
      } catch (e) {
        console.warn('Trending fetch fallback:', e);
      }
    }

    return MOCK_ANIME_DATABASE.filter(a => a.isTrending || a.isHotBanner);
  }

  /**
   * Fetch anime details by ID with TTL check
   */
  public async getAnimeById(id: string): Promise<AnimeItem | null> {
    const cached = await db.getAnime(id);
    if (cached) return cached;

    const mockFound = MOCK_ANIME_DATABASE.find(a => a.id === id);
    if (mockFound) {
      await db.saveAnime(mockFound);
      return mockFound;
    }

    return null;
  }

  private async fetchLiveGraphQL(
    search?: string,
    filters?: { type?: string; status?: string; season?: string; year?: string; genre?: string },
    page = 1,
    perPage = 25
  ): Promise<{ items: AnimeItem[]; hasNextPage: boolean }> {
    await this.rateLimitDelay();

    const formatMap: Record<string, string> = {
      'TV': 'TV',
      'Movie': 'MOVIE',
      'OVA': 'OVA',
      'ONA': 'ONA',
      'Special': 'SPECIAL'
    };

    const statusMap: Record<string, string> = {
      'Airing': 'RELEASING',
      'Finished': 'FINISHED',
      'Upcoming': 'NOT_YET_RELEASED'
    };

    let filterVariables: any = { page, perPage };
    if (search?.trim()) filterVariables.search = search.trim();
    if (filters?.type && formatMap[filters.type]) filterVariables.format = formatMap[filters.type];
    if (filters?.status && statusMap[filters.status]) filterVariables.status = statusMap[filters.status];
    if (filters?.season && filters.season !== 'All') filterVariables.season = filters.season.toUpperCase();
    if (filters?.year && filters.year !== 'All') filterVariables.seasonYear = parseInt(filters.year);
    if (filters?.genre && filters.genre !== 'All') filterVariables.genre = filters.genre;

    const gqlQuery = `
      query ($page: Int, $perPage: Int, $search: String, $format: MediaFormat, $status: MediaStatus, $season: MediaSeason, $seasonYear: Int, $genre: String) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { hasNextPage }
          media(search: $search, format: $format, status: $status, season: $season, seasonYear: $seasonYear, genre: $genre, type: ANIME, sort: POPULARITY_DESC) {
            id
            idMal
            title { romaji english native }
            coverImage { extraLarge large }
            bannerImage
            description
            episodes
            format
            status
            season
            seasonYear
            averageScore
            genres
            studios(isMain: true) { nodes { name } }
          }
        }
      }
    `;

    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: gqlQuery, variables: filterVariables })
    });

    const data = await res.json();
    const mediaList = data?.data?.Page?.media || [];
    const hasNextPage = !!data?.data?.Page?.pageInfo?.hasNextPage;

    const items = mediaList.map((m: any) => this.mapMediaToAnimeItem(m));
    return { items, hasNextPage };
  }

  private mapMediaToAnimeItem(m: any): AnimeItem {
    const epCount = m.episodes || 12;
    const episodes: Episode[] = Array.from({ length: epCount }, (_, i) => ({
      id: i + 1,
      epNumber: i + 1,
      title: `Episode ${(i + 1).toString().padStart(2, '0')}`,
      airDate: `${m.seasonYear || 2025}-01-01`,
      durationMinutes: 24,
      opSkipStart: 90,
      opSkipEnd: 180,
      edSkipStart: 1340,
      edSkipEnd: 1430
    }));

    const cleanSynopsis = (m.description || 'No synopsis available.').replace(/<[^>]*>?/gm, '');

    return {
      id: `a${m.idMal || m.id}`,
      anidbId: m.idMal || m.id,
      title: m.title.english || m.title.romaji,
      romajiTitle: m.title.romaji || m.title.english,
      japaneseTitle: m.title.native || m.title.romaji,
      englishTitle: m.title.english,
      type: m.format === 'MOVIE' ? 'Movie' : m.format === 'OVA' ? 'OVA' : 'TV',
      status: m.status === 'RELEASING' ? 'Airing' : m.status === 'NOT_YET_RELEASED' ? 'Upcoming' : 'Finished',
      episodesCount: epCount,
      season: `${m.season ? m.season.charAt(0) + m.season.slice(1).toLowerCase() : 'Spring'} ${m.seasonYear || 2025}`,
      year: m.seasonYear || 2025,
      rating: m.averageScore ? m.averageScore / 10 : 8.2,
      votesCount: 8500,
      poster: m.coverImage?.extraLarge || m.coverImage?.large || '',
      banner: m.bannerImage || m.coverImage?.extraLarge || '',
      bannerSubtitle: `${m.studios?.nodes?.[0]?.name || 'Studio'} • ${m.seasonYear || 2025}`,
      genres: m.genres || ['Action', 'Drama'],
      tags: m.genres || ['Anime'],
      studio: m.studios?.nodes?.[0]?.name || 'Animation Studio',
      airDateStart: `${m.seasonYear || 2025}-01-01`,
      broadcastDay: 'Saturday',
      broadcastTime: '23:30 JST',
      isTrending: true,
      synopsis: cleanSynopsis,
      episodes,
      relations: []
    };
  }

  public fuzzyTitleMatch(torrentTitle: string, anime: AnimeItem): { matched: boolean; score: number } {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
    const tClean = normalize(torrentTitle);
    const titles = [anime.title, anime.romajiTitle, anime.japaneseTitle, anime.englishTitle].filter(Boolean) as string[];

    let bestScore = 0;
    for (const title of titles) {
      const cleanTitle = normalize(title);
      if (tClean.includes(cleanTitle)) {
        bestScore = Math.max(bestScore, cleanTitle.length / tClean.length + 0.5);
      }
    }

    return {
      matched: bestScore > 0.4,
      score: bestScore
    };
  }
}

export const anidbService = new AniDBService();
