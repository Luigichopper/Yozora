import React from 'react';
import { Calendar, Play, Sparkles, Flame, Star, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MOCK_ANIME_DATABASE } from '../data/mockAniDB';

export const DiscoverView: React.FC = () => {
  const { setSelectedAnime, setIsScheduleOpen, openPlayer, library } = useApp();

  // Top trending banner list
  const hotBanners = MOCK_ANIME_DATABASE.filter(a => a.isHotBanner || a.isTrending);

  // Continue watching items from library
  const continueWatchingIds = Object.keys(library);
  const continueWatchingAnime = continueWatchingIds
    .map(id => {
      const anime = MOCK_ANIME_DATABASE.find(a => a.id === id);
      const entry = library[id];
      return anime && entry ? { anime, entry } : null;
    })
    .filter((item): item is { anime: typeof MOCK_ANIME_DATABASE[0]; entry: typeof library[string] } => item !== null);

  // Recommended anime list
  const recommendedAnime = MOCK_ANIME_DATABASE.slice(2, 9);

  return (
    <div className="discover-container">
      {/* 1. Top Section: "最高热度" (Top Trending) & "新番时间表" (Seasonal Schedule Button) */}
      <div className="section-header">
        <div className="section-title">
          <Flame size={20} color="var(--md-sys-color-primary)" />
          <span>最高热度</span>
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

      <div className="trending-carousel">
        {hotBanners.map(anime => (
          <div
            key={anime.id}
            className="trending-banner-card"
            onClick={() => setSelectedAnime(anime)}
          >
            <img src={anime.banner} alt={anime.title} className="banner-card-img" />
            <div className="banner-card-overlay">
              <div className="banner-card-title">{anime.title}</div>
              <div className="banner-card-sub">{anime.bannerSubtitle || `${anime.season} • ${anime.studio}`}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Middle Section: "继续观看" (Continue Watching) */}
      <div className="section-header">
        <div className="section-title">
          <Clock size={20} color="var(--md-sys-color-primary)" />
          <span>继续观看</span>
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
                
                {/* Play action overlay button */}
                <button
                  className="poster-overlay-play"
                  onClick={(e) => {
                    e.stopPropagation();
                    const ep = anime.episodes.find(ep => ep.epNumber === entry.currentEpisode) || anime.episodes[0];
                    openPlayer(anime, ep);
                  }}
                  title={`Play Ep ${entry.currentEpisode}`}
                >
                  <Play size={16} fill="currentColor" />
                </button>
              </div>

              <div className="poster-info">
                <div className="poster-title">{anime.title}</div>
                <div className="poster-meta">
                  <span>继续观看 {entry.currentEpisode.toString().padStart(2, '0')}</span>
                  <span>{entry.totalEpisodes} 集全</span>
                </div>
                <div className="progress-bar-wrap">
                  <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Bottom Section: "推荐" (Recommended / Season Picks) */}
      <div className="section-header">
        <div className="section-title">
          <Sparkles size={20} color="var(--md-sys-color-primary)" />
          <span>推荐</span>
        </div>
      </div>

      <div className="posters-grid">
        {recommendedAnime.map(anime => (
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
              <div className="poster-title">{anime.title}</div>
              <div className="poster-meta">
                <span>{anime.studio}</span>
                <span>{anime.season}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
