import React, { useState, useEffect } from 'react';
import { Calendar, Play, Sparkles, Flame, Star, Clock, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { anidbService, deduplicateAnime } from '../services/anidbService';
import { AnimeItem } from '../types/anime';

export const DiscoverView: React.FC = () => {
  const { setSelectedAnime, setIsScheduleOpen, openPlayer, library } = useApp();
  const [trendingList, setTrendingList] = useState<AnimeItem[]>([]);
  const [recommendedAnime, setRecommendedAnime] = useState<AnimeItem[]>([]);
  const [animeMap, setAnimeMap] = useState<Record<string, AnimeItem>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function loadDiscoverData() {
      try {
        setIsLoading(true);
        const [trending, topRated] = await Promise.all([
          anidbService.getTrendingAnime(12),
          anidbService.searchAnime('', { sortBy: 'SCORE_DESC', minScore: 8.0 }, 1, 14)
        ]);

        if (isMounted) {
          const dedupedTrending = deduplicateAnime(trending);
          const trendingIds = new Set(dedupedTrending.map(t => t.id));
          const distinctRecommended = deduplicateAnime(topRated.items.filter(item => !trendingIds.has(item.id)));

          setTrendingList(dedupedTrending);
          setRecommendedAnime(distinctRecommended.length > 0 ? distinctRecommended.slice(0, 10) : dedupedTrending.slice(4, 10));
        }

        // Map for continue watching
        const map: Record<string, AnimeItem> = {};
        for (const id of Object.keys(library)) {
          const item = await anidbService.getAnimeById(id);
          if (item) map[id] = item;
        }
        if (isMounted) setAnimeMap(map);
      } catch (e) {
        console.warn('Failed to load live trending:', e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadDiscoverData();
    return () => { isMounted = false; };
  }, [library]);

  const hotBanners = trendingList;

  // Continue watching items from library
  const continueWatchingIds = Object.keys(library);
  const continueWatchingAnime = continueWatchingIds
    .map(id => {
      const anime = animeMap[id];
      const entry = library[id];
      return anime && entry ? { anime, entry } : null;
    })
    .filter((item): item is { anime: AnimeItem; entry: typeof library[string] } => item !== null);

  const finalRecommended = recommendedAnime;

  if (isLoading && trendingList.length === 0) {
    return (
      <div className="discover-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--md-sys-color-primary)' }}>
          <Loader2 size={36} className="spin-animation" />
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--md-sys-color-on-surface-variant)' }}>Loading Anime Discovery...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="discover-container">
      {/* 1. Top Section: "最高热度" (Top Trending) & "新番时间表" (Seasonal Schedule Button) */}
      <div className="section-header">
        <div className="section-title">
          <Flame size={20} color="var(--md-sys-color-primary)" />
          <span>最高热度 • Top Trending</span>
        </div>

        <button
          className="section-btn"
          onClick={() => setIsScheduleOpen(true)}
          title="Open Seasonal Airing Schedule"
        >
          <Calendar size={14} />
          <span>新番时间表</span>
        </button>
      </div>

      {hotBanners.length > 0 ? (
        <div className="trending-carousel">
          {hotBanners.map(anime => (
            <div
              key={anime.id}
              className="trending-banner-card"
              onClick={() => setSelectedAnime(anime)}
            >
              <img src={anime.banner || anime.poster} alt={anime.title} className="banner-card-img" />
              <div className="banner-card-overlay">
                <div className="banner-card-title">{anime.title}</div>
                <div className="banner-card-sub">{anime.bannerSubtitle || `${anime.season} • ${anime.studio}`}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--md-sys-color-on-surface-variant)' }}>
          No trending anime found. Ensure network connection or browse locally cached titles.
        </div>
      )}

      {/* 2. Middle Section: "继续观看" (Continue Watching) */}
      {continueWatchingAnime.length > 0 && (
        <div style={{ marginTop: '28px' }}>
          <div className="section-header">
            <div className="section-title">
              <Clock size={20} color="var(--md-sys-color-primary)" />
              <span>继续观看 • Continue Watching</span>
            </div>
          </div>

          <div className="posters-grid">
            {continueWatchingAnime.map(({ anime, entry }) => {
              const progressPercent = Math.round((entry.currentEpisode / entry.totalEpisodes) * 100);

              return (
                <div
                  key={anime.id}
                  className="poster-card"
                  onClick={() => setSelectedAnime(anime)}
                >
                  <div className="poster-img-wrap">
                    <img src={anime.poster} alt={anime.title} className="poster-img" />
                    <span className="poster-badge-type">{anime.type}</span>
                    <span className="poster-badge-rating">
                      <Star size={10} fill="#ffeb3b" color="#ffeb3b" />
                      {anime.rating.toFixed(1)}
                    </span>

                    <button
                      className="poster-overlay-play"
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextEp = anime.episodes.find(ep => ep.epNumber === entry.currentEpisode) || anime.episodes[0];
                        openPlayer(anime, nextEp);
                      }}
                      title={`Resume Episode ${entry.currentEpisode}`}
                    >
                      <Play size={16} fill="currentColor" />
                    </button>
                  </div>

                  <div className="poster-info">
                    <div className="poster-title" title={anime.title}>{anime.title}</div>
                    <div className="poster-meta">
                      <span>EP {entry.currentEpisode} / {entry.totalEpisodes}</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="progress-bar-wrap">
                      <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Bottom Section: "推荐" (Recommended Shelf) */}
      {finalRecommended.length > 0 && (
        <div style={{ marginTop: '28px' }}>
          <div className="section-header">
            <div className="section-title">
              <Sparkles size={20} color="var(--md-sys-color-primary)" />
              <span>为你推荐 • Recommended For You</span>
            </div>
          </div>

          <div className="posters-grid">
            {finalRecommended.map(anime => (
              <div
                key={anime.id}
                className="poster-card"
                onClick={() => setSelectedAnime(anime)}
              >
                <div className="poster-img-wrap">
                  <img src={anime.poster} alt={anime.title} className="poster-img" />
                  <span className="poster-badge-type">{anime.type}</span>
                  <span className="poster-badge-rating">
                    <Star size={10} fill="#ffeb3b" color="#ffeb3b" />
                    {anime.rating.toFixed(1)}
                  </span>

                  <button
                    className="poster-overlay-play"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPlayer(anime);
                    }}
                    title="Play Episode 01"
                  >
                    <Play size={16} fill="currentColor" />
                  </button>
                </div>

                  <div className="poster-info">
                    <div className="poster-title" title={anime.title}>{anime.title}</div>
                    <div className="poster-meta">
                      <span>{anime.season || anime.year}</span>
                      <span>{anime.type === 'Movie' ? 'Movie' : anime.episodesCount ? `${anime.episodesCount} eps` : 'TBA'}</span>
                    </div>
                  </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
