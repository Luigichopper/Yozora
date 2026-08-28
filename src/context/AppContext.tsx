import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  AnimeItem,
  Episode,
  TorrentSource,
  LibraryEntry,
  MatugenPalette,
  WatchStatus
} from '../types/anime';
import { MATUGEN_PALETTES, applyMatugenTheme } from '../theme/matugen';
import { db } from '../services/db';
import { anidbService } from '../services/anidbService';
import { sourceService } from '../services/sourceService';
import { streamService } from '../services/streamService';
import { rqbitService } from '../services/rqbitService';
import { torrentEngine } from '../services/torrentEngine';

import { anilistService } from '../services/tracking/anilist';

export type ActiveView = 'discover' | 'browse' | 'library' | 'settings';

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
  
  // Direct Playback
  playerState: ActivePlayerState | null;
  openPlayer: (anime: AnimeItem, episode?: Episode, videoUrl?: string, sourceTitle?: string) => void;
  closePlayer: () => void;

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

  // Quick Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Toast Notification System
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

  // Library & tracking state backed by IndexedDB
  const [library, setLibrary] = useState<Record<string, LibraryEntry>>({});
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
  const openPlayer = (anime: AnimeItem, episode?: Episode, videoUrl?: string, sourceTitle?: string) => {
    const ep = episode || (anime.episodes && anime.episodes.length > 0 ? anime.episodes[0] : {
      id: 1,
      epNumber: 1,
      title: 'Episode 01',
      airDate: '2026-01-01',
      durationMinutes: 24,
      opSkipStart: 90,
      opSkipEnd: 180
    });
    
    // Open player modal immediately so user sees immediate feedback
    setPlayerState({
      isOpen: true,
      anime,
      episode: ep,
      videoUrl: videoUrl || '',
      sourceTitle: sourceTitle || `[Direct / BitTorrent] ${anime.title} - EP ${ep.epNumber.toString().padStart(2, '0')}`
    });
  };

  const closePlayer = () => {
    setPlayerState(null);
  };

  const setAnimeStatus = async (animeId: string, status: WatchStatus) => {
    const anime = await anidbService.getAnimeById(animeId);
    const existing = library[animeId] || {
      animeId,
      watchStatus: status,
      currentEpisode: 1,
      totalEpisodes: anime ? anime.episodesCount : 0,
      score: 8.0,
      lastWatchedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updatedEntry: LibraryEntry = {
      ...existing,
      totalEpisodes: anime ? anime.episodesCount : existing.totalEpisodes,
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
      totalEpisodes: anime ? anime.episodesCount : 0,
      score: 8.0,
      lastWatchedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const totalEps = anime ? anime.episodesCount : existing.totalEpisodes;
    const isCompleted = totalEps > 0 && episodeNum >= totalEps;

    const updatedEntry: LibraryEntry = {
      ...existing,
      totalEpisodes: totalEps,
      watchStatus: isCompleted ? 'Completed' : 'Watching',
      currentEpisode: episodeNum,
      lastWatchedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.saveLibraryEntry(updatedEntry);
    setLibrary(prev => ({ ...prev, [animeId]: updatedEntry }));

    // Sync progress to AniList if authenticated
    if (anilistService.isAuthenticated() && anime) {
      const mediaId = anime.anidbId;
      if (mediaId) {
        anilistService.updateProgress(mediaId, episodeNum, anime.episodesCount).then(synced => {
          if (synced) {
            showToast(`Synced EP ${episodeNum} to your AniList profile!`, 'success');
          } else {
            showToast('AniList watch sync was not recorded. Check connection or token in Settings.', 'warning');
          }
        });
      }
    }
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
        activePalette,
        setActivePalette,
        blurEnabled,
        setBlurEnabled,
        library,
        setAnimeStatus,
        setAnimeProgress,
        setAnimeScore,
        getLibraryEntry,
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
