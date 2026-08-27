import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { WatchProgress } from '../types/anime';
import { anilistService } from '../services/tracking/anilist';

export interface AnimeStoreState {
  progress: Record<string, WatchProgress>;
  volume: number;
  autoPlayNext: boolean;
  autoSkipIntro: boolean;
  preferredQuality: string;
  setProgress: (mediaId: string, progress: WatchProgress, anilistMediaId?: number, totalEpisodes?: number) => void;
  getProgress: (mediaId: string, episodeId: string) => WatchProgress | undefined;
  setVolume: (volume: number) => void;
  setAutoPlayNext: (enabled: boolean) => void;
  setAutoSkipIntro: (enabled: boolean) => void;
  setPreferredQuality: (quality: string) => void;
}

export const useAnimeStore = create<AnimeStoreState>()(
  persist(
    (set, get) => ({
      progress: {},
      volume: 1,
      autoPlayNext: true,
      autoSkipIntro: false,
      preferredQuality: 'auto',

      setProgress: (mediaId, progressData, anilistMediaId, totalEpisodes) => {
        set((state) => ({
          progress: {
            ...state.progress,
            [`${mediaId}:${progressData.episodeId}`]: progressData,
          },
        }));

        if (progressData.completed && anilistMediaId) {
          anilistService.updateProgress(anilistMediaId, progressData.episodeNumber, totalEpisodes);
        }
      },

      getProgress: (mediaId, episodeId) => {
        return get().progress[`${mediaId}:${episodeId}`];
      },

      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      setAutoPlayNext: (autoPlayNext) => set({ autoPlayNext }),
      setAutoSkipIntro: (autoSkipIntro) => set({ autoSkipIntro }),
      setPreferredQuality: (preferredQuality) => set({ preferredQuality }),
    }),
    {
      name: 'yozora-anime-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
