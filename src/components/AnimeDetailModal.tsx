import React, { useState, useEffect } from 'react';
import { X, Play, Star, Plus, Check, Layers, Radio, ExternalLink, Calendar, Film, Bookmark, Loader2 } from 'lucide-react';
import { AnimeItem, Episode, TorrentSource, WatchStatus } from '../types/anime';
import { useApp } from '../context/AppContext';
import { sourceService } from '../services/sourceService';
import { rqbitService } from '../services/rqbitService';
import { anidbService } from '../services/anidbService';

interface AnimeDetailModalProps {
  anime: AnimeItem;
  onClose: () => void;
}

export const AnimeDetailModal: React.FC<AnimeDetailModalProps> = ({ anime, onClose }) => {
  const { openPlayer, library, setAnimeStatus, setAnimeProgress, showToast, setSelectedAnime } = useApp();

  const [activeTab, setActiveTab] = useState<'overview' | 'episodes' | 'sources'>('overview');
  const [sources, setSources] = useState<TorrentSource[]>([]);
  const [loadingSources, setLoadingSources] = useState<boolean>(false);

  const libraryEntry = library[anime.id];

  // Fetch real aggregated sources for this anime
  useEffect(() => {
    let isMounted = true;
    async function loadSources() {
      setLoadingSources(true);
      try {
        const srcList = await sourceService.getSourcesForAnime(anime.id, anime.title, anime.romajiTitle);
        if (isMounted) setSources(srcList);
      } catch (e) {
        console.error('Failed to load sources:', e);
      } finally {
        if (isMounted) setLoadingSources(false);
      }
    }
    loadSources();
    return () => { isMounted = false; };
  }, [anime.id, anime.title, anime.romajiTitle]);

  const episodeCountLabel = anime.type === 'Movie'
    ? 'Movie (1 ep)'
    : anime.episodesCount > 0
    ? `${anime.episodesCount} Episodes`
    : anime.status === 'Airing'
    ? `Airing (${anime.episodes.length} eps)`
    : 'TBA';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="m3-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Banner Hero */}
        <div style={{ position: 'relative', width: '100%', height: '240px', overflow: 'hidden' }}>
          <img
            src={anime.banner || anime.poster}
            alt={anime.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(21,18,24,0.95) 95%)'
            }}
          />

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>

          {/* Hero Header Content */}
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '24px',
              right: '24px',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '20px'
            }}
          >
            <img
              src={anime.poster}
              alt={anime.title}
              style={{
                width: '100px',
                height: '140px',
                objectFit: 'cover',
                borderRadius: '14px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
                border: '2px solid rgba(255,255,255,0.1)'
              }}
            />

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: 'rgba(2, 169, 255, 0.2)',
                    color: '#02a9ff',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    border: '1px solid rgba(2, 169, 255, 0.4)'
                  }}
                >
                  AniList #{anime.id}
                </span>
                <span
                  style={{
                    background: 'var(--md-sys-color-primary-container)',
                    color: 'var(--md-sys-color-on-primary-container)',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}
                >
                  {anime.type} • {anime.season}
                </span>
                <span
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}
                >
                  {episodeCountLabel}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ffeb3b', fontSize: '12px', fontWeight: 700 }}>
                  <Star size={12} fill="#ffeb3b" /> {anime.rating.toFixed(2)} ({anime.votesCount.toLocaleString()} votes)
                </span>
              </div>

              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{anime.title}</h2>
              <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '2px' }}>
                {anime.japaneseTitle} • {anime.studio}
              </p>
            </div>

            {/* Quick Play & Library Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                className="section-btn"
                style={{
                  background: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                  borderColor: 'var(--md-sys-color-primary)',
                  padding: '8px 18px',
                  fontWeight: 700
                }}
                onClick={() => {
                  onClose();
                  openPlayer(anime);
                }}
              >
                <Play size={16} fill="currentColor" />
                <span>{anime.type === 'Movie' ? 'Play Movie' : 'Play Ep 1'}</span>
              </button>

              <button
                className="section-btn"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  borderColor: 'var(--md-sys-color-outline-variant)',
                  padding: '8px 16px',
                  fontWeight: 600
                }}
                onClick={async () => {
                  showToast(`Connecting release & launching mpv for "${anime.title}"...`, 'info');
                  const s = await sourceService.getSourcesForAnime(anime.id, anime.title, anime.romajiTitle);
                  if (s.length > 0) {
                    const uri = sourceService.getSourceUri(s[0]);
                    if (!uri) {
                      showToast('No valid magnet link or .torrent URL found for this release', 'warning');
                      return;
                    }
                    try {
                      const res = await rqbitService.addTorrentAndGetStream(uri, anime.title);
                      if (res?.stream_url) {
                        await rqbitService.launchExternalMpv(res.stream_url, anime.title);
                        showToast('Launched in external mpv!', 'success');
                      }
                    } catch (err: any) {
                      showToast(err.message || 'Failed to start mpv', 'error');
                    }
                  } else {
                    showToast('No releases found for this title yet', 'warning');
                  }
                }}
              >
                <Play size={14} fill="currentColor" />
                <span>Play in mpv</span>
              </button>

              <select
                className="filter-select"
                value={libraryEntry ? libraryEntry.watchStatus : 'Not in List'}
                onChange={(e) => {
                  const val = e.target.value as WatchStatus;
                  setAnimeStatus(anime.id, val);
                }}
                style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid var(--md-sys-color-outline-variant)' }}
              >
                <option value="Not in List">+ Add to List</option>
                <option value="Watching">Watching (在看)</option>
                <option value="Plan to Watch">Plan to Watch (想看)</option>
                <option value="Completed">Completed (已看)</option>
                <option value="On Hold">On Hold (暂停)</option>
                <option value="Dropped">Dropped (搁置)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px', background: 'var(--md-sys-color-surface-container)' }}>
          <button
            className="nav-item"
            style={{ width: 'auto', padding: '12px 16px', borderRadius: 0, height: 'auto', borderBottom: activeTab === 'overview' ? '2px solid var(--md-sys-color-primary)' : 'none', color: activeTab === 'overview' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)' }}
            onClick={() => setActiveTab('overview')}
          >
            Overview (简介)
          </button>
          <button
            className="nav-item"
            style={{ width: 'auto', padding: '12px 16px', borderRadius: 0, height: 'auto', borderBottom: activeTab === 'episodes' ? '2px solid var(--md-sys-color-primary)' : 'none', color: activeTab === 'episodes' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)' }}
            onClick={() => setActiveTab('episodes')}
          >
            Episodes ({anime.type === 'Movie' ? 1 : anime.episodes.length || anime.episodesCount || 'TBA'})
          </button>
          <button
            className="nav-item"
            style={{ width: 'auto', padding: '12px 16px', borderRadius: 0, height: 'auto', borderBottom: activeTab === 'sources' ? '2px solid var(--md-sys-color-primary)' : 'none', color: activeTab === 'sources' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)' }}
            onClick={() => setActiveTab('sources')}
          >
            BT Sources & Feeds ({sources.length})
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ padding: '24px' }}>
          {activeTab === 'overview' && (
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--md-sys-color-primary)', marginBottom: '8px' }}>
                Synopsis
              </h3>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--md-sys-color-on-surface)', marginBottom: '20px' }}>
                {anime.synopsis}
              </p>

              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--md-sys-color-primary)', marginBottom: '10px' }}>
                Tags & Genres
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                {anime.genres.map(g => (
                  <span
                    key={g}
                    style={{
                      background: 'var(--md-sys-color-surface-container-high)',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      borderRadius: '999px',
                      padding: '4px 12px',
                      fontSize: '12px',
                      color: 'var(--md-sys-color-on-surface)'
                    }}
                  >
                    {g}
                  </span>
                ))}
                {anime.tags.map(t => (
                  <span
                    key={t}
                    style={{
                      background: 'var(--md-sys-color-surface-container-highest)',
                      borderRadius: '999px',
                      padding: '4px 12px',
                      fontSize: '12px',
                      color: 'var(--md-sys-color-on-surface-variant)'
                    }}
                  >
                    #{t}
                  </span>
                ))}
              </div>

              {/* Relations */}
              {anime.relations && anime.relations.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--md-sys-color-primary)', marginBottom: '10px' }}>
                    Related Anime (Relations Tree)
                  </h3>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {anime.relations.map(rel => (
                      <div
                        key={rel.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          background: 'var(--md-sys-color-surface-container-high)',
                          padding: '8px 14px',
                          borderRadius: '12px',
                          border: '1px solid var(--md-sys-color-outline-variant)',
                          cursor: 'pointer'
                        }}
                        onClick={async () => {
                          if (rel.relationAnimeId) {
                            const relAnime = await anidbService.getAnimeById(rel.relationAnimeId);
                            if (relAnime) {
                              setSelectedAnime(relAnime);
                            }
                          }
                        }}
                        title="Click to view details"
                      >
                        <img src={rel.poster} alt={rel.title} style={{ width: '36px', height: '50px', objectFit: 'cover', borderRadius: '6px' }} />
                        <div>
                          <span style={{ fontSize: '10px', color: 'var(--md-sys-color-primary)', fontWeight: 600 }}>{rel.type}</span>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{rel.title}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'episodes' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
              {(anime.episodes.length > 0 ? anime.episodes : Array.from({ length: anime.episodesCount || 12 }, (_, i) => ({
                id: i + 1,
                epNumber: i + 1,
                title: `Episode ${i + 1}`,
                airDate: anime.airDateStart,
                durationMinutes: 24,
                opSkipStart: 90,
                opSkipEnd: 180
              }))).map((ep: Episode) => {
                const isWatched = libraryEntry && libraryEntry.currentEpisode >= ep.epNumber;
                return (
                  <div
                    key={ep.id}
                    style={{
                      background: 'var(--md-sys-color-surface-container-high)',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      borderRadius: '14px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s ease'
                    }}
                    onClick={() => {
                      onClose();
                      openPlayer(anime, ep);
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                        EP {ep.epNumber.toString().padStart(2, '0')}: {ep.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '3px' }}>
                        {ep.durationMinutes}m • {ep.airDate}
                        {ep.opSkipEnd && <span style={{ marginLeft: '6px', color: 'var(--md-sys-color-primary)' }}>• OP Skip (90s)</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAnimeProgress(anime.id, ep.epNumber);
                        }}
                        style={{
                          background: isWatched ? 'var(--md-sys-color-primary-container)' : 'transparent',
                          border: '1px solid var(--md-sys-color-outline-variant)',
                          color: isWatched ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-outline)',
                          borderRadius: '50%',
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        title={isWatched ? 'Watched' : 'Mark Watched'}
                      >
                        <Check size={14} />
                      </button>

                      <button
                        style={{
                          background: 'var(--md-sys-color-primary)',
                          color: 'var(--md-sys-color-on-primary)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        title="Stream Episode"
                      >
                        <Play size={14} fill="currentColor" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'sources' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '6px' }}>
                Aggregated from user-enabled BT trackers & RSS indexers (Nyaa, Mikan, Anime Garden). Rank scored by swarm health.
              </div>

              {loadingSources ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '10px', color: 'var(--md-sys-color-primary)' }}>
                  <Loader2 size={20} className="animate-spin" />
                  <span style={{ fontSize: '13px' }}>Aggregating release sources from RSS swarms...</span>
                </div>
              ) : sources.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                  No torrent releases found for this title.
                </div>
              ) : (
                sources.map(src => (
                  <div
                    key={src.id}
                    style={{
                      background: 'var(--md-sys-color-surface-container-high)',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      borderRadius: '16px',
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--md-sys-color-primary)', background: 'var(--md-sys-color-primary-container)', padding: '2px 8px', borderRadius: '4px' }}>
                          {src.group}
                        </span>
                        <span style={{ fontSize: '11px', color: '#ff9800', background: 'rgba(255,152,0,0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                          {src.resolution} • {src.codec}
                        </span>
                        <span style={{ fontSize: '11px', color: '#90caf9', background: 'rgba(144,202,249,0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                          {src.audio}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                          Provider: {src.provider}
                        </span>
                      </div>

                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                        {src.title}
                      </div>

                      <div style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px', display: 'flex', gap: '14px' }}>
                        <span style={{ color: '#4caf50', fontWeight: 600 }}>▲ {src.seeders} seeders</span>
                        <span style={{ color: '#f44336' }}>▼ {src.leechers} leechers</span>
                        <span>📦 {src.fileSize}</span>
                        <span>🕒 {src.uploadedDate}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="section-btn"
                        style={{ background: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)', borderColor: 'var(--md-sys-color-primary)', padding: '8px 16px', fontWeight: 700 }}
                        onClick={async () => {
                          const uri = sourceService.getSourceUri(src);
                          if (!uri) {
                            showToast('No valid magnet link or .torrent URL found for this release', 'error');
                            return;
                          }
                          try {
                            showToast(`Connecting to BT swarm for "${anime.title}"...`, 'info');
                            const streamRes = await rqbitService.addTorrentAndGetStream(uri, anime.title);
                            onClose();
                            openPlayer(anime, anime.episodes[0], streamRes.stream_url, src.title);
                          } catch (err: any) {
                            showToast(err.message || 'rqbit BitTorrent engine offline. Please start rqbit in Settings.', 'error');
                          }
                        }}
                      >
                        <Play size={14} fill="currentColor" />
                        <span>Direct Stream</span>
                      </button>

                      <button
                        className="section-btn"
                        style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.08)' }}
                        onClick={async () => {
                          const uri = sourceService.getSourceUri(src);
                          if (!uri) {
                            showToast('No valid magnet link or .torrent URL found for this release', 'error');
                            return;
                          }
                          try {
                            showToast(`Connecting & launching mpv for "${src.title}"...`, 'info');
                            const streamRes = await rqbitService.addTorrentAndGetStream(uri, anime.title);
                            if (streamRes?.stream_url) {
                              await rqbitService.launchExternalMpv(streamRes.stream_url, anime.title);
                              showToast('Launched in mpv player!', 'success');
                            }
                          } catch (err: any) {
                            showToast(err.message || 'Failed to start mpv', 'error');
                          }
                        }}
                        title="Play in external hardware-accelerated mpv"
                      >
                        <Play size={14} fill="currentColor" />
                        <span>mpv</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
