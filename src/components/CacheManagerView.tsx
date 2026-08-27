import React, { useState } from 'react';
import { HardDriveDownload, Play, Pause, Trash2, ArrowDown, ArrowUp, Plus, CheckCircle, Radio, FolderOpen } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { anidbService } from '../services/anidbService';

export const CacheManagerView: React.FC = () => {
  const { downloadTasks, toggleDownloadPause, deleteDownloadTask, addCustomMagnetTask, openPlayer, showToast } = useApp();
  const [customMagnetInput, setCustomMagnetInput] = useState('');
  const [showAddMagnetModal, setShowAddMagnetModal] = useState(false);

  const totalDownloadSpeed = downloadTasks.reduce((acc, curr) => acc + (curr.status === 'downloading' ? curr.downloadSpeed : 0), 0);
  const totalUploadSpeed = downloadTasks.reduce((acc, curr) => acc + curr.uploadSpeed, 0);
  const totalDownloadedBytes = downloadTasks.reduce((acc, curr) => acc + curr.downloadedBytes, 0);
  const totalGB = (totalDownloadedBytes / (1024 * 1024 * 1024)).toFixed(2);

  const handleAddMagnet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMagnetInput.trim()) return;
    const success = await addCustomMagnetTask(customMagnetInput.trim());
    if (success) {
      setCustomMagnetInput('');
      setShowAddMagnetModal(false);
    }
  };

  return (
    <div className="cache-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
            离线缓存与种子管理器 • Torrent Cache Manager
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}>
            Embedded BitTorrent swarm cache engine & offline media storage
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="section-btn" onClick={() => setShowAddMagnetModal(true)}>
            <Plus size={14} />
            <span>Add Magnet Link</span>
          </button>
        </div>
      </div>

      {/* Speed & Cache Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--md-sys-color-surface-container)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#4caf50' }}>
            <ArrowDown size={14} />
            <span>Download Throughput</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {(totalDownloadSpeed / 1024).toFixed(1)} MB/s
          </div>
        </div>

        <div style={{ background: 'var(--md-sys-color-surface-container)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--md-sys-color-primary)' }}>
            <ArrowUp size={14} />
            <span>Upload Throughput</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {(totalUploadSpeed / 1024).toFixed(1)} MB/s
          </div>
        </div>

        <div style={{ background: 'var(--md-sys-color-surface-container)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '16px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)' }}>Cache Storage Quota</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#ff9800', marginTop: '4px' }}>
            {totalGB} GB / 50.0 GB
          </div>
        </div>
      </div>

      {/* Download Tasks List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {downloadTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--md-sys-color-on-surface-variant)' }}>
            No active downloads or cached torrents. Select "Download Cache" on any episode source to start.
          </div>
        ) : (
          downloadTasks.map(task => {
            const isCompleted = task.status === 'completed' || task.status === 'seeding';

            return (
              <div
                key={task.id}
                style={{
                  background: 'var(--md-sys-color-surface-container-high)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  borderRadius: '18px',
                  padding: '16px 20px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        background: isCompleted ? 'rgba(76, 175, 80, 0.2)' : 'var(--md-sys-color-primary-container)',
                        color: isCompleted ? '#4caf50' : 'var(--md-sys-color-on-primary-container)',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px'
                      }}
                    >
                      {task.status.toUpperCase()}
                    </span>

                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                      {task.sourceTitle}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Play Button */}
                    <button
                      className="poster-overlay-play"
                      style={{ position: 'static', width: '32px', height: '32px' }}
                      onClick={async () => {
                        const anime = await anidbService.getAnimeById(task.animeId);
                        if (anime) {
                          const ep = anime.episodes.find(e => e.epNumber === task.episodeNum) || anime.episodes[0];
                          openPlayer(anime, ep, task.videoUrl, task.sourceTitle);
                        } else {
                          // Custom magnet playback
                          openPlayer({
                            id: 'custom',
                            anidbId: 99999,
                            title: task.animeTitle,
                            romajiTitle: task.animeTitle,
                            japaneseTitle: task.animeTitle,
                            type: 'TV',
                            status: 'Finished',
                            episodesCount: 1,
                            season: '2025',
                            year: 2025,
                            rating: 8.5,
                            votesCount: 100,
                            poster: '',
                            banner: '',
                            synopsis: 'BitTorrent Swarm Cached Video Stream',
                            genres: ['Cached'],
                            tags: ['Offline'],
                            studio: 'BitTorrent Swarm',
                            airDateStart: '2025-01-01',
                            episodes: [{ id: 1, epNumber: 1, title: task.sourceTitle, airDate: '2025-01-01', durationMinutes: 24 }],
                            relations: []
                          }, undefined, task.videoUrl, task.sourceTitle);
                        }
                      }}
                      title="Play Offline Video"
                    >
                      <Play size={14} fill="currentColor" />
                    </button>

                    {/* Pause / Resume button */}
                    {!isCompleted && (
                      <button
                        className="section-btn"
                        style={{ padding: '6px 10px' }}
                        onClick={() => toggleDownloadPause(task.id)}
                      >
                        {task.status === 'downloading' ? <Pause size={13} /> : <Play size={13} />}
                      </button>
                    )}

                    {/* Delete button */}
                    <button
                      className="section-btn"
                      style={{ padding: '6px 10px', color: '#f44336', borderColor: 'rgba(244,67,54,0.3)' }}
                      onClick={() => deleteDownloadTask(task.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="progress-bar-wrap" style={{ height: '6px', marginBottom: '8px' }}>
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${task.progress}%`,
                      background: isCompleted ? '#4caf50' : 'var(--md-sys-color-primary)'
                    }}
                  />
                </div>

                {/* Speed & Metadata Info */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                  <div style={{ display: 'flex', gap: '14px' }}>
                    <span>{task.progress}% ({((task.downloadedBytes / (1024 * 1024 * 1024))).toFixed(2)} GB / {task.fileSize})</span>
                    <span>Peers: {task.peers}</span>
                    {task.status === 'downloading' && (
                      <span>ETA: ~{task.etaSeconds}s</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '14px' }}>
                    {task.downloadSpeed > 0 && (
                      <span style={{ color: '#4caf50', fontWeight: 600 }}>▼ {(task.downloadSpeed / 1024).toFixed(1)} MB/s</span>
                    )}
                    <span style={{ color: 'var(--md-sys-color-primary)' }}>▲ {task.uploadSpeed} KB/s</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Magnet Modal */}
      {showAddMagnetModal && (
        <div className="modal-overlay" onClick={() => setShowAddMagnetModal(false)}>
          <div className="m3-dialog" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
                Add Custom Magnet Link / Torrent URI
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '16px' }}>
                Supports standard BitTorrent magnets (urn:btih:...) and direct torrent HTTP/HTTPS links.
              </p>

              <form onSubmit={handleAddMagnet}>
                <textarea
                  placeholder="magnet:?xt=urn:btih:3fa82b49e19d7b92138e6e58f00bbca4b76a0841&dn=Anime+Title..."
                  value={customMagnetInput}
                  onChange={(e) => setCustomMagnetInput(e.target.value)}
                  style={{
                    width: '100%',
                    height: '100px',
                    background: 'var(--md-sys-color-surface-container-high)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    borderRadius: '12px',
                    padding: '12px',
                    color: '#fff',
                    fontSize: '13px',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                    resize: 'none',
                    marginBottom: '16px'
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    className="section-btn"
                    onClick={() => setShowAddMagnetModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="section-btn"
                    style={{
                      background: 'var(--md-sys-color-primary)',
                      color: 'var(--md-sys-color-on-primary)',
                      borderColor: 'var(--md-sys-color-primary)',
                      fontWeight: 700
                    }}
                  >
                    Start Download
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
