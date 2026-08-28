export type AnimeType = 'TV' | 'Movie' | 'OVA' | 'ONA' | 'Special';
export type AnimeFormat = 'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | 'MUSIC';
export type AnimeStatus = 'Airing' | 'Finished' | 'Upcoming' | 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';
export type WatchStatus = 'Watching' | 'Plan to Watch' | 'Completed' | 'On Hold' | 'Dropped';

export interface Episode {
  id: number;
  epNumber: number;
  title: string;
  titleJp?: string;
  airDate: string;
  durationMinutes: number;
  synopsis?: string;
  thumbnail?: string;
  opSkipStart?: number; // seconds
  opSkipEnd?: number;
  edSkipStart?: number;
  edSkipEnd?: number;
}

export interface AnimeRelation {
  id: number;
  title: string;
  type: 'Prequel' | 'Sequel' | 'Side Story' | 'Spin-off' | 'Alternative' | 'Movie';
  relationAnimeId: string;
  poster: string;
}

export interface AnimeItem {
  id: string; // AniDB ID (e.g. "a17154")
  anidbId: number;
  title: string;
  romajiTitle: string;
  japaneseTitle: string;
  englishTitle?: string;
  type: AnimeType;
  status: AnimeStatus;
  episodesCount: number;
  season: string; // e.g. "Spring 2026", "Fall 2024"
  year: number;
  rating: number; // 0.0 - 10.0 (AniDB rating)
  votesCount: number;
  poster: string;
  banner: string;
  synopsis: string;
  genres: string[];
  tags: string[];
  studio: string;
  airDateStart: string;
  airDateEnd?: string;
  broadcastDay?: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  broadcastTime?: string;
  isTrending?: boolean;
  isHotBanner?: boolean;
  bannerSubtitle?: string;
  episodes: Episode[];
  relations: AnimeRelation[];
}

export interface TorrentSource {
  id: string;
  title: string;
  group: string; // e.g. "SubsPlease", "Kamigami", "Erai-raws", "SweetSub"
  resolution: '1080p' | '720p' | '4K HDR' | '4K' | '2160p';
  codec: 'HEVC / H.265' | 'AVC / H.264' | 'AV1';
  audio: 'FLAC 2.0' | 'AAC 2.0' | 'Opus 5.1';
  fileSize: string;
  seeders: number;
  leechers: number;
  uploadedDate: string;
  magnetLink: string;
  torrentUrl?: string;
  infoHash?: string;
  provider: 'Nyaa' | 'Mikan Project' | 'Anime Garden' | 'Tokyo Toshokan' | 'SubsPlease' | 'Erai-raws' | 'ACG.RIP';
  episodeNum?: number;
  isCached?: boolean;
}

export interface LibraryEntry {
  animeId: string;
  watchStatus: WatchStatus;
  currentEpisode: number;
  totalEpisodes: number;
  score: number; // 0 - 10
  lastWatchedAt: string;
  updatedAt: string;
  notes?: string;
}

export interface MatugenPalette {
  id: string;
  name: string;
  description: string;
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  secondaryContainer: string;
  surface: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  accentGlow: string;
}

export interface AnimeMedia {
  id: string;
  idMal?: number;
  title: {
    romaji: string;
    english: string;
    native: string;
    userPreferred: string;
  };
  coverImage: {
    extraLarge: string;
    large: string;
    medium: string;
    color?: string;
  };
  bannerImage?: string;
  description: string;
  status: AnimeStatus;
  episodes?: number;
  duration?: number;
  genres: string[];
  averageScore?: number;
  popularity?: number;
  nextAiringEpisode?: {
    airingTime: number;
    timeUntilAiring: number;
    episode: number;
  };
}

export interface AnimeEpisode {
  id: string;
  number: number;
  title?: string;
  description?: string;
  image?: string;
  isFiller?: boolean;
}

export interface SubtitleTrack {
  url: string;
  lang: string;
  label: string;
  isDefault?: boolean;
}

export interface VideoSource {
  url: string;
  isM3U8: boolean;
  quality: string;
}

export interface StreamData {
  headers?: Record<string, string>;
  sources: VideoSource[];
  subtitles: SubtitleTrack[];
  download?: string;
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
}

export interface WatchProgress {
  mediaId: string;
  episodeId: string;
  episodeNumber: number;
  progressSeconds: number;
  durationSeconds: number;
  lastUpdated: number;
  completed: boolean;
}
