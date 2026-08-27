import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  AnimeItem,
  Episode,
  DanmakuComment,
  TorrentSource,
  DownloadTask,
  LibraryEntry,
  MatugenPalette,
  WatchStatus
} from '../types/anime';
import { MATUGEN_PALETTES, applyMatugenTheme } from '../theme/matugen';
import { MOCK_ANIME_DATABASE } from '../data/mockAniDB';
import { MOCK_DANMAKU_COMMENTS, SAMPLE_VIDEOS } from '../data/mockDanmaku';

export type ActiveView = 'discover' | 'browse' | 'library' | 'cache' | 'settings';

interface ActivePlayerState {
  isOpen: boolean;
  anime: AnimeItem;
  episode: Episode;
  videoUrl: string;
  sourceTitle?: string;
}

interface AppContextType {
  currentView: ActiveView;
  setCurrentView: (view: ActiveView) => void;
  selectedAnime: AnimeItem | null;
  setSelectedAnime: (anime: AnimeItem | null) => void;
  isScheduleOpen: boolean;
  setIsScheduleOpen: (open: boolean) => void;
  
  // Playback & Danmaku
  playerState: ActivePlayerState | null;
  openPlayer: (anime: AnimeItem, episode?: Episode, videoUrl?: string, sourceTitle?: string) => void;
  closePlayer: () => void;
  danmakuEnabled: boolean;
  setDanmakuEnabled: (enabled: boolean) => void;
  danmakuOpacity: number;
  setDanmakuOpacity: (opacity: number) => void;
  danmakuFontSize: number;
  setDanmakuFontSize: (size: number) => void;
  danmakuSpeedMultiplier: number;
  setDanmakuSpeedMultiplier: (mult: number) => void;
  danmakuComments: DanmakuComment[];
  addDanmakuComment: (text: string, color?: string, mode?: 'scroll' | 'top' | 'bottom') => void;

  // Theming
  activePalette: MatugenPalette;
  setActivePalette: (palette: MatugenPalette) => void;
  blurEnabled: boolean;
  setBlurEnabled: (enabled: boolean) => void;

  // Library & Tracking
  library: Record<string, LibraryEntry>;
  setAnimeStatus: (animeId: string, status: WatchStatus) => void;
  setAnimeProgress: (animeId: string, episodeNum: number) => void;
  getLibraryEntry: (animeId: string) => LibraryEntry | undefined;

  // Downloads & BitTorrent Cache
  downloadTasks: DownloadTask[];
  addDownloadTask: (anime: AnimeItem, episode: Episode, source: TorrentSource) => void;
  toggleDownloadPause: (id: string) => void;
  deleteDownloadTask: (id: string) => void;

  // Quick Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const INITIAL_LIBRARY: Record<string, LibraryEntry> = {
  'a18012': { // Girls Band Cry
    animeId: 'a18012',
    watchStatus: 'Watching',
    currentEpisode: 4,
    totalEpisodes: 13,
    score: 9.5,
    lastWatchedAt: '2026-08-26T20:15:00Z',
    updatedAt: '2026-08-26T20:15:00Z'
  },
  'a17531': { // Apothecary Diaries S2
    animeId: 'a17531',
    watchStatus: 'Watching',
    currentEpisode: 13,
    totalEpisodes: 24,
    score: 9.0,
    lastWatchedAt: '2026-08-25T21:40:00Z',
    updatedAt: '2026-08-25T21:40:00Z'
  },
  'a17950': { // Wind Breaker S2
    animeId: 'a17950',
    watchStatus: 'Watching',
    currentEpisode: 2,
    totalEpisodes: 12,
    score: 8.5,
    lastWatchedAt: '2026-08-24T18:30:00Z',
    updatedAt: '2026-08-24T18:30:00Z'
  },
  'a07735': { // Gosick
    animeId: 'a07735',
    watchStatus: 'Watching',
    currentEpisode: 18,
    totalEpisodes: 24,
    score: 8.8,
    lastWatchedAt: '2026-08-20T22:10:00Z',
    updatedAt: '2026-08-20T22:10:00Z'
  }
};

const INITIAL_DOWNLOADS: DownloadTask[] = [
  {
    id: 'dl-gbc-01',
    animeId: 'a18012',
    animeTitle: 'Girls Band Cry',
    episodeNum: 1,
    sourceTitle: '[SubsPlease] Girls Band Cry - 01 (1080p) [HEVC 10-bit FLAC]',
    group: 'SubsPlease',
    resolution: '1080p HEVC',
    fileSize: '1.42 GB',
    totalBytes: 1420000000,
    downloadedBytes: 1420000000,
    downloadSpeed: 0,
    uploadSpeed: 145,
    progress: 100,
    status: 'seeding',
    peers: 48,
    etaSeconds: 0,
    addedAt: '2026-08-26 19:30',
    videoUrl: SAMPLE_VIDEOS.default
  },
  {
    id: 'dl-gbc-02',
    animeId: 'a18012',
    animeTitle: 'Girls Band Cry',
    episodeNum: 2,
    sourceTitle: '[SubsPlease] Girls Band Cry - 02 (1080p) [HEVC 10-bit FLAC]',
    group: 'SubsPlease',
    resolution: '1080p HEVC',
    fileSize: '1.38 GB',
    totalBytes: 1380000000,
    downloadedBytes: 980000000,
    downloadSpeed: 14250, // 14.2 MB/s
    uploadSpeed: 820,
    progress: 71,
    status: 'downloading',
    peers: 64,
    etaSeconds: 28,
    addedAt: '2026-08-26 21:10',
    videoUrl: SAMPLE_VIDEOS.animeTeaser
  },
  {
    id: 'dl-kusu-01',
    animeId: 'a17531',
    animeTitle: 'The Apothecary Diaries Season 2',
    episodeNum: 1,
    sourceTitle: '[SweetSub] Kusuriya no Hitorigoto S2 [01] [1080p HEVC FLAC]',
    group: 'SweetSub',
    resolution: '1080p HEVC',
    fileSize: '1.20 GB',
    totalBytes: 1200000000,
    downloadedBytes: 1200000000,
    downloadSpeed: 0,
    uploadSpeed: 95,
    progress: 100,
    status: 'completed',
    peers: 32,
    etaSeconds: 0,
    addedAt: '2026-08-25 14:20',
    videoUrl: SAMPLE_VIDEOS.musicVideo
  }
];

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<ActiveView>('discover');
  const [selectedAnime, setSelectedAnime] = useState<AnimeItem | null>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState<boolean>(false);
  const [playerState, setPlayerState] = useState<ActivePlayerState | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Theme state
  const [activePalette, setActivePaletteState] = useState<MatugenPalette>(() => {
    const saved = localStorage.getItem('yozora_palette');
    if (saved) {
      const found = MATUGEN_PALETTES.find(p => p.id === saved);
      if (found) return found;
    }
    return MATUGEN_PALETTES[0]; // Twilight Sakura default
  });
  const [blurEnabled, setBlurEnabled] = useState<boolean>(true);

  // Danmaku state
  const [danmakuEnabled, setDanmakuEnabled] = useState<boolean>(true);
  const [danmakuOpacity, setDanmakuOpacity] = useState<number>(0.85);
  const [danmakuFontSize, setDanmakuFontSize] = useState<number>(24);
  const [danmakuSpeedMultiplier, setDanmakuSpeedMultiplier] = useState<number>(1.0);
  const [danmakuComments, setDanmakuComments] = useState<DanmakuComment[]>(MOCK_DANMAKU_COMMENTS);

  // Library & Cache state
  const [library, setLibrary] = useState<Record<string, LibraryEntry>>(() => {
    const saved = localStorage.getItem('yozora_library');
    return saved ? JSON.parse(saved) : INITIAL_LIBRARY;
  });

  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>(() => {
    const saved = localStorage.getItem('yozora_downloads');
    return saved ? JSON.parse(saved) : INITIAL_DOWNLOADS;
  });

  // Apply active palette on load/change
  useEffect(() => {
    applyMatugenTheme(activePalette);
    localStorage.setItem('yozora_palette', activePalette.id);
  }, [activePalette]);

  // Persist library
  useEffect(() => {
    localStorage.setItem('yozora_library', JSON.stringify(library));
  }, [library]);

  // Persist downloads
  useEffect(() => {
    localStorage.setItem('yozora_downloads', JSON.stringify(downloadTasks));
  }, [downloadTasks]);

  // Dynamic simulation for downloading tasks
  useEffect(() => {
    const interval = setInterval(() => {
      setDownloadTasks(prevTasks =>
        prevTasks.map(task => {
          if (task.status === 'downloading') {
            const addedBytes = Math.floor(task.downloadSpeed * 1024 * (0.8 + Math.random() * 0.4));
            const newDownloaded = Math.min(task.totalBytes, task.downloadedBytes + addedBytes);
            const newProgress = Math.floor((newDownloaded / task.totalBytes) * 100);
            const isFinished = newDownloaded >= task.totalBytes;
            const remainingBytes = task.totalBytes - newDownloaded;
            const newEta = isFinished ? 0 : Math.max(1, Math.round(remainingBytes / (task.downloadSpeed * 1024)));

            return {
              ...task,
              downloadedBytes: newDownloaded,
              progress: newProgress,
              etaSeconds: newEta,
              status: isFinished ? 'seeding' : 'downloading',
              downloadSpeed: isFinished ? 0 : Math.round(12000 + Math.random() * 6000),
              uploadSpeed: Math.round(300 + Math.random() * 500)
            };
          } else if (task.status === 'seeding') {
            return {
              ...task,
              uploadSpeed: Math.round(120 + Math.random() * 180)
            };
          }
          return task;
        })
      );
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  const setActivePalette = (palette: MatugenPalette) => {
    setActivePaletteState(palette);
  };

  const openPlayer = (anime: AnimeItem, episode?: Episode, videoUrl?: string, sourceTitle?: string) => {
    const ep = episode || (anime.episodes.length > 0 ? anime.episodes[0] : {
      id: 1,
      epNumber: 1,
      title: 'Episode 01',
      airDate: '2026-01-01',
      durationMinutes: 24
    });
    
    // Default video sample
    const chosenVideo = videoUrl || SAMPLE_VIDEOS.default;
    
    setPlayerState({
      isOpen: true,
      anime,
      episode: ep,
      videoUrl: chosenVideo,
      sourceTitle: sourceTitle || `[SubsPlease] ${anime.title} - ${ep.epNumber.toString().padStart(2, '0')} (1080p)`
    });

    // Update library watching progress
    setAnimeProgress(anime.id, ep.epNumber);
  };

  const closePlayer = () => {
    setPlayerState(null);
  };

  const addDanmakuComment = (text: string, color = '#ffffff', mode: 'scroll' | 'top' | 'bottom' = 'scroll') => {
    const newComment: DanmakuComment = {
      id: `user-dm-${Date.now()}`,
      time: 0, // In player it will bind to current playhead
      text,
      color,
      mode,
      size: 'normal',
      user: 'You'
    };
    setDanmakuComments(prev => [...prev, newComment]);
  };

  const setAnimeStatus = (animeId: string, status: WatchStatus) => {
    const anime = MOCK_ANIME_DATABASE.find(a => a.id === animeId);
    setLibrary(prev => {
      const existing = prev[animeId] || {
        animeId,
        watchStatus: status,
        currentEpisode: 1,
        totalEpisodes: anime ? anime.episodesCount : 12,
        score: 8.0,
        lastWatchedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      return {
        ...prev,
        [animeId]: {
          ...existing,
          watchStatus: status,
          updatedAt: new Date().toISOString()
        }
      };
    });
  };

  const setAnimeProgress = (animeId: string, episodeNum: number) => {
    const anime = MOCK_ANIME_DATABASE.find(a => a.id === animeId);
    setLibrary(prev => {
      const existing = prev[animeId] || {
        animeId,
        watchStatus: 'Watching',
        currentEpisode: episodeNum,
        totalEpisodes: anime ? anime.episodesCount : 12,
        score: 8.0,
        lastWatchedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const isCompleted = anime && episodeNum >= anime.episodesCount;

      return {
        ...prev,
        [animeId]: {
          ...existing,
          watchStatus: isCompleted ? 'Completed' : 'Watching',
          currentEpisode: episodeNum,
          lastWatchedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };
    });
  };

  const getLibraryEntry = (animeId: string) => {
    return library[animeId];
  };

  const addDownloadTask = (anime: AnimeItem, episode: Episode, source: TorrentSource) => {
    const newTask: DownloadTask = {
      id: `dl-${Date.now()}`,
      animeId: anime.id,
      animeTitle: anime.title,
      episodeNum: episode.epNumber,
      sourceTitle: source.title,
      group: source.group,
      resolution: source.resolution,
      fileSize: source.fileSize,
      totalBytes: 1350000000,
      downloadedBytes: 50000000,
      downloadSpeed: 11500,
      uploadSpeed: 210,
      progress: 4,
      status: 'downloading',
      peers: source.seeders,
      etaSeconds: 110,
      addedAt: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      videoUrl: SAMPLE_VIDEOS.highQualityStream
    };

    setDownloadTasks(prev => [newTask, ...prev]);
  };

  const toggleDownloadPause = (id: string) => {
    setDownloadTasks(prev =>
      prev.map(task => {
        if (task.id === id) {
          const nextStatus = task.status === 'downloading' ? 'paused' : 'downloading';
          return {
            ...task,
            status: nextStatus,
            downloadSpeed: nextStatus === 'paused' ? 0 : 9500
          };
        }
        return task;
      })
    );
  };

  const deleteDownloadTask = (id: string) => {
    setDownloadTasks(prev => prev.filter(task => task.id !== id));
  };

  return (
    <AppContext.Provider
      value={{
        currentView,
        setCurrentView,
        selectedAnime,
        setSelectedAnime,
        isScheduleOpen,
        setIsScheduleOpen,
        playerState,
        openPlayer,
        closePlayer,
        danmakuEnabled,
        setDanmakuEnabled,
        danmakuOpacity,
        setDanmakuOpacity,
        danmakuFontSize,
        setDanmakuFontSize,
        danmakuSpeedMultiplier,
        setDanmakuSpeedMultiplier,
        danmakuComments,
        addDanmakuComment,
        activePalette,
        setActivePalette,
        blurEnabled,
        setBlurEnabled,
        library,
        setAnimeStatus,
        setAnimeProgress,
        getLibraryEntry,
        downloadTasks,
        addDownloadTask,
        toggleDownloadPause,
        deleteDownloadTask,
        searchQuery,
        setSearchQuery
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
