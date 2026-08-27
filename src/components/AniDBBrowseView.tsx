import React, { useState, useMemo } from 'react';
import { Search, Filter, Star, Sparkles, SlidersHorizontal, Play } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MOCK_ANIME_DATABASE } from '../data/mockAniDB';
import { AnimeType, AnimeStatus } from '../types/anime';

export const AniDBBrowseView: React.FC = () => {
  const { setSelectedAnime, openPlayer } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [seasonFilter, setSeasonFilter] = useState<string>('All');
  const [yearFilter, setYearFilter] = useState<string>('All');
  const [genreFilter, setGenreFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('rating');

  const filteredAnime = useMemo(() => {
    return MOCK_ANIME_DATABASE.filter(anime => {
      // Search text match
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchTitle = anime.title.toLowerCase().includes(q);
        const matchRomaji = anime.romajiTitle.toLowerCase().includes(q);
        const matchJp = anime.japaneseTitle.toLowerCase().includes(q);
        const matchStudio = anime.studio.toLowerCase().includes(q);
        if (!matchTitle && !matchRomaji && !matchJp && !matchStudio) return false;
      }

      // Type filter
      if (typeFilter !== 'All' && anime.type !== typeFilter) return false;

      // Status filter
      if (statusFilter !== 'All' && anime.status !== statusFilter) return false;

      // Season filter
      if (seasonFilter !== 'All' && !anime.season.includes(seasonFilter)) return false;

      // Year filter
      if (yearFilter !== 'All' && anime.year.toString() !== yearFilter) return false;

      // Genre filter
      if (genreFilter !== 'All' && !anime.genres.includes(genreFilter)) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'votes') return b.votesCount - a.votesCount;
      if (sortBy === 'year') return b.year - a.year;
      return a.title.localeCompare(b.title);
    });
  }, [searchTerm, typeFilter, statusFilter, seasonFilter, yearFilter, genreFilter, sortBy]);

  return (
    <div className="browse-container">
      {/* Top Header matching Image 2 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.4px', color: 'var(--md-sys-color-on-surface)' }}>
            Browse Anime
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}>
            {filteredAnime.length.toLocaleString()} results found from anidb.net API cache
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 152, 0, 0.15)', border: '1px solid rgba(255, 152, 0, 0.4)', borderRadius: '999px', padding: '4px 12px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff9800' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#ff9800' }}>AniDB Official API</span>
          </div>
        </div>
      </div>

      {/* Filter Bar (Image 2 style) */}
      <div className="anidb-filter-container">
        {/* Search input */}
        <div className="search-input-wrap">
          <Search size={16} className="search-input-icon" />
          <input
            type="text"
            placeholder="Search anime title, romaji, kanji..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Type select */}
        <select
          className="filter-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="All">All Types</option>
          <option value="TV">TV Series</option>
          <option value="Movie">Movie</option>
          <option value="OVA">OVA</option>
          <option value="ONA">ONA</option>
          <option value="Special">Special</option>
        </select>

        {/* Status select */}
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">All Status</option>
          <option value="Airing">Currently Airing</option>
          <option value="Finished">Finished Airing</option>
          <option value="Upcoming">Upcoming</option>
        </select>

        {/* Seasons select */}
        <select
          className="filter-select"
          value={seasonFilter}
          onChange={(e) => setSeasonFilter(e.target.value)}
        >
          <option value="All">All Seasons</option>
          <option value="Spring">Spring</option>
          <option value="Summer">Summer</option>
          <option value="Fall">Fall</option>
          <option value="Winter">Winter</option>
        </select>

        {/* Years select */}
        <select
          className="filter-select"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
        >
          <option value="All">All Years</option>
          <option value="2026">2026</option>
          <option value="2025">2025</option>
          <option value="2024">2024</option>
          <option value="2023">2023</option>
          <option value="2011">2011</option>
          <option value="2008">2008</option>
          <option value="2007">2007</option>
          <option value="1999">1999</option>
        </select>

        {/* Genre select */}
        <select
          className="filter-select"
          value={genreFilter}
          onChange={(e) => setGenreFilter(e.target.value)}
        >
          <option value="All">All Genres</option>
          <option value="Action">Action</option>
          <option value="Adventure">Adventure</option>
          <option value="Comedy">Comedy</option>
          <option value="Drama">Drama</option>
          <option value="Fantasy">Fantasy</option>
          <option value="Music">Music</option>
          <option value="Mystery">Mystery</option>
          <option value="Romance">Romance</option>
          <option value="Sci-Fi">Sci-Fi</option>
          <option value="Supernatural">Supernatural</option>
        </select>

        {/* Sort select */}
        <select
          className="filter-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="rating">AniDB Rating (High to Low)</option>
          <option value="votes">Most Popular / Votes</option>
          <option value="year">Release Year (Newest)</option>
          <option value="title">Title (A-Z)</option>
        </select>
      </div>

      {/* Grid of Results */}
      <div className="posters-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        {filteredAnime.map(anime => (
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
                <span>{anime.year}</span>
                <span>{anime.episodesCount ? `${anime.episodesCount} eps` : 'TBA'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
