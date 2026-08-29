import { AnimeItem, Episode, AnimeRelation } from '../types/anime';
import { db } from './db';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days TTL per spec

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export interface AnimeSearchFilters {
  type?: string;
  status?: string;
  season?: string;
  year?: string;
  genre?: string;
  minScore?: number;
  sortBy?: 'TRENDING_DESC' | 'POPULARITY_DESC' | 'SCORE_DESC' | 'START_DATE_DESC' | 'FAVOURITES_DESC' | 'EPISODES_DESC' | 'TITLE_ROMAJI';
}

export function normalizeTitle(title: string): string {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function deduplicateAnime(items: AnimeItem[]): AnimeItem[] {
  const seenIds = new Set<string>();
  const seenMalIds = new Set<number>();
  const seenTitles = new Set<string>();
  const result: AnimeItem[] = [];

  for (const item of items) {
    if (!item) continue;
    const canonicalId = (item.id || '').toLowerCase();
    const normTitle = normalizeTitle(item.title);
    const normRomaji = normalizeTitle(item.romajiTitle);

    if (seenIds.has(canonicalId)) continue;
    if (item.anidbId && item.anidbId > 0 && seenMalIds.has(item.anidbId)) continue;
    if (normTitle && seenTitles.has(normTitle)) continue;

    seenIds.add(canonicalId);
    if (item.anidbId && item.anidbId > 0) seenMalIds.add(item.anidbId);
    if (normTitle) seenTitles.add(normTitle);
    if (normRomaji) seenTitles.add(normRomaji);
    result.push(item);
  }
  return result;
}

class AniListMetadataService {
  private lastRequestTime = 0;
  private minIntervalMs = 700; // Rate-limit queue for AniList GraphQL

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
    filterOptions?: AnimeSearchFilters,
    page = 1,
    perPage = 30
  ): Promise<{ items: AnimeItem[]; hasNextPage: boolean }> {
    // 1. If online, query live GraphQL API for deep search across AniList's 20,000+ catalog
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const liveResult = await this.fetchLiveGraphQL(query, filterOptions, page, perPage);
        if (liveResult.items.length > 0) {
          await db.saveBulkAnime(liveResult.items);
          return {
            items: deduplicateAnime(liveResult.items),
            hasNextPage: liveResult.hasNextPage
          };
        }
      } catch (e) {
        console.warn('Live metadata query failed, falling back to local cache:', e);
      }
    }

    // 2. Local database cache fallback
    const cachedAll = await db.getAllCachedAnime();
    let localItems = cachedAll;

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
      const { type, status, season, year, genre, minScore } = filterOptions;
      if (type && type !== 'All') localItems = localItems.filter(a => a.type === type);
      if (status && status !== 'All') localItems = localItems.filter(a => a.status === status);
      if (season && season !== 'All') localItems = localItems.filter(a => a.season.toLowerCase().includes(season.toLowerCase()));
      if (year && year !== 'All') {
        if (year === '2010s') localItems = localItems.filter(a => a.year >= 2010 && a.year <= 2019);
        else if (year === '2000s') localItems = localItems.filter(a => a.year >= 2000 && a.year <= 2009);
        else if (year === '1990s') localItems = localItems.filter(a => a.year >= 1990 && a.year <= 1999);
        else localItems = localItems.filter(a => a.year.toString() === year);
      }
      if (genre && genre !== 'All') localItems = localItems.filter(a => a.genres.includes(genre));
      if (minScore && minScore > 0) localItems = localItems.filter(a => a.rating >= minScore);
    }

    const deduped = deduplicateAnime(localItems);
    return {
      items: deduped,
      hasNextPage: false
    };
  }

  /**
   * Fetch Trending Anime for Discover View
   */
  public async getTrendingAnime(perPage = 12): Promise<AnimeItem[]> {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
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
                startDate { year month day }
                endDate { year month day }
                averageScore
                popularity
                genres
                studios(isMain: true) { nodes { name } }
                nextAiringEpisode {
                  airingAt
                  timeUntilAiring
                  episode
                }
                streamingEpisodes {
                  title
                  thumbnail
                  url
                  site
                }
                relations {
                  edges {
                    relationType
                    node {
                      id
                      title { romaji english native }
                      format
                      coverImage { large extraLarge }
                    }
                  }
                }
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
          const deduped = deduplicateAnime(live);
          await db.saveBulkAnime(deduped);
          return deduped;
        }
      } catch (e) {
        console.warn('Trending fetch fallback:', e);
      }
    }

    const cached = await db.getAllCachedAnime();
    return deduplicateAnime(cached.filter(a => a.isTrending || a.isHotBanner));
  }

  /**
   * Fetch anime details by ID with TTL check (7 days eviction) and live API fetch fallback
   */
  public async getAnimeById(id: string): Promise<AnimeItem | null> {
    const record = await db.getAnimeCacheRecord(id);
    if (record) {
      const now = Date.now();
      if (now - record.cachedAt > CACHE_TTL_MS) {
        await db.deleteAnime(id);
      } else {
        return record.data;
      }
    }

    // Try fetching from live GraphQL by ID
    const rawId = parseInt(id.replace(/^a/, ''));
    if (!isNaN(rawId) && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await this.rateLimitDelay();
        const gqlQuery = `
          query ($id: Int) {
            Media(id: $id, type: ANIME) {
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
              startDate { year month day }
              endDate { year month day }
              averageScore
              popularity
              genres
              studios(isMain: true) { nodes { name } }
              nextAiringEpisode {
                airingAt
                timeUntilAiring
                episode
              }
              streamingEpisodes {
                title
                thumbnail
                url
                site
              }
              relations {
                edges {
                  relationType
                  node {
                    id
                    title { romaji english native }
                    format
                    coverImage { large extraLarge }
                  }
                }
              }
            }
          }
        `;
        const res = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: gqlQuery, variables: { id: rawId } })
        });
        const json = await res.json();
        if (json?.data?.Media) {
          const item = this.mapMediaToAnimeItem(json.data.Media);
          await db.saveAnime(item);
          return item;
        }
      } catch (e) {
        console.warn(`Failed to fetch live anime details for ${id}:`, e);
      }
    }

    return null;
  }

  /**
   * Fetch Schedule / Airing Timetable
   */
  public async getScheduleAnime(day?: string): Promise<AnimeItem[]> {
    const cached = await db.getAllCachedAnime();
    if (cached.length > 0) {
      if (day) {
        return cached.filter(a => a.broadcastDay === day);
      }
      return cached;
    }

    // If cache is empty, fetch trending to seed
    return await this.getTrendingAnime(20);
  }

  private async fetchLiveGraphQL(
    search?: string,
    filters?: AnimeSearchFilters,
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
    if (filters?.year && filters.year !== 'All') {
      const yrNum = parseInt(filters.year);
      if (!isNaN(yrNum) && yrNum >= 1960) {
        filterVariables.seasonYear = yrNum;
      }
    }
    if (filters?.genre && filters.genre !== 'All') filterVariables.genre = filters.genre;
    if (filters?.minScore && filters.minScore > 0) filterVariables.averageScore_greater = Math.round(filters.minScore * 10);

    const sortMap: Record<string, string> = {
      'TRENDING_DESC': 'TRENDING_DESC',
      'POPULARITY_DESC': 'POPULARITY_DESC',
      'SCORE_DESC': 'SCORE_DESC',
      'START_DATE_DESC': 'START_DATE_DESC',
      'FAVOURITES_DESC': 'FAVOURITES_DESC',
      'EPISODES_DESC': 'EPISODES_DESC',
      'TITLE_ROMAJI': 'TITLE_ROMAJI'
    };
    filterVariables.sort = [filters?.sortBy && sortMap[filters.sortBy] ? sortMap[filters.sortBy] : 'POPULARITY_DESC'];

    const gqlQuery = `
      query ($page: Int, $perPage: Int, $search: String, $format: MediaFormat, $status: MediaStatus, $season: MediaSeason, $seasonYear: Int, $genre: String, $averageScore_greater: Int, $sort: [MediaSort]) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { hasNextPage }
          media(search: $search, format: $format, status: $status, season: $season, seasonYear: $seasonYear, genre: $genre, averageScore_greater: $averageScore_greater, type: ANIME, sort: $sort) {
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
            startDate { year month day }
            endDate { year month day }
            averageScore
            popularity
            genres
            studios(isMain: true) { nodes { name } }
            nextAiringEpisode {
              airingAt
              timeUntilAiring
              episode
            }
            streamingEpisodes {
              title
              thumbnail
              url
              site
            }
            relations {
              edges {
                relationType
                node {
                  id
                  title { romaji english native }
                  format
                  coverImage { large extraLarge }
                }
              }
            }
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
    const isMovie = m.format === 'MOVIE';
    const isMusic = m.format === 'MUSIC';
    const isOVA = m.format === 'OVA' || m.format === 'SPECIAL';
    
    // Accurate season calculation
    let seasonName = m.season ? (m.season.charAt(0) + m.season.slice(1).toLowerCase()) : '';
    if (!seasonName && m.startDate?.month) {
      const mo = m.startDate.month;
      if (mo >= 1 && mo <= 3) seasonName = 'Winter';
      else if (mo >= 4 && mo <= 6) seasonName = 'Spring';
      else if (mo >= 7 && mo <= 9) seasonName = 'Summer';
      else seasonName = 'Fall';
    }
    const year = m.seasonYear || m.startDate?.year || 2025;
    const season = seasonName ? `${seasonName} ${year}` : `${year}`;

    // Accurate release date start
    let airDateStart = `${year}-01-01`;
    if (m.startDate?.year) {
      const y = m.startDate.year;
      const mo = (m.startDate.month || 1).toString().padStart(2, '0');
      const d = (m.startDate.day || 1).toString().padStart(2, '0');
      airDateStart = `${y}-${mo}-${d}`;
    }

    // Accurate episodes calculation & streaming metadata
    const streamingEps: any[] = m.streamingEpisodes || [];
    let totalEps = 12;
    if (isMovie || isMusic) {
      totalEps = 1;
    } else if (m.episodes && m.episodes > 1) {
      totalEps = m.episodes;
    } else if (m.status === 'RELEASING' && m.nextAiringEpisode?.episode) {
      totalEps = Math.max(m.episodes || 12, m.nextAiringEpisode.episode);
    } else if (streamingEps.length > 1) {
      totalEps = streamingEps.length;
    } else if (m.episodes === 1 && (m.format === 'TV' || m.format === 'TV_SHORT')) {
      // Preliminary TV placeholder
      totalEps = 12;
    } else if (m.episodes === 1) {
      totalEps = 1;
    } else if (m.nextAiringEpisode?.episode) {
      totalEps = Math.max(12, m.nextAiringEpisode.episode);
    } else if (isOVA) {
      totalEps = m.episodes || (streamingEps.length > 0 ? streamingEps.length : 1);
    } else {
      totalEps = 12;
    }

    const episodesCount = isMovie ? 1 : totalEps;

    const episodes: Episode[] = Array.from({ length: totalEps }, (_, i) => {
      const epNum = i + 1;
      const streamInfo = streamingEps.find((s: any) => {
        const match = s.title?.match(/Episode\s+(\d+)/i) || s.title?.match(/(\d+)/);
        return match ? parseInt(match[1]) === epNum : false;
      }) || streamingEps[i];

      const epTitle = streamInfo?.title || (isMovie ? 'Full Movie' : `Episode ${epNum.toString().padStart(2, '0')}`);

      let epAirDate = airDateStart;
      if (m.startDate?.year && m.startDate?.month && m.startDate?.day) {
        const startD = new Date(m.startDate.year, m.startDate.month - 1, m.startDate.day);
        startD.setDate(startD.getDate() + (i * 7));
        epAirDate = `${startD.getFullYear()}-${(startD.getMonth() + 1).toString().padStart(2, '0')}-${startD.getDate().toString().padStart(2, '0')}`;
      }

      return {
        id: epNum,
        epNumber: epNum,
        title: epTitle,
        airDate: epAirDate,
        durationMinutes: isMovie ? 110 : isOVA ? 45 : 24,
        opSkipStart: undefined,
        opSkipEnd: undefined,
        edSkipStart: undefined,
        edSkipEnd: undefined
      };
    });

    const cleanSynopsis = (m.description || 'No synopsis available.').replace(/<[^>]*>?/gm, '');

    type BroadcastDay = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
    const dayMap: Record<number, BroadcastDay> = {
      0: 'Sunday',
      1: 'Monday',
      2: 'Tuesday',
      3: 'Wednesday',
      4: 'Thursday',
      5: 'Friday',
      6: 'Saturday'
    };

    let broadcastDay: BroadcastDay = 'Saturday';
    if (m.nextAiringEpisode?.airingAt) {
      const date = new Date(m.nextAiringEpisode.airingAt * 1000);
      broadcastDay = dayMap[date.getUTCDay()] || 'Saturday';
    } else if (m.startDate?.year && m.startDate?.month && m.startDate?.day) {
      const date = new Date(m.startDate.year, m.startDate.month - 1, m.startDate.day);
      broadcastDay = dayMap[date.getDay()] || 'Saturday';
    }

    // Relations mapping
    const relations: AnimeRelation[] = (m.relations?.edges || []).map((edge: any, idx: number) => {
      const node = edge.node;
      const relType = edge.relationType === 'PREQUEL' ? 'Prequel'
        : edge.relationType === 'SEQUEL' ? 'Sequel'
        : edge.relationType === 'SIDE_STORY' ? 'Side Story'
        : edge.relationType === 'SPIN_OFF' ? 'Spin-off'
        : edge.relationType === 'ALTERNATIVE' ? 'Alternative'
        : 'Sequel';
      return {
        id: idx + 1,
        title: node.title?.english || node.title?.romaji || 'Related Title',
        type: relType,
        relationAnimeId: `a${node.id}`,
        poster: node.coverImage?.large || node.coverImage?.extraLarge || ''
      };
    });

    const studioName = m.studios?.nodes?.[0]?.name || 'Animation Studio';

    return {
      id: `a${m.id}`,           // Always use AniList ID as the canonical key
      anidbId: m.idMal || m.id, // MAL ID for external tracking; falls back to AniList ID
      title: m.title.english || m.title.romaji,
      romajiTitle: m.title.romaji || m.title.english,
      japaneseTitle: m.title.native || m.title.romaji,
      englishTitle: m.title.english,
      type: isMovie ? 'Movie' : m.format === 'OVA' ? 'OVA' : m.format === 'ONA' ? 'ONA' : 'TV',
      status: m.status === 'RELEASING' ? 'Airing' : m.status === 'NOT_YET_RELEASED' ? 'Upcoming' : 'Finished',
      episodesCount,
      season,
      year,
      rating: m.averageScore ? m.averageScore / 10 : 8.2,
      votesCount: m.popularity || 8500,
      poster: m.coverImage?.extraLarge || m.coverImage?.large || '',
      banner: m.bannerImage || m.coverImage?.extraLarge || '',
      bannerSubtitle: `${studioName} • ${season}`,
      genres: m.genres || ['Action', 'Drama'],
      tags: m.genres || ['Anime'],
      studio: studioName,
      airDateStart,
      broadcastDay,
      broadcastTime: '23:30 JST',
      isTrending: true,
      synopsis: cleanSynopsis,
      episodes,
      relations
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

export const anilistMetaService = new AniListMetadataService();
export const anidbService = anilistMetaService;
