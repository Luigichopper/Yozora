import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  X,
  RotateCcw,
  RotateCw,
  FastForward,
  Activity,
  FolderOpen,
  Link,
  RefreshCw,
  Film,
  Check,
  AlertCircle,
  Radio
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { streamService, AnimeStreamSource } from '../services/streamService';
import { rqbitService } from '../services/rqbitService';
import { torrentEngine } from '../services/torrentEngine';

import { db } from '../services/db';

export const PlayerView: React.FC = () => {
  const {
    playerState,
    closePlayer,
    showToast
  } = useApp();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hlsInstanceRef = useRef<any>(null);

  const [currentVideoSrc, setCurrentVideoSrc] = useState<string>(playerState?.videoUrl || '');
  const [streamMirrors, setStreamMirrors] = useState<AnimeStreamSource[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoadingStream, setIsLoadingStream] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(1440);
  const [bufferedTime, setBufferedTime] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showStatsForNerds, setShowStatsForNerds] = useState<boolean>(false);
  const [showUrlDialog, setShowUrlDialog] = useState<boolean>(false);
  const [customStreamUrl, setCustomStreamUrl] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [needsUserClickToStart, setNeedsUserClickToStart] = useState<boolean>(false);
  const [autoSkipOp, setAutoSkipOp] = useState<boolean>(true);
  const [hasVideoError, setHasVideoError] = useState<boolean>(false);

  // Seekbar scrubbing preview state
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPositionX, setHoverPositionX] = useState<number>(0);

  // Live Playback Telemetry
  const [telemetry, setTelemetry] = useState({
    videoWidth: 1920,
    videoHeight: 1080,
    fps: 60,
    droppedFrames: 0,
    bitrateKbps: 8420,
    bufferPercent: 0
  });

  const controlsTimeoutRef = useRef<number | null>(null);
  const lastOpSkipTriggerRef = useRef<boolean>(false);

  // Initialize player state
  useEffect(() => {
    if (playerState) {
      const initPlayer = async () => {
        setHasVideoError(false);
        const preferExternalMpv = await db.getSetting<boolean>('use_external_mpv', false);

        // 1. If a direct / cached video URL is already present, start playing it immediately
        if (playerState.videoUrl && playerState.videoUrl.trim()) {
          setCurrentVideoSrc(playerState.videoUrl);
          setIsLoadingStream(false);
          if (preferExternalMpv) {
            try {
              await rqbitService.launchExternalMpv(playerState.videoUrl, playerState.anime.title);
              showToast(`Launched external mpv for "${playerState.anime.title}"`, 'success');
            } catch (err: any) {
              showToast(err.message || 'Failed to launch mpv', 'error');
            }
          }
          return;
        }

        // 2. Otherwise dynamically resolve streams & BitTorrent sources
        setIsLoadingStream(true);
        try {
          const resolved = await streamService.resolveEpisodeStream(
            playerState.anime.id,
            playerState.anime.title,
            playerState.anime.romajiTitle,
            playerState.episode.epNumber
          );
          setStreamMirrors(resolved);

          if (resolved.length > 0) {
            const top = resolved[0];
            let activeUrl = top.url || '';

            if (activeUrl && activeUrl.trim()) {
              setCurrentVideoSrc(activeUrl);
            } else if (top.torrentSource?.magnetLink) {
              // Try rqbit daemon streaming first
              try {
                const res = await rqbitService.addTorrentAndGetStream(top.torrentSource.magnetLink, playerState.anime.title);
                if (res?.stream_url) {
                  activeUrl = res.stream_url;
                  setCurrentVideoSrc(res.stream_url);
                  showToast(`rqbit sequential streaming active on ${res.stream_url}`, 'success');
                }
              } catch (rqbitErr) {
                // Fallback to WebTorrent
                const video = videoRef.current;
                if (video) {
                  await torrentEngine.streamToVideoElement(top.torrentSource.magnetLink, video);
                  setIsPlaying(true);
                  showToast('Streaming via in-browser WebTorrent swarm', 'info');
                }
              }
            }

            if (preferExternalMpv && activeUrl) {
              try {
                await rqbitService.launchExternalMpv(activeUrl, playerState.anime.title);
                showToast(`Launched external mpv for "${playerState.anime.title}"`, 'success');
              } catch (err: any) {
                console.warn('Failed to launch external mpv:', err);
              }
            }
          } else {
            showToast('No stream sources found for this title. Try adding a custom magnet in Cache Manager.', 'warning');
          }
        } catch (err) {
          console.warn('[Player] Stream resolution error:', err);
        } finally {
          setIsLoadingStream(false);
        }
      };

      initPlayer();
    }
  }, [playerState]);

  // Handle Video Source and Hls.js setup
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentVideoSrc) return;

    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }

    const hls = streamService.attachHlsPlayer(video, currentVideoSrc, () => {
      video.play().then(() => {
        setIsPlaying(true);
        setNeedsUserClickToStart(false);
        setHasVideoError(false);
      }).catch((err) => {
        console.warn('Autoplay prevented:', err);
        setNeedsUserClickToStart(true);
      });
    });

    if (hls) {
      hlsInstanceRef.current = hls;
    } else {
      video.load();
      video.play().then(() => {
        setIsPlaying(true);
        setNeedsUserClickToStart(false);
        setHasVideoError(false);
      }).catch((err) => {
        console.warn('Autoplay blocked:', err);
        setNeedsUserClickToStart(true);
      });
    }

    return () => {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
    };
  }, [currentVideoSrc]);

  // Video time & buffer tracking
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const cur = video.currentTime;
    setCurrentTime(cur);

    if (video.buffered.length > 0) {
      const bufEnd = video.buffered.end(video.buffered.length - 1);
      setBufferedTime(bufEnd);
    }

    // Auto Skip Opening
    if (autoSkipOp && playerState?.episode.opSkipEnd) {
      const start = playerState.episode.opSkipStart || 90;
      const end = playerState.episode.opSkipEnd;
      if (cur >= start && cur < end && !lastOpSkipTriggerRef.current) {
        lastOpSkipTriggerRef.current = true;
        video.currentTime = end;
        showToast(`Auto-skipped Opening (OP) to ${formatTime(end)}`, 'info');
      } else if (cur < start || cur > end) {
        lastOpSkipTriggerRef.current = false;
      }
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 1440);
    setTelemetry(prev => ({
      ...prev,
      videoWidth: video.videoWidth || 1920,
      videoHeight: video.videoHeight || 1080
    }));
  };

  // Video error handling
  const handleVideoError = () => {
    console.warn(`[Player] Video load error on source: ${currentVideoSrc}`);
    setHasVideoError(true);
    setIsPlaying(false);
  };

  // Switch Stream Mirror
  const handleSwitchMirror = async (mirror: AnimeStreamSource) => {
    if (mirror.url && mirror.url.trim()) {
      setCurrentVideoSrc(mirror.url);
      setHasVideoError(false);
      showToast(`Switched to stream: ${mirror.server}`, 'info');
    } else if (mirror.torrentSource?.magnetLink) {
      showToast(`Connecting to BitTorrent stream for ${mirror.server}...`, 'info');
      try {
        const res = await rqbitService.addTorrentAndGetStream(mirror.torrentSource.magnetLink, playerState?.anime.title || 'Anime');
        if (res?.stream_url) {
          setCurrentVideoSrc(res.stream_url);
          setHasVideoError(false);
          showToast(`rqbit streaming active on ${res.stream_url}`, 'success');
          return;
        }
      } catch (e) {
        const video = videoRef.current;
        if (video) {
          await torrentEngine.streamToVideoElement(mirror.torrentSource.magnetLink, video);
          setIsPlaying(true);
          setHasVideoError(false);
          showToast('Streaming via in-browser WebTorrent swarm', 'info');
        }
      }
    }
  };

  const lastTotalFramesRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(Date.now());

  // Update Telemetry & dropped frames
  useEffect(() => {
    const interval = window.setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      let dropped = 0;
      let calculatedFps = 60;
      const now = Date.now();
      const timeDelta = (now - lastFpsTimeRef.current) / 1000;

      if ((video as any).getVideoPlaybackQuality) {
        const q = (video as any).getVideoPlaybackQuality();
        dropped = q.droppedVideoFrames || 0;
        const total = q.totalVideoFrames || 0;
        if (timeDelta > 0 && lastTotalFramesRef.current > 0 && total >= lastTotalFramesRef.current) {
          calculatedFps = Math.min(144, Math.max(0, Math.round((total - lastTotalFramesRef.current) / timeDelta)));
        }
        lastTotalFramesRef.current = total;
        lastFpsTimeRef.current = now;
      }

      // Bitrate from HLS levels if available
      let liveBitrate = 8420;
      if (hlsInstanceRef.current?.levels && hlsInstanceRef.current?.currentLevel >= 0) {
        const lvl = hlsInstanceRef.current.levels[hlsInstanceRef.current.currentLevel];
        if (lvl?.bitrate) {
          liveBitrate = Math.round(lvl.bitrate / 1000);
        }
      }

      const dur = duration || 1440;
      const bufPct = Math.min(100, Math.round((bufferedTime / dur) * 100));

      setTelemetry(prev => ({
        ...prev,
        fps: calculatedFps > 0 ? calculatedFps : prev.fps,
        bitrateKbps: liveBitrate,
        droppedFrames: dropped,
        bufferPercent: bufPct
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [bufferedTime, duration]);

  // Controls auto-hide
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3500);
  };

  // Keybindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement).tagName.toLowerCase())) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekDelta(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekDelta(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          adjustVolume(0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          adjustVolume(-0.1);
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'Escape':
          if (isFullscreen) toggleFullscreen();
          else closePlayer();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isFullscreen, volume, isMuted, currentTime, duration]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
        setNeedsUserClickToStart(false);
      }).catch(console.error);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const seekDelta = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    const nextTime = Math.max(0, Math.min(duration, video.currentTime + delta));
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const adjustVolume = (delta: number) => {
    const nextVol = Math.max(0, Math.min(1, volume + delta));
    setVolume(nextVol);
    if (videoRef.current) {
      videoRef.current.volume = nextVol;
      videoRef.current.muted = false;
    }
    setIsMuted(false);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    showToast(`Playback speed: ${speed}x`, 'info');
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const target = pos * duration;
    setCurrentTime(target);
    if (videoRef.current) {
      videoRef.current.currentTime = target;
    }
  };

  const handleSeekbarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(pos * duration);
    setHoverPositionX(e.clientX - rect.left);
  };

  const handleSeekbarMouseLeave = () => {
    setHoverTime(null);
  };

  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCurrentVideoSrc(url);
      setHasVideoError(false);
      showToast(`Loaded local file: ${file.name}`, 'success');
    }
  };

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStreamUrl.trim()) {
      setCurrentVideoSrc(customStreamUrl.trim());
      setShowUrlDialog(false);
      setHasVideoError(false);
      showToast('Loaded custom stream endpoint', 'info');
    }
  };

  const skipOp = () => {
    const opTarget = playerState?.episode.opSkipEnd || (currentTime + 90);
    setCurrentTime(opTarget);
    if (videoRef.current) {
      videoRef.current.currentTime = opTarget;
    }
    showToast(`Skipped opening to ${formatTime(opTarget)}`, 'info');
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!playerState) return null;

  return (
    <div
      ref={containerRef}
      className="mpv-player-container"
      onMouseMove={handleMouseMove}
    >
      <input
        type="file"
        ref={fileInputRef}
        accept="video/*"
        style={{ display: 'none' }}
        onChange={handleLocalFileSelect}
      />

      {/* HTML5 Video Surface */}
      <video
        ref={videoRef}
        className="mpv-video-surface"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onError={handleVideoError}
        playsInline
      />

      {/* Stream Resolving & Swarm Connection Overlay */}
      {isLoadingStream && !currentVideoSrc && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(16px)',
            zIndex: 36
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              border: '4px solid rgba(255,255,255,0.1)',
              borderTopColor: 'var(--md-sys-color-primary)',
              animation: 'spin 1s linear infinite',
              marginBottom: '16px'
            }}
          />
          <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#fff' }}>Connecting to BitTorrent Swarm...</h3>
          <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '6px' }}>
            Resolving optimal 1080p release for {playerState.anime.title} (EP {playerState.episode.epNumber})
          </p>
        </div>
      )}

      {/* Click to start / Resume Playback overlay */}
      {needsUserClickToStart && !isPlaying && !isLoadingStream && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(10px)',
            zIndex: 35
          }}
          onClick={togglePlay}
        >
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 30px var(--md-sys-color-primary)',
              cursor: 'pointer',
              marginBottom: '16px'
            }}
          >
            <Play size={36} fill="currentColor" style={{ marginLeft: '4px' }} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>Click to Play Episode</h3>
          <p style={{ fontSize: '13px', color: 'var(--md-sys-color-primary)', marginTop: '4px' }}>
            {playerState.anime.title} — EP {playerState.episode.epNumber}
          </p>
        </div>
      )}

      {/* Video / Stream Error & Mirror Switcher Overlay */}
      {(hasVideoError || (!isLoadingStream && !currentVideoSrc)) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(10, 8, 14, 0.92)',
            backdropFilter: 'blur(16px)',
            zIndex: 36,
            padding: '24px'
          }}
        >
          <AlertCircle size={44} color="var(--md-sys-color-primary)" style={{ marginBottom: '12px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
            {hasVideoError ? 'Playback Stream Unreachable' : 'Stream Resolving & Mirror Selection'}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', textAlign: 'center', maxWidth: '480px', marginBottom: '20px' }}>
            {hasVideoError
              ? 'Current stream endpoint is not responding. Choose an alternate mirror, load a local file, or provide a custom stream URL.'
              : `No direct mirror was found automatically for "${playerState.anime.title}". Pick a stream mirror below or enter a magnet link.`}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '440px', marginBottom: '20px' }}>
            {streamMirrors.map((mirror, idx) => (
              <button
                key={idx}
                onClick={() => handleSwitchMirror(mirror)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: currentVideoSrc === mirror.url ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-high)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  borderRadius: '12px',
                  padding: '10px 16px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Radio size={16} color="var(--md-sys-color-primary)" />
                  <span style={{ fontWeight: 600 }}>{mirror.server}</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--md-sys-color-primary)' }}>{mirror.quality}</span>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              className="section-btn"
              onClick={async () => {
                const target = currentVideoSrc || (streamMirrors.length > 0 ? streamMirrors[0].url : '');
                if (target) {
                  showToast(`Launching mpv for "${playerState.anime.title}"...`, 'info');
                  await rqbitService.launchExternalMpv(target, playerState.anime.title);
                } else if (streamMirrors.length > 0 && streamMirrors[0].torrentSource?.magnetLink) {
                  showToast(`Connecting to rqbit & launching mpv...`, 'info');
                  try {
                    const res = await rqbitService.addTorrentAndGetStream(streamMirrors[0].torrentSource.magnetLink, playerState.anime.title);
                    if (res?.stream_url) {
                      await rqbitService.launchExternalMpv(res.stream_url, playerState.anime.title);
                    }
                  } catch (e: any) {
                    showToast(e.message || 'Failed to start mpv', 'error');
                  }
                } else {
                  showToast('No active stream URL to send to mpv', 'warning');
                }
              }}
              style={{ background: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)', border: 'none', fontWeight: 700 }}
            >
              <Play size={16} fill="currentColor" />
              <span>Launch in mpv Player</span>
            </button>

            <button
              className="section-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <FolderOpen size={16} />
              <span>Open Local File</span>
            </button>

            <button
              className="section-btn"
              onClick={() => setShowUrlDialog(true)}
            >
              <Link size={16} />
              <span>Custom Stream URL</span>
            </button>
          </div>
        </div>
      )}

      {/* Stats for Nerds / mpv OSD overlay */}
      {showStatsForNerds && (
        <div className="stats-for-nerds">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 800, color: 'var(--md-sys-color-primary)' }}>⚡ Yozora Playback Telemetry</span>
            <button onClick={() => setShowStatsForNerds(false)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
          <div className="stats-row">
            <span className="stats-key">Source Title:</span>
            <span className="stats-val" title={playerState.sourceTitle}>{playerState.sourceTitle?.slice(0, 34)}...</span>
          </div>
          <div className="stats-row">
            <span className="stats-key">Dimensions:</span>
            <span className="stats-val">{telemetry.videoWidth}x{telemetry.videoHeight}</span>
          </div>
          <div className="stats-row">
            <span className="stats-key">Framerate:</span>
            <span className="stats-val">{telemetry.fps} fps</span>
          </div>
          <div className="stats-row">
            <span className="stats-key">Dropped Frames:</span>
            <span className="stats-val">{telemetry.droppedFrames}</span>
          </div>
          <div className="stats-row">
            <span className="stats-key">Playback Rate:</span>
            <span className="stats-val">{playbackSpeed}x</span>
          </div>
          <div className="stats-row">
            <span className="stats-key">Buffer Window:</span>
            <span className="stats-val">{bufferedTime.toFixed(1)}s ({telemetry.bufferPercent}%)</span>
          </div>
        </div>
      )}

      {/* Stream URL Input Dialog */}
      {showUrlDialog && (
        <div
          style={{
            position: 'absolute',
            top: '70px',
            right: '24px',
            background: 'rgba(21, 18, 24, 0.94)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            borderRadius: '18px',
            padding: '16px',
            width: '360px',
            zIndex: 40
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Load Custom Video Stream URL</span>
            <button onClick={() => setShowUrlDialog(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
          <form onSubmit={handleApplyCustomUrl} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="url"
              placeholder="https://.../video.mp4 or .m3u8"
              value={customStreamUrl}
              onChange={(e) => setCustomStreamUrl(e.target.value)}
              style={{
                flex: 1,
                background: 'var(--md-sys-color-surface-container-high)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                borderRadius: '8px',
                padding: '6px 10px',
                color: '#fff',
                fontSize: '12px'
              }}
            />
            <button type="submit" className="section-btn" style={{ padding: '6px 12px', fontSize: '12px' }}>
              Play
            </button>
          </form>
        </div>
      )}

      {/* Top HUD Header */}
      <div
        className="mpv-hud-header"
        style={{ opacity: showControls ? 1 : 0, pointerEvents: showControls ? 'auto' : 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="mpv-btn" onClick={closePlayer} title="Back to Yozora">
            <X size={22} />
          </button>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
              {playerState.anime.title}
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)' }}>
              Episode {playerState.episode.epNumber} — {playerState.episode.title}
            </p>
          </div>
        </div>

        {/* Quick Action Top Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="section-btn"
            style={{ padding: '6px 14px', fontSize: '12px', background: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)', borderColor: 'var(--md-sys-color-primary)', fontWeight: 700 }}
            onClick={async () => {
              const streamTarget = currentVideoSrc || (streamMirrors.length > 0 ? streamMirrors[0].url : '');
              if (streamTarget) {
                showToast(`Launching mpv for "${playerState.anime.title}"...`, 'info');
                await rqbitService.launchExternalMpv(streamTarget, playerState.anime.title);
              } else if (streamMirrors.length > 0 && streamMirrors[0].torrentSource?.magnetLink) {
                showToast(`Connecting to rqbit & launching mpv...`, 'info');
                try {
                  const res = await rqbitService.addTorrentAndGetStream(streamMirrors[0].torrentSource.magnetLink, playerState.anime.title);
                  if (res?.stream_url) {
                    await rqbitService.launchExternalMpv(res.stream_url, playerState.anime.title);
                  }
                } catch (e: any) {
                  showToast(e.message || 'Failed to start mpv', 'error');
                }
              } else {
                showToast('No active stream URL to send to mpv', 'warning');
              }
            }}
            title="Launch external mpv with hardware acceleration"
          >
            <Play size={14} fill="currentColor" />
            <span>Open in mpv</span>
          </button>

          <button
            className="section-btn"
            style={{ padding: '6px 12px', fontSize: '12px' }}
            onClick={() => fileInputRef.current?.click()}
            title="Load local file"
          >
            <Film size={14} />
            <span>Local File</span>
          </button>

          <button
            className="section-btn"
            style={{ padding: '6px 12px', fontSize: '12px' }}
            onClick={() => setShowUrlDialog(!showUrlDialog)}
            title="Load custom stream URL"
          >
            <Link size={14} />
            <span>Stream URL</span>
          </button>

          <button
            className="section-btn"
            style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(255,255,255,0.1)' }}
            onClick={skipOp}
            title={playerState.episode.opSkipEnd ? `Skip OP to ${playerState.episode.opSkipEnd}s` : 'Skip OP (90s)'}
          >
            <FastForward size={14} />
            <span>Skip OP</span>
          </button>

          <button
            className={`section-btn ${showStatsForNerds ? 'active' : ''}`}
            style={{ padding: '6px 12px', fontSize: '12px' }}
            onClick={() => setShowStatsForNerds(!showStatsForNerds)}
            title="Stats for Nerds (OSD)"
          >
            <Activity size={14} />
            <span>mpv OSD</span>
          </button>
        </div>
      </div>

      {/* Bottom HUD Footer */}
      <div
        className="mpv-hud-footer"
        style={{ opacity: showControls ? 1 : 0, pointerEvents: showControls ? 'auto' : 'none' }}
      >
        {/* Seekbar with Scrubbing Preview */}
        <div
          className="mpv-seekbar"
          onClick={handleSeek}
          onMouseMove={handleSeekbarMouseMove}
          onMouseLeave={handleSeekbarMouseLeave}
        >
          {hoverTime !== null && (
            <div
              style={{
                position: 'absolute',
                left: `${hoverPositionX}px`,
                bottom: '18px',
                transform: 'translateX(-50%)',
                background: 'rgba(21, 18, 24, 0.95)',
                border: '1px solid var(--md-sys-color-primary)',
                borderRadius: '8px',
                padding: '4px 8px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
                pointerEvents: 'none',
                whiteSpace: 'nowrap'
              }}
            >
              {formatTime(hoverTime)}
            </div>
          )}

          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${(bufferedTime / (duration || 1)) * 100}%`,
              background: 'rgba(255,255,255,0.4)',
              borderRadius: '3px'
            }}
          />
          <div
            className="mpv-seekbar-progress"
            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
          >
            <div className="mpv-seekbar-handle" />
          </div>
        </div>

        {/* Controls Bar */}
        <div className="mpv-controls-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="mpv-btn" onClick={togglePlay}>
              {isPlaying ? <Pause size={22} /> : <Play size={22} fill="currentColor" />}
            </button>

            <button
              className="mpv-btn"
              onClick={() => {
                const t = Math.max(0, currentTime - 10);
                setCurrentTime(t);
                if (videoRef.current) videoRef.current.currentTime = t;
              }}
              title="Rewind 10s"
            >
              <RotateCcw size={18} />
            </button>

            <button
              className="mpv-btn"
              onClick={() => {
                const t = Math.min(duration, currentTime + 10);
                setCurrentTime(t);
                if (videoRef.current) videoRef.current.currentTime = t;
              }}
              title="Forward 10s"
            >
              <RotateCw size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
              <button
                className="mpv-btn"
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.muted = !isMuted;
                  }
                  setIsMuted(!isMuted);
                }}
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  if (videoRef.current) {
                    videoRef.current.volume = v;
                    videoRef.current.muted = false;
                  }
                  setIsMuted(false);
                }}
                style={{ width: '70px', accentColor: 'var(--md-sys-color-primary)', cursor: 'pointer' }}
              />
            </div>

            <span style={{ fontSize: '12px', color: '#d1d5db', marginLeft: '8px', fontFamily: 'var(--font-mono)' }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <select
              value={playbackSpeed}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              <option value="0.75" style={{ background: '#222' }}>0.75x</option>
              <option value="1.0" style={{ background: '#222' }}>1.0x</option>
              <option value="1.25" style={{ background: '#222' }}>1.25x</option>
              <option value="1.5" style={{ background: '#222' }}>1.5x</option>
              <option value="2.0" style={{ background: '#222' }}>2.0x</option>
            </select>

            <button className="mpv-btn" onClick={toggleFullscreen} title="Fullscreen">
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
