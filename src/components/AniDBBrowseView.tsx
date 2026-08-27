import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Star, Sparkles, SlidersHorizontal, Play, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { anidbService } from '../services/anidbService';
import { AnimeItem } from '../types/anime';

export const AniDBBrowseView: React.FC = () => {
  const { setSelectedAnime, openPlayer } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [seasonFilter, setSeasonFilter] = useState<string>('All');
  const [yearFilter, setYearFilter] = useState<string>('All');
  const [genreFilter, setGenreFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('rating');
  const [animeList, setAnimeList] = useState<AnimeItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pageLimit, setPageLimit] = useState<number>(24);

  // Perform search & filter through anidbService
  useEffect(() => {
    let isMounted = true;
    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const results = await anidbService.searchAnime(searchTerm, {
          type: typeFilter,
          status: statusFilter,
          season: seasonFilter,
          year: yearFilter,
          genre: genreFilter
        });
        if (isMounted) {
          setAnimeList(results);
        }
      } catch (e) {
        console.error('Failed to search anime:', e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchResults, 200);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchTerm, typeFilter, statusFilter, seasonFilter, yearFilter, genreFilter]);

  const sortedAnime = useMemo(() => {
    return [...animeList].sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'votes') return b.votesCount - a.votesCount;
      if (sortBy === 'year') return b.year - a.year;
      return a.title.localeCompare(b.title);
    });
  }, [animeList, sortBy]);

  const visibleAnime = sortedAnime.slice(0, pageLimit);

  return (
    <div className="browse-container">
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.4px', color: 'var(--md-sys-color-on-surface)' }}>
            Browse Anime (番组索引)
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}>
            {sortedAnime.length.toLocaleString()} titles indexed in local SQLite / AniDB cache
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 152, 0, 0.15)', border: '1px solid rgba(255, 152, 0, 0.4)', borderRadius: '999px', padding: '4px 12px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff9800' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#ff9800' }}>AniDB Official Client API</span>
          </div>
        </div>
      </div>

      {/* Multi-Filter Bar */}
      <div className="anidb-filter-container">
        {/* Search input */}
        <div className="search-input-wrap">
          <Search size={16} className="search-input-icon" />
          <input
            type="text"
            placeholder="Search anime title, romaji, kanji, studio..."
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
          <option value="2022">2022</option>
          <option value="2021">2021</option>
          <option value="2017">2017</option>
          <option value="2012">2012</option>
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
          <option value="Sports">Sports</option>
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
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '10px', color: 'var(--md-sys-color-primary)' }}>
          <Loader2 size={24} className="animate-spin" />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Querying AniDB metadata cache...</span>
        </div>
      ) : visibleAnime.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--md-sys-color-on-surface-variant)' }}>
          No anime matched your search filters. Try clearing filters or searching for another title.
        </div>
      ) : (
        <>
          <div className="posters-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {visibleAnime.map(anime => (
              <div
                key={anime.id}
                className="poster-card"
                onClick={() => setSelectedAnime(anime)}
              >
                <div className="poster-img-wrap">
                  <img src={anime.poster} alt={anime.title} className="poster-img" loading="lazy" />
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

          {visibleAnime.length < sortedAnime.length && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
              <button
                className="section-btn"
                onClick={() => setPageLimit(prev => prev + 24)}
                style={{ padding: '8px 24px' }}
              >
                Load More Titles ({sortedAnime.length - visibleAnime.length} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
