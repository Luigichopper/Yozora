import React, { useState, useRef, useEffect } from 'react';
import { Star, Play, Plus, Check, FileDown, FileUp, Layers, Clock, TrendingUp, BarChart2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { anidbService } from '../services/anidbService';
import { AnimeItem, WatchStatus } from '../types/anime';

const STATUS_TABS: { key: WatchStatus | 'All'; label: string }[] = [
  { key: 'All', label: 'All (全部)' },
  { key: 'Watching', label: 'Watching (在看)' },
  { key: 'Plan to Watch', label: 'Plan to Watch (想看)' },
  { key: 'Completed', label: 'Completed (已看)' },
  { key: 'On Hold', label: 'On Hold (暂停)' },
  { key: 'Dropped', label: 'Dropped (搁置)' }
];

export const LibraryView: React.FC = () => {
  const { library, setAnimeStatus, setAnimeProgress, setAnimeScore, setSelectedAnime, openPlayer, showToast } = useApp();
  const [activeStatusTab, setActiveStatusTab] = useState<WatchStatus | 'All'>('All');
  const [animeMap, setAnimeMap] = useState<Record<string, AnimeItem>>({});
  const [editingScoreId, setEditingScoreId] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState<number>(8.5);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load full anime details for library items from anidbService
  useEffect(() => {
    async function loadLibraryAnime() {
      const map: Record<string, AnimeItem> = {};
      for (const id of Object.keys(library)) {
        const item = await anidbService.getAnimeById(id);
        if (item) map[id] = item;
      }
      setAnimeMap(map);
    }
    loadLibraryAnime();
  }, [library]);

  const entries = Object.values(library).map(entry => {
    const anime = animeMap[entry.animeId];
    return anime ? { anime, entry } : null;
  }).filter((item): item is { anime: AnimeItem; entry: typeof library[string] } => item !== null);

  const filteredEntries = entries.filter(({ entry }) => {
    if (activeStatusTab === 'All') return true;
    return entry.watchStatus === activeStatusTab;
  });

  // Real Analytics calculations
  const totalWatching = entries.filter(e => e.entry.watchStatus === 'Watching').length;
  const totalCompleted = entries.filter(e => e.entry.watchStatus === 'Completed').length;
  const totalEps = entries.reduce((acc, curr) => acc + curr.entry.currentEpisode, 0);
  const totalHoursWatched = ((totalEps * 24) / 60).toFixed(1);
  const meanScore = entries.length > 0
    ? (entries.reduce((acc, curr) => acc + (curr.entry.score || 8.0), 0) / entries.length).toFixed(1)
    : '0.0';

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
        myScore: e.entry.score || 8.0,
        lastWatchedAt: e.entry.lastWatchedAt
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yozora_anidb_library_${Date.now()}.json`;
    a.click();
    showToast('Exported AniDB sync file!', 'success');
  };

  const isValidLibraryExport = (data: any): boolean => {
    if (!data || typeof data !== 'object') return false;
    if (!Array.isArray(data.entries)) return false;
    for (const entry of data.entries) {
      if (!entry || (typeof entry.anidbId !== 'string' && typeof entry.anidbId !== 'number')) return false;
    }
    return true;
  };

  const handleImportAniDB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit
    if (file.size > MAX_FILE_SIZE_BYTES) {
      showToast('Import failed: File exceeds maximum allowed size (10 MB).', 'error');
      e.target.value = '';
      return;
    }

    if (file.type && file.type !== 'application/json' && !file.name.endsWith('.json')) {
      showToast('Import failed: Selected file must be a valid JSON file.', 'error');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!isValidLibraryExport(json)) {
          showToast('Import failed: Invalid Yozora library JSON schema.', 'error');
          return;
        }

        for (const item of json.entries) {
          const animeId = `a${item.anidbId}`;
          await setAnimeStatus(animeId, item.status || 'Watching');
          await setAnimeProgress(animeId, item.watchedEpisodes || 1);
          if (item.myScore) {
            await setAnimeScore(animeId, item.myScore);
          }
        }
        showToast(`Successfully imported ${json.entries.length} anime entries!`, 'success');
      } catch (err) {
        showToast('Failed to parse AniDB import JSON.', 'error');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="library-container">
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImportAniDB}
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
            追番资料库 • Anime Watchlist & Analytics
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}>
            Local-first SQLite/IndexedDB tracking synchronized with AniDB ID space
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="section-btn" onClick={() => fileInputRef.current?.click()} title="Import AniDB Sync JSON">
            <FileUp size={14} />
            <span>Import Sync</span>
          </button>
          <button className="section-btn" onClick={handleExportAniDB} title="Export AniDB Sync JSON">
            <FileDown size={14} />
            <span>Export Sync</span>
          </button>
        </div>
      </div>

      {/* Real Statistics Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--md-sys-color-surface-container)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '16px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)' }}>Currently Watching</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--md-sys-color-primary)', marginTop: '4px' }}>{totalWatching} titles</div>
        </div>

        <div style={{ background: 'var(--md-sys-color-surface-container)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '16px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)' }}>Completed Series</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#4caf50', marginTop: '4px' }}>{totalCompleted} titles</div>
        </div>

        <div style={{ background: 'var(--md-sys-color-surface-container)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '16px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)' }}>Watch Time (Hours)</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#ff9800', marginTop: '4px' }}>{totalHoursWatched} hrs</div>
        </div>

        <div style={{ background: 'var(--md-sys-color-surface-container)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '16px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)' }}>Mean Score</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#ffeb3b', marginTop: '4px' }}>★ {meanScore}</div>
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
            const isEditingScore = editingScoreId === anime.id;

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
                  gap: '20px'
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

                {/* Right: Personal Score & Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {/* Personal Score Input / Display */}
                  {isEditingScore ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--md-sys-color-surface-container-highest)', padding: '4px 10px', borderRadius: '10px' }}>
                      <span style={{ fontSize: '12px', color: '#ffeb3b' }}>★</span>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        value={scoreInput}
                        onChange={(e) => setScoreInput(parseFloat(e.target.value))}
                        style={{ width: '45px', background: 'transparent', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 700 }}
                      />
                      <button
                        className="section-btn"
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                        onClick={() => {
                          setAnimeScore(anime.id, scoreInput);
                          setEditingScoreId(null);
                        }}
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      className="section-btn"
                      style={{ padding: '6px 10px', fontSize: '12px', color: '#ffeb3b', borderColor: 'rgba(255,235,59,0.3)' }}
                      onClick={() => {
                        setScoreInput(entry.score || 8.0);
                        setEditingScoreId(anime.id);
                      }}
                      title="Edit Personal Score"
                    >
                      <Star size={13} fill="#ffeb3b" />
                      <span>{entry.score ? entry.score.toFixed(1) : 'Rate'}</span>
                    </button>
                  )}

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
                      const nextEpNum = Math.min(entry.totalEpisodes, entry.currentEpisode);
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
