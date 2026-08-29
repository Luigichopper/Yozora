import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  Star,
  Sparkles,
  SlidersHorizontal,
  Play,
  Loader2,
  LayoutGrid,
  List,
  RotateCcw,
  Tv,
  Film,
  Calendar,
  Layers,
  ChevronRight,
  Flame
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { anidbService, deduplicateAnime, AnimeSearchFilters } from '../services/anidbService';
import { AnimeItem } from '../types/anime';

const POPULAR_GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Mystery',
  'Supernatural',
  'Thriller',
  'Sports',
  'Mecha',
  'Psychological',
  'Horror',
  'Music'
];

export const AniDBBrowseView: React.FC = () => {
  const { setSelectedAnime, openPlayer } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [seasonFilter, setSeasonFilter] = useState<string>('All');
  const [yearFilter, setYearFilter] = useState<string>('All');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [sortBy, setSortBy] = useState<string>('POPULARITY_DESC');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [animeList, setAnimeList] = useState<AnimeItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasNextPage, setHasNextPage] = useState<boolean>(true);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (typeFilter !== 'All') count++;
    if (statusFilter !== 'All') count++;
    if (seasonFilter !== 'All') count++;
    if (yearFilter !== 'All') count++;
    if (selectedGenre !== 'All') count++;
    if (minScoreFilter > 0) count++;
    if (searchTerm.trim()) count++;
    return count;
  }, [typeFilter, statusFilter, seasonFilter, yearFilter, selectedGenre, minScoreFilter, searchTerm]);

  const resetFilters = () => {
    setSearchTerm('');
    setTypeFilter('All');
    setStatusFilter('All');
    setSeasonFilter('All');
    setYearFilter('All');
    setSelectedGenre('All');
    setMinScoreFilter(0);
    setSortBy('POPULARITY_DESC');
  };

  // Perform search & filter through anidbService with deduplication
  useEffect(() => {
    let isMounted = true;
    setCurrentPage(1);

    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const filters: AnimeSearchFilters = {
          type: typeFilter,
          status: statusFilter,
          season: seasonFilter,
          year: yearFilter,
          genre: selectedGenre,
          minScore: minScoreFilter,
          sortBy: sortBy as any
        };

        const results = await anidbService.searchAnime(searchTerm, filters, 1, 36);
        if (isMounted) {
          setAnimeList(deduplicateAnime(results.items));
          setHasNextPage(results.hasNextPage);
        }
      } catch (e) {
        console.error('Failed to search anime:', e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchResults, 250);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchTerm, typeFilter, statusFilter, seasonFilter, yearFilter, selectedGenre, minScoreFilter, sortBy]);

  // Load next page
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasNextPage) return;
    setIsLoadingMore(true);
    const nextPage = currentPage + 1;
    try {
      const filters: AnimeSearchFilters = {
        type: typeFilter,
        status: statusFilter,
        season: seasonFilter,
        year: yearFilter,
        genre: selectedGenre,
        minScore: minScoreFilter,
        sortBy: sortBy as any
      };
      const results = await anidbService.searchAnime(searchTerm, filters, nextPage, 36);
      setAnimeList(prev => deduplicateAnime([...prev, ...results.items]));
      setHasNextPage(results.hasNextPage);
      setCurrentPage(nextPage);
    } catch (e) {
      console.warn('Failed to load more anime:', e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="browse-container" style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.4px', color: 'var(--md-sys-color-on-surface)' }}>
            Anime Catalog (番组索引)
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}>
            {animeList.length.toLocaleString()} titles retrieved • AniList GraphQL Real-time Index
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', background: 'var(--md-sys-color-surface-container)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '12px', padding: '3px' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                background: viewMode === 'grid' ? 'var(--md-sys-color-primary)' : 'transparent',
                color: viewMode === 'grid' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
                border: 'none',
                borderRadius: '9px',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              title="Grid View"
            >
              <LayoutGrid size={14} />
              <span>Grid</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                background: viewMode === 'list' ? 'var(--md-sys-color-primary)' : 'transparent',
                color: viewMode === 'list' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
                border: 'none',
                borderRadius: '9px',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              title="List View"
            >
              <List size={14} />
              <span>List</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(2, 169, 255, 0.15)', border: '1px solid rgba(2, 169, 255, 0.4)', borderRadius: '999px', padding: '5px 14px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#02a9ff' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#02a9ff' }}>AniList GraphQL</span>
          </div>
        </div>
      </div>

      {/* Multi-Filter Bar */}
      <div className="anidb-filter-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--md-sys-color-surface-container)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '20px', padding: '16px', marginBottom: '20px' }}>
        {/* Row 1: Search & Primary Selects */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', alignItems: 'center' }}>
          {/* Search input */}
          <div className="search-input-wrap" style={{ gridColumn: 'span 2', minWidth: '220px' }}>
            <Search size={16} className="search-input-icon" />
            <input
              type="text"
              placeholder="Search anime title, romaji, studio, characters..."
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
            <option value="All">All Formats</option>
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
            <option value="Finished">Finished</option>
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
            <option value="2020">2020</option>
            <option value="2019">2019</option>
            <option value="2018">2018</option>
            <option value="2010s">2010s Decade</option>
            <option value="2000s">2000s Decade</option>
            <option value="1990s">1990s Classic</option>
          </select>

          {/* Sort select */}
          <select
            className="filter-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="POPULARITY_DESC">Most Popular (人气)</option>
            <option value="TRENDING_DESC">Trending Now (热度)</option>
            <option value="SCORE_DESC">Top Rated (最高评分)</option>
            <option value="START_DATE_DESC">Release Date (最新)</option>
            <option value="FAVOURITES_DESC">Most Favorited (收藏)</option>
            <option value="EPISODES_DESC">Most Episodes (集数)</option>
            <option value="TITLE_ROMAJI">Title (A–Z)</option>
          </select>

          {/* Min Score filter */}
          <select
            className="filter-select"
            value={minScoreFilter}
            onChange={(e) => setMinScoreFilter(parseFloat(e.target.value))}
          >
            <option value="0">Any Rating</option>
            <option value="7.0">★ 7.0+ Score</option>
            <option value="7.5">★ 7.5+ Score</option>
            <option value="8.0">★ 8.0+ Great</option>
            <option value="8.5">★ 8.5+ Masterpiece</option>
            <option value="9.0">★ 9.0+ Legendary</option>
          </select>

          {/* Reset Filters button */}
          {activeFiltersCount > 0 && (
            <button
              onClick={resetFilters}
              style={{
                background: 'rgba(255, 82, 82, 0.15)',
                color: '#ff5252',
                border: '1px solid rgba(255, 82, 82, 0.3)',
                borderRadius: '12px',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              title="Reset all filters"
            >
              <RotateCcw size={12} />
              <span>Reset ({activeFiltersCount})</span>
            </button>
          )}
        </div>

        {/* Row 2: Genre Pills Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--md-sys-color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', marginRight: '4px' }}>
            Genres:
          </span>
          <button
            onClick={() => setSelectedGenre('All')}
            style={{
              background: selectedGenre === 'All' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)',
              color: selectedGenre === 'All' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              borderRadius: '999px',
              padding: '4px 12px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            All
          </button>
          {POPULAR_GENRES.map(genre => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(selectedGenre === genre ? 'All' : genre)}
              style={{
                background: selectedGenre === genre ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)',
                color: selectedGenre === genre ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
                border: selectedGenre === genre ? '1px solid var(--md-sys-color-primary)' : '1px solid var(--md-sys-color-outline-variant)',
                borderRadius: '999px',
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Main Results View */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', gap: '12px', color: 'var(--md-sys-color-primary)' }}>
          <Loader2 size={32} className="spin-animation" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--md-sys-color-on-surface-variant)' }}>
            Retrieving anime catalog from AniList GraphQL...
          </span>
        </div>
      ) : animeList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--md-sys-color-surface-container)', borderRadius: '24px', border: '1px solid var(--md-sys-color-outline-variant)' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
            No anime matched your search criteria
          </div>
          <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '20px' }}>
            Try broadening your genre filters, choosing another year or format, or resetting search terms.
          </p>
          <button
            onClick={resetFilters}
            className="section-btn"
            style={{ margin: '0 auto' }}
          >
            <RotateCcw size={14} />
            <span>Reset Search Filters</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <>
          <div className="posters-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '16px' }}>
            {animeList.map(anime => (
              <div
                key={anime.id}
                className="poster-card"
                onClick={() => setSelectedAnime(anime)}
                style={{ cursor: 'pointer' }}
              >
                <div className="poster-img-wrap">
                  <img src={anime.poster} alt={anime.title} className="poster-img" loading="lazy" />
                  
                  {/* Top Badges */}
                  <span className="poster-badge-type" style={{ fontSize: '10px', padding: '2px 6px', fontWeight: 700 }}>
                    {anime.type}
                  </span>
                  <span className="poster-badge-rating">
                    <Star size={10} fill="#ffeb3b" color="#ffeb3b" />
                    {anime.rating.toFixed(1)}
                  </span>

                  {/* Play Overlay */}
                  <button
                    className="poster-overlay-play"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPlayer(anime);
                    }}
                    title="Stream Episode 01"
                  >
                    <Play size={16} fill="currentColor" />
                  </button>
                </div>

                <div className="poster-info">
                  <div className="poster-title" title={anime.title}>{anime.title}</div>
                  <div className="poster-meta">
                    <span style={{ color: 'var(--md-sys-color-primary)', fontWeight: 600 }}>
                      {anime.season || anime.year}
                    </span>
                    <span>
                      {anime.type === 'Movie' ? 'Movie' : anime.episodesCount ? `${anime.episodesCount} eps` : 'TBA'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Load More Button */}
          {hasNextPage && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px' }}>
              <button
                className="section-btn"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                style={{ padding: '10px 32px', fontSize: '13px', background: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)', borderColor: 'var(--md-sys-color-primary)' }}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 size={14} className="spin-animation" />
                    <span>Loading more titles...</span>
                  </>
                ) : (
                  <span>Load More Titles</span>
                )}
              </button>
            </div>
          )}
        </>
      ) : (
        /* DETAILED LIST VIEW */
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {animeList.map(anime => (
              <div
                key={anime.id}
                onClick={() => setSelectedAnime(anime)}
                style={{
                  display: 'flex',
                  gap: '18px',
                  background: 'var(--md-sys-color-surface-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  borderRadius: '20px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--md-sys-color-primary)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--md-sys-color-outline-variant)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Poster Thumbnail */}
                <div style={{ width: '100px', height: '145px', flexShrink: 0, borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
                  <img src={anime.poster} alt={anime.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  <span
                    style={{
                      position: 'absolute',
                      top: '6px',
                      left: '6px',
                      background: 'rgba(0, 0, 0, 0.75)',
                      backdropFilter: 'blur(4px)',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '6px'
                    }}
                  >
                    {anime.type}
                  </span>
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    {/* Title & Rating */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '2px' }}>
                          {anime.title}
                        </h3>
                        {anime.romajiTitle && anime.romajiTitle !== anime.title && (
                          <div style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '8px' }}>
                            {anime.romajiTitle}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255, 235, 59, 0.15)', border: '1px solid rgba(255, 235, 59, 0.3)', borderRadius: '8px', padding: '3px 8px', flexShrink: 0 }}>
                        <Star size={12} fill="#ffeb3b" color="#ffeb3b" />
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffeb3b' }}>
                          {anime.rating.toFixed(1)}
                        </span>
                      </div>
                    </div>

                    {/* Meta Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--md-sys-color-primary)', background: 'var(--md-sys-color-surface-container-high)', padding: '2px 8px', borderRadius: '6px' }}>
                        {anime.season || anime.year}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)', background: 'var(--md-sys-color-surface-container-high)', padding: '2px 8px', borderRadius: '6px' }}>
                        {anime.type === 'Movie' ? 'Full Movie' : `${anime.episodesCount} Episodes`}
                      </span>
                      <span style={{ fontSize: '11px', color: anime.status === 'Airing' ? '#4caf50' : '#aaa', background: 'var(--md-sys-color-surface-container-high)', padding: '2px 8px', borderRadius: '6px' }}>
                        {anime.status}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                        Studio: <strong>{anime.studio}</strong>
                      </span>
                    </div>

                    {/* Synopsis */}
                    <p style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '10px' }}>
                      {anime.synopsis || 'No synopsis available.'}
                    </p>
                  </div>

                  {/* Genres & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {anime.genres.slice(0, 4).map(g => (
                        <span key={g} style={{ fontSize: '10px', fontWeight: 600, color: 'var(--md-sys-color-on-surface-variant)', background: 'var(--md-sys-color-surface-container-high)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '999px', padding: '2px 8px' }}>
                          {g}
                        </span>
                      ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openPlayer(anime);
                        }}
                        style={{
                          background: 'var(--md-sys-color-primary)',
                          color: 'var(--md-sys-color-on-primary)',
                          border: 'none',
                          borderRadius: '10px',
                          padding: '6px 14px',
                          fontSize: '12px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        <Play size={12} fill="currentColor" />
                        <span>Stream Now</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Load More Button */}
          {hasNextPage && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px' }}>
              <button
                className="section-btn"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                style={{ padding: '10px 32px', fontSize: '13px', background: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)', borderColor: 'var(--md-sys-color-primary)' }}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 size={14} className="spin-animation" />
                    <span>Loading more titles...</span>
                  </>
                ) : (
                  <span>Load More Titles</span>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
