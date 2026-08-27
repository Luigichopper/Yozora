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
import { db } from '../services/db';
import { anidbService } from '../services/anidbService';
import { sourceService } from '../services/sourceService';
import { danmakuService } from '../services/danmakuService';
import { streamService } from '../services/streamService';
import { rqbitService } from '../services/rqbitService';
import { torrentEngine } from '../services/torrentEngine';
import { SAMPLE_VIDEOS } from '../data/mockDanmaku';

export type ActiveView = 'discover' | 'browse' | 'library' | 'cache' | 'settings';

interface ActivePlayerState {
  isOpen: boolean;
  anime: AnimeItem;
  episode: Episode;
  videoUrl: string;
  sourceTitle?: string;
}

export interface ToastMessage {
  id: string;
  text: string;
  type: 'info' | 'success' | 'warning' | 'error';
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
  addDanmakuComment: (text: string, color?: string, mode?: 'scroll' | 'top' | 'bottom', exactTime?: number) => Promise<void>;

  // Theming
  activePalette: MatugenPalette;
  setActivePalette: (palette: MatugenPalette) => void;
  blurEnabled: boolean;
  setBlurEnabled: (enabled: boolean) => void;

  // Library & Tracking
  library: Record<string, LibraryEntry>;
  setAnimeStatus: (animeId: string, status: WatchStatus) => Promise<void>;
  setAnimeProgress: (animeId: string, episodeNum: number) => Promise<void>;
  setAnimeScore: (animeId: string, score: number) => Promise<void>;
  getLibraryEntry: (animeId: string) => LibraryEntry | undefined;

  // Downloads & BitTorrent Cache
  downloadTasks: DownloadTask[];
  addDownloadTask: (anime: AnimeItem, episode: Episode, source: TorrentSource) => Promise<void>;
  addCustomMagnetTask: (magnetUri: string) => Promise<boolean>;
  toggleDownloadPause: (id: string) => Promise<void>;
  deleteDownloadTask: (id: string) => Promise<void>;

  // Quick Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Toast Notification System (replaces alerts)
  toasts: ToastMessage[];
  showToast: (text: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<ActiveView>('discover');
  const [selectedAnime, setSelectedAnime] = useState<AnimeItem | null>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState<boolean>(false);
  const [playerState, setPlayerState] = useState<ActivePlayerState | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Theme state
  const [activePalette, setActivePaletteState] = useState<MatugenPalette>(MATUGEN_PALETTES[0]);
  const [blurEnabled, setBlurEnabled] = useState<boolean>(true);

  // Danmaku state
  const [danmakuEnabled, setDanmakuEnabled] = useState<boolean>(true);
  const [danmakuOpacity, setDanmakuOpacity] = useState<number>(0.85);
  const [danmakuFontSize, setDanmakuFontSize] = useState<number>(24);
  const [danmakuSpeedMultiplier, setDanmakuSpeedMultiplier] = useState<number>(1.0);
  const [danmakuComments, setDanmakuComments] = useState<DanmakuComment[]>([]);

  // Library & Cache state backed by IndexedDB
  const [library, setLibrary] = useState<Record<string, LibraryEntry>>({});
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Initial load from IndexedDB
  useEffect(() => {
    async function initFromDb() {
      try {
        // 1. Theme
        const savedPaletteId = await db.getSetting<string>('yozora_palette_id', 'twilight-sakura');
        const found = MATUGEN_PALETTES.find(p => p.id === savedPaletteId) || MATUGEN_PALETTES[0];
        setActivePaletteState(found);
        applyMatugenTheme(found);

        // 2. Library
        const dbLib = await db.getLibrary();
        setLibrary(dbLib);

        // 3. Downloads
        const dbDownloads = await db.getDownloads();
        setDownloadTasks(dbDownloads);
      } catch (err) {
        console.error('Failed to initialize Yozora state from IndexedDB:', err);
        showToast('Warning: Unable to load saved user data from local database.', 'warning');
      }
    }
    initFromDb();
  }, []);

  const showToast = (text: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  const setActivePalette = async (palette: MatugenPalette) => {
    setActivePaletteState(palette);
    applyMatugenTheme(palette);
    await db.saveSetting('yozora_palette_id', palette.id);
  };

  // Open Player with episode & dynamically resolve real stream for this anime
  const openPlayer = async (anime: AnimeItem, episode?: Episode, videoUrl?: string, sourceTitle?: string) => {
    const ep = episode || (anime.episodes && anime.episodes.length > 0 ? anime.episodes[0] : {
      id: 1,
      epNumber: 1,
      title: 'Episode 01',
      airDate: '2026-01-01',
      durationMinutes: 24,
      opSkipStart: 90,
      opSkipEnd: 180
    });
    
    // Resolve authentic BitTorrent stream for this specific anime & episode
    let chosenVideo = videoUrl;
    if (!chosenVideo) {
      const resolvedStreams = await streamService.resolveEpisodeStream(anime.id, anime.title, anime.romajiTitle, ep.epNumber);
      if (resolvedStreams.length > 0 && resolvedStreams[0]?.url) {
        chosenVideo = resolvedStreams[0].url;
      } else {
        chosenVideo = `http://127.0.0.1:3030/torrents/0/stream/0`;
      }
    }
    
    // Load danmaku comments for this exact episode from danmakuService
    const comments = await danmakuService.getDanmaku(anime.id, ep.epNumber);
    setDanmakuComments(comments);

    setPlayerState({
      isOpen: true,
      anime,
      episode: ep,
      videoUrl: chosenVideo,
      sourceTitle: sourceTitle || `[SubsPlease] ${anime.title} - ${ep.epNumber.toString().padStart(2, '0')} (1080p)`
    });

    // Update library watching progress
    await setAnimeProgress(anime.id, ep.epNumber);
  };

  const closePlayer = () => {
    setPlayerState(null);
  };

  const addDanmakuComment = async (
    text: string,
    color = '#ffffff',
    mode: 'scroll' | 'top' | 'bottom' = 'scroll',
    exactTime = 0
  ) => {
    if (!playerState) return;
    const newComment = await danmakuService.sendDanmaku(
      playerState.anime.id,
      playerState.episode.epNumber,
      text,
      color,
      mode,
      exactTime
    );
    if (newComment) {
      setDanmakuComments(prev => [...prev, newComment]);
    }
  };

  const setAnimeStatus = async (animeId: string, status: WatchStatus) => {
    const anime = await anidbService.getAnimeById(animeId);
    const existing = library[animeId] || {
      animeId,
      watchStatus: status,
      currentEpisode: 1,
      totalEpisodes: anime ? anime.episodesCount : 12,
      score: 8.0,
      lastWatchedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updatedEntry: LibraryEntry = {
      ...existing,
      watchStatus: status,
      updatedAt: new Date().toISOString()
    };

    await db.saveLibraryEntry(updatedEntry);
    setLibrary(prev => ({ ...prev, [animeId]: updatedEntry }));
    showToast(`Updated status for "${anime?.title || animeId}" to ${status}`, 'success');
  };

  const setAnimeProgress = async (animeId: string, episodeNum: number) => {
    const anime = await anidbService.getAnimeById(animeId);
    const existing = library[animeId] || {
      animeId,
      watchStatus: 'Watching',
      currentEpisode: episodeNum,
      totalEpisodes: anime ? anime.episodesCount : 12,
      score: 8.0,
      lastWatchedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const isCompleted = anime && episodeNum >= anime.episodesCount;

    const updatedEntry: LibraryEntry = {
      ...existing,
      watchStatus: isCompleted ? 'Completed' : 'Watching',
      currentEpisode: episodeNum,
      lastWatchedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.saveLibraryEntry(updatedEntry);
    setLibrary(prev => ({ ...prev, [animeId]: updatedEntry }));
  };

  const setAnimeScore = async (animeId: string, score: number) => {
    const existing = library[animeId];
    if (!existing) return;

    const updatedEntry: LibraryEntry = {
      ...existing,
      score: Math.max(0, Math.min(10, score)),
      updatedAt: new Date().toISOString()
    };

    await db.saveLibraryEntry(updatedEntry);
    setLibrary(prev => ({ ...prev, [animeId]: updatedEntry }));
    showToast(`Saved personal rating (${score.toFixed(1)}/10)`, 'success');
  };

  const getLibraryEntry = (animeId: string) => {
    return library[animeId];
  };

  const addDownloadTask = async (anime: AnimeItem, episode: Episode, source: TorrentSource) => {
    const taskId = `dl-${Date.now()}`;
    const initialStreamUrl = `http://127.0.0.1:3030/torrents/0/stream/0`;

    const newTask: DownloadTask = {
      id: taskId,
      animeId: anime.id,
      animeTitle: anime.title,
      episodeNum: episode.epNumber,
      sourceTitle: source.title,
      group: source.group,
      resolution: source.resolution,
      fileSize: source.fileSize,
      totalBytes: 1420000000,
      downloadedBytes: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      progress: 0,
      status: 'downloading',
      peers: source.seeders || 0,
      etaSeconds: 120,
      addedAt: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      videoUrl: initialStreamUrl
    };

    await db.saveDownloadTask(newTask);
    setDownloadTasks(prev => [newTask, ...prev]);
    showToast(`Connecting to BitTorrent swarm for "${source.title}"...`, 'info');

    // 1. Register with in-browser WebTorrent transfer engine
    try {
      torrentEngine.addTorrent(source.magnetLink, (stats) => {
        setDownloadTasks(prev => prev.map(t => {
          if (t.id === taskId) {
            const isDone = stats.state === 'completed' || stats.progress >= 100;
            const updated: DownloadTask = {
              ...t,
              downloadedBytes: stats.downloaded,
              totalBytes: stats.length,
              downloadSpeed: stats.downloadSpeed,
              uploadSpeed: stats.uploadSpeed,
              progress: stats.progress,
              peers: stats.numPeers,
              etaSeconds: stats.timeRemaining,
              status: isDone ? 'completed' : stats.state === 'paused' ? 'paused' : 'downloading',
              videoUrl: stats.streamUrl || t.videoUrl
            };
            db.saveDownloadTask(updated);
            return updated;
          }
          return t;
        }));
      });
    } catch (e) {
      console.warn('WebTorrent engine add error:', e);
    }

    // 2. Also register with native rqbit daemon if available
    try {
      const streamRes = await rqbitService.addTorrentAndGetStream(source.magnetLink, anime.title);
      if (streamRes?.stream_url) {
        setDownloadTasks(prev => prev.map(t => t.id === taskId ? { ...t, videoUrl: streamRes.stream_url } : t));
      }
    } catch (e) {
      // rqbit offline is non-fatal
    }
  };

  const addCustomMagnetTask = async (magnetUri: string): Promise<boolean> => {
    const parsed = sourceService.parseMagnet(magnetUri);
    if (!parsed) {
      showToast('Invalid magnet URI format. Must start with magnet:?xt=urn:btih:...', 'error');
      return false;
    }

    const taskId = `dl-magnet-${Date.now()}`;
    const initialStreamUrl = `http://127.0.0.1:3030/torrents/0/stream/0`;

    const newTask: DownloadTask = {
      id: taskId,
      animeId: 'custom',
      animeTitle: parsed.name,
      episodeNum: 1,
      sourceTitle: parsed.name,
      group: 'P2P Swarm',
      resolution: '1080p',
      fileSize: '1.40 GB',
      totalBytes: 1400000000,
      downloadedBytes: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      progress: 0,
      status: 'downloading',
      peers: 0,
      etaSeconds: 120,
      addedAt: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      videoUrl: initialStreamUrl
    };

    await db.saveDownloadTask(newTask);
    setDownloadTasks(prev => [newTask, ...prev]);
    showToast(`Connecting to BitTorrent swarm for "${parsed.name}"...`, 'info');

    // 1. Register with in-browser WebTorrent transfer engine
    try {
      torrentEngine.addTorrent(magnetUri, (stats) => {
        setDownloadTasks(prev => prev.map(t => {
          if (t.id === taskId) {
            const isDone = stats.state === 'completed' || stats.progress >= 100;
            const updated: DownloadTask = {
              ...t,
              downloadedBytes: stats.downloaded,
              totalBytes: stats.length,
              downloadSpeed: stats.downloadSpeed,
              uploadSpeed: stats.uploadSpeed,
              progress: stats.progress,
              peers: stats.numPeers,
              etaSeconds: stats.timeRemaining,
              status: isDone ? 'completed' : stats.state === 'paused' ? 'paused' : 'downloading',
              videoUrl: stats.streamUrl || t.videoUrl
            };
            db.saveDownloadTask(updated);
            return updated;
          }
          return t;
        }));
      });
    } catch (e) {
      console.warn('WebTorrent engine add error:', e);
    }

    // 2. Also register with native rqbit daemon if available
    try {
      const streamRes = await rqbitService.addTorrentAndGetStream(magnetUri, parsed.name);
      if (streamRes?.stream_url) {
        setDownloadTasks(prev => prev.map(t => t.id === taskId ? { ...t, videoUrl: streamRes.stream_url } : t));
      }
    } catch (e) {
      // rqbit offline is non-fatal
    }

    return true;
  };

  const toggleDownloadPause = async (id: string) => {
    setDownloadTasks(prev => {
      const updated = prev.map(task => {
        if (task.id === id) {
          const nextStatus = task.status === 'downloading' ? 'paused' : 'downloading';
          torrentEngine.togglePause(id);
          const u: DownloadTask = {
            ...task,
            status: nextStatus,
            downloadSpeed: nextStatus === 'paused' ? 0 : task.downloadSpeed
          };
          db.saveDownloadTask(u);
          return u;
        }
        return task;
      });
      return updated;
    });
  };

  const deleteDownloadTask = async (id: string) => {
    torrentEngine.removeTorrent(id);
    await db.deleteDownloadTask(id);
    setDownloadTasks(prev => prev.filter(task => task.id !== id));
    showToast('Removed task from Cache Manager.', 'info');
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
        setAnimeScore,
        getLibraryEntry,
        downloadTasks,
        addDownloadTask,
        addCustomMagnetTask,
        toggleDownloadPause,
        deleteDownloadTask,
        searchQuery,
        setSearchQuery,
        toasts,
        showToast
      }}
    >
      {children}
      {/* Material 3 Toast Container */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 999, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              background: 'var(--md-sys-color-surface-container-highest)',
              color: toast.type === 'error' ? '#ff8585' : toast.type === 'success' ? '#a5f3bc' : 'var(--md-sys-color-on-surface)',
              border: `1px solid ${toast.type === 'error' ? 'rgba(255,100,100,0.4)' : toast.type === 'success' ? 'rgba(100,255,150,0.4)' : 'var(--md-sys-color-outline-variant)'}`,
              borderRadius: '12px',
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 500,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              pointerEvents: 'auto',
              animation: 'fadeIn 0.2s ease'
            }}
          >
            {toast.text}
          </div>
        ))}
      </div>
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
