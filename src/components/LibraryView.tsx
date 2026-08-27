import React, { useState } from 'react';
import { Star, Play, Plus, Check, FileDown, Layers, Clock, TrendingUp } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MOCK_ANIME_DATABASE } from '../data/mockAniDB';
import { WatchStatus } from '../types/anime';

const STATUS_TABS: { key: WatchStatus | 'All'; label: string }[] = [
  { key: 'All', label: 'All (全部)' },
  { key: 'Watching', label: 'Watching (在看)' },
  { key: 'Plan to Watch', label: 'Plan to Watch (想看)' },
  { key: 'Completed', label: 'Completed (已看)' },
  { key: 'On Hold', label: 'On Hold (暂停)' },
  { key: 'Dropped', label: 'Dropped (搁置)' }
];

export const LibraryView: React.FC = () => {
  const { library, setAnimeStatus, setAnimeProgress, setSelectedAnime, openPlayer } = useApp();
  const [activeStatusTab, setActiveStatusTab] = useState<WatchStatus | 'All'>('All');

  // Match library entries with database
  const entries = Object.values(library).map(entry => {
    const anime = MOCK_ANIME_DATABASE.find(a => a.id === entry.animeId);
    return anime ? { anime, entry } : null;
  }).filter((item): item is { anime: typeof MOCK_ANIME_DATABASE[0]; entry: typeof library[string] } => item !== null);

  const filteredEntries = entries.filter(({ entry }) => {
    if (activeStatusTab === 'All') return true;
    return entry.watchStatus === activeStatusTab;
  });

  const totalWatching = entries.filter(e => e.entry.watchStatus === 'Watching').length;
  const totalCompleted = entries.filter(e => e.entry.watchStatus === 'Completed').length;
  const totalEps = entries.reduce((acc, curr) => acc + curr.entry.currentEpisode, 0);

  const handleExportAniDB = () => {
    const exportData = {
      client: 'Yozora 0.1.0',
      exportedAt: new Date().toISOString(),
      entries: entries.map(e => ({
        anidbId: e.anime.anidbId,
        title: e.anime.title,
        status: e.entry.watchStatus,
        watchedEpisodes: e.entry.currentEpisode,
        totalEpisodes: e.entry.totalEpisodes,
        myScore: e.entry.score
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yozora_anidb_library_${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="library-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
            追番资料库 • Anime Watchlist
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}>
            Local-first tracking synchronized with AniDB ID space
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="section-btn" onClick={handleExportAniDB} title="Export AniDB Sync JSON">
            <FileDown size={14} />
            <span>Export AniDB Sync</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--md-sys-color-surface-container)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '16px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)' }}>Currently Watching</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--md-sys-color-primary)', marginTop: '4px' }}>{totalWatching} titles</div>
        </div>

        <div style={{ background: 'var(--md-sys-color-surface-container)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '16px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)' }}>Completed</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#4caf50', marginTop: '4px' }}>{totalCompleted} titles</div>
        </div>

        <div style={{ background: 'var(--md-sys-color-surface-container)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '16px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)' }}>Episodes Logged</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#ff9800', marginTop: '4px' }}>{totalEps} episodes</div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '20px' }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            className="section-btn"
            style={{
              background: activeStatusTab === tab.key ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container)',
              color: activeStatusTab === tab.key ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface-variant)',
              borderColor: activeStatusTab === tab.key ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'
            }}
            onClick={() => setActiveStatusTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Entry Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredEntries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--md-sys-color-on-surface-variant)' }}>
            No anime entries in this status filter. Browse AniDB to add series to your watchlist.
          </div>
        ) : (
          filteredEntries.map(({ anime, entry }) => {
            const progressPercent = Math.round((entry.currentEpisode / entry.totalEpisodes) * 100);
            return (
              <div
                key={anime.id}
                style={{
                  background: 'var(--md-sys-color-surface-container-high)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  borderRadius: '18px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '20px',
                  transition: 'border-color 0.2s ease'
                }}
              >
                {/* Left: Thumbnail & Info */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, cursor: 'pointer' }}
                  onClick={() => setSelectedAnime(anime)}
                >
                  <img
                    src={anime.poster}
                    alt={anime.title}
                    style={{ width: '60px', height: '85px', objectFit: 'cover', borderRadius: '12px' }}
                  />

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#ff9800', background: 'rgba(255,152,0,0.15)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        AniDB #{anime.anidbId}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--md-sys-color-primary)', fontWeight: 600 }}>
                        {anime.season}
                      </span>
                    </div>

                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                      {anime.title}
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '2px' }}>
                      {anime.japaneseTitle} • {anime.studio}
                    </div>

                    {/* Progress slider bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', maxWidth: '300px' }}>
                      <div className="progress-bar-wrap" style={{ flex: 1, height: '5px' }}>
                        <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)', fontWeight: 600 }}>
                        {entry.currentEpisode} / {entry.totalEpisodes} ({progressPercent}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {/* +1 Episode Quick Increment Button */}
                  <button
                    className="section-btn"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    onClick={() => {
                      if (entry.currentEpisode < entry.totalEpisodes) {
                        setAnimeProgress(anime.id, entry.currentEpisode + 1);
                      }
                    }}
                    title="Increment +1 Episode"
                  >
                    <Plus size={13} />
                    <span>EP +1</span>
                  </button>

                  {/* Status Dropdown */}
                  <select
                    className="filter-select"
                    value={entry.watchStatus}
                    onChange={(e) => setAnimeStatus(anime.id, e.target.value as WatchStatus)}
                    style={{ fontSize: '12px', padding: '6px 10px' }}
                  >
                    <option value="Watching">Watching</option>
                    <option value="Plan to Watch">Plan to Watch</option>
                    <option value="Completed">Completed</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Dropped">Dropped</option>
                  </select>

                  {/* Play Next Button */}
                  <button
                    className="poster-overlay-play"
                    style={{ position: 'static', width: '36px', height: '36px' }}
                    onClick={() => {
                      const nextEpNum = Math.min(entry.totalEpisodes, entry.currentEpisode + 1);
                      const ep = anime.episodes.find(e => e.epNumber === nextEpNum) || anime.episodes[0];
                      openPlayer(anime, ep);
                    }}
                    title={`Resume Ep ${entry.currentEpisode}`}
                  >
                    <Play size={16} fill="currentColor" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
