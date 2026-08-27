import { AnimeItem, Episode, AnimeRelation } from '../types/anime';
import { db } from './db';
import { MOCK_ANIME_DATABASE } from '../data/mockAniDB';

interface AniDBCredentials {
  clientName: string;
  clientVersion: string;
}

class AniDBService {
  private lastRequestTime = 0;
  private minIntervalMs = 1500; // AniDB flood-control backoff
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

  // Rate-limiting wrapper
  private async rateLimitDelay(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise(resolve => setTimeout(resolve, this.minIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Search anime across cached database and live GraphQL / REST endpoints
   */
  public async searchAnime(query: string, filterOptions?: {
    type?: string;
    status?: string;
    season?: string;
    year?: string;
    genre?: string;
  }): Promise<AnimeItem[]> {
    // 1. Check local IndexedDB cache first
    const cachedAll = await db.getAllCachedAnime();
    let results = cachedAll.length > 0 ? cachedAll : MOCK_ANIME_DATABASE;

    if (query.trim()) {
      const q = query.toLowerCase().trim();
      results = results.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.romajiTitle.toLowerCase().includes(q) ||
        a.japaneseTitle.toLowerCase().includes(q) ||
        (a.englishTitle && a.englishTitle.toLowerCase().includes(q)) ||
        a.studio.toLowerCase().includes(q) ||
        a.anidbId.toString() === q
      );

      // If fewer than 2 matches and online, attempt live AniList GraphQL lookup
      if (results.length < 2 && navigator.onLine) {
        try {
          const liveAnime = await this.fetchLiveAniListSearch(query);
          if (liveAnime.length > 0) {
            await db.saveBulkAnime(liveAnime);
            // merge with existing results without duplicates
            const idMap = new Set(results.map(r => r.id));
            for (const item of liveAnime) {
              if (!idMap.has(item.id)) {
                results.push(item);
              }
            }
          }
        } catch (e) {
          console.warn('Live API search fallback used cached records:', e);
        }
      }
    }

    // Apply filters
    if (filterOptions) {
      const { type, status, season, year, genre } = filterOptions;
      if (type && type !== 'All') results = results.filter(a => a.type === type);
      if (status && status !== 'All') results = results.filter(a => a.status === status);
      if (season && season !== 'All') results = results.filter(a => a.season.includes(season));
      if (year && year !== 'All') results = results.filter(a => a.year.toString() === year);
      if (genre && genre !== 'All') results = results.filter(a => a.genres.includes(genre));
    }

    return results;
  }

  /**
   * Fetch anime details by ID with aggressive caching
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

  /**
   * Live AniList GraphQL Search with conversion to AniDB format
   */
  private async fetchLiveAniListSearch(search: string): Promise<AnimeItem[]> {
    await this.rateLimitDelay();

    const gqlQuery = `
      query ($search: String) {
        Page(page: 1, perPage: 6) {
          media(search: $search, type: ANIME) {
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
      body: JSON.stringify({ query: gqlQuery, variables: { search } })
    });

    const data = await res.json();
    const mediaList = data?.data?.Page?.media || [];

    return mediaList.map((m: any): AnimeItem => {
      const epCount = m.episodes || 12;
      const episodes: Episode[] = Array.from({ length: epCount }, (_, i) => ({
        id: i + 1,
        epNumber: i + 1,
        title: `Episode ${i + 1}`,
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
        rating: m.averageScore ? m.averageScore / 10 : 8.0,
        votesCount: 5000,
        poster: m.coverImage?.extraLarge || m.coverImage?.large || '',
        banner: m.bannerImage || m.coverImage?.extraLarge || '',
        bannerSubtitle: `${m.studios?.nodes?.[0]?.name || 'Studio'} • ${m.seasonYear || 2025}`,
        genres: m.genres || ['Action', 'Drama'],
        tags: m.genres || ['Anime'],
        studio: m.studios?.nodes?.[0]?.name || 'Animation Studio',
        airDateStart: `${m.seasonYear || 2025}-01-01`,
        broadcastDay: 'Saturday',
        broadcastTime: '23:30 JST',
        synopsis: cleanSynopsis,
        episodes,
        relations: []
      };
    });
  }

  /**
   * Fuzzy title matching: maps noisy torrent filenames to canonical AniDB titles
   */
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
