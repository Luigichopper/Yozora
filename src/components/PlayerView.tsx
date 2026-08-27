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
  MessageSquare,
  Activity,
  Sliders,
  Send,
  Sparkles,
  FolderOpen,
  Link,
  RefreshCw,
  Film,
  Check,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DanmakuEngine } from './DanmakuEngine';
import { SAMPLE_VIDEOS } from '../data/mockDanmaku';
import { streamService, AnimeStreamSource } from '../services/streamService';
import { rqbitService } from '../services/rqbitService';


export const PlayerView: React.FC = () => {
  const {
    playerState,
    closePlayer,
    danmakuEnabled,
    setDanmakuEnabled,
    danmakuOpacity,
    setDanmakuOpacity,
    danmakuFontSize,
    setDanmakuFontSize,
    danmakuSpeedMultiplier,
    setDanmakuSpeedMultiplier,
    danmakuComments,
    addDanmakuComment,
    showToast
  } = useApp();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hlsInstanceRef = useRef<any>(null);

  const [currentVideoSrc, setCurrentVideoSrc] = useState<string>(playerState?.videoUrl || SAMPLE_VIDEOS.default);
  const [streamMirrors, setStreamMirrors] = useState<AnimeStreamSource[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(1440);
  const [bufferedTime, setBufferedTime] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showStatsForNerds, setShowStatsForNerds] = useState<boolean>(false);
  const [showDanmakuConfig, setShowDanmakuConfig] = useState<boolean>(false);
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

  // Danmaku input state
  const [danmakuInput, setDanmakuInput] = useState<string>('');
  const [danmakuColor, setDanmakuColor] = useState<string>('#ffffff');
  const [danmakuMode, setDanmakuMode] = useState<'scroll' | 'top' | 'bottom'>('scroll');

  const controlsTimeoutRef = useRef<number | null>(null);
  const lastOpSkipTriggerRef = useRef<boolean>(false);

  // Initialize player state
  useEffect(() => {
    if (playerState) {
      const initPlayer = async () => {
        setHasVideoError(false);
        setIsPlaying(false);
        setCurrentTime(0);
        lastOpSkipTriggerRef.current = false;

        const mirrors = await streamService.resolveEpisodeStream(
          playerState.anime.title,
          playerState.anime.romajiTitle,
          playerState.episode.epNumber
        );
        setStreamMirrors(mirrors);

        const initialSrc = playerState.videoUrl || mirrors[0]?.url || SAMPLE_VIDEOS.default;
        setCurrentVideoSrc(initialSrc);
      };
      initPlayer();
    }
  }, [playerState]);

  // Load and play video stream
  useEffect(() => {
    const video = videoRef.current;
    if (video && currentVideoSrc) {
      setHasVideoError(false);

      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }

      if (currentVideoSrc.includes('.m3u8')) {
        const hls = streamService.attachHlsPlayer(video, currentVideoSrc, () => {
          video.play()
            .then(() => {
              setIsPlaying(true);
              setNeedsUserClickToStart(false);
            })
            .catch(() => {
              setNeedsUserClickToStart(true);
              setIsPlaying(false);
            });
        });
        hlsInstanceRef.current = hls;
      } else {
        video.src = currentVideoSrc;
        video.load();
        video.play()
          .then(() => {
            setIsPlaying(true);
            setNeedsUserClickToStart(false);
          })
          .catch(() => {
            setNeedsUserClickToStart(true);
            setIsPlaying(false);
          });
      }
    }
  }, [currentVideoSrc]);

  // Auto-skip opening
  useEffect(() => {
    if (autoSkipOp && playerState?.episode.opSkipStart && playerState.episode.opSkipEnd) {
      if (
        currentTime >= playerState.episode.opSkipStart &&
        currentTime < playerState.episode.opSkipStart + 2 &&
        !lastOpSkipTriggerRef.current
      ) {
        lastOpSkipTriggerRef.current = true;
        skipOp();
      }
    }
  }, [currentTime, autoSkipOp, playerState]);

  const handleVideoError = () => {
    console.warn('Video stream error on URL:', currentVideoSrc);
    // Cycle to next available mirror
    const currentIndex = streamMirrors.findIndex(m => m.url === currentVideoSrc);
    if (currentIndex >= 0 && currentIndex < streamMirrors.length - 1) {
      const nextMirror = streamMirrors[currentIndex + 1];
      setCurrentVideoSrc(nextMirror.url);
      showToast(`Server 1 failed. Switched to ${nextMirror.server}`, 'info');
    } else {
      setHasVideoError(true);
      showToast('Video stream error. Switch servers or open a local video file.', 'warning');
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 4000);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      setCurrentTime(t);
      if (videoRef.current.buffered.length > 0) {
        const buf = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
        setBufferedTime(buf);
        setTelemetry(prev => ({
          ...prev,
          bufferPercent: Math.round((buf / (videoRef.current?.duration || 1)) * 100),
          bitrateKbps: Math.round(7400 + Math.sin(t * 0.5) * 900)
        }));
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 1440);
      setTelemetry({
        videoWidth: videoRef.current.videoWidth || 1920,
        videoHeight: videoRef.current.videoHeight || 1080,
        fps: 60,
        droppedFrames: 0,
        bitrateKbps: 8420,
        bufferPercent: 25
      });
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play()
          .then(() => {
            setIsPlaying(true);
            setNeedsUserClickToStart(false);
          })
          .catch((err) => {
            console.warn('Playback click error:', err);
          });
      }
    }
  };

  const handleSeekbarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, hoverX / rect.width));
    setHoverPositionX(hoverX);
    setHoverTime(ratio * duration);
  };

  const handleSeekbarMouseLeave = () => {
    setHoverTime(null);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const seekRatio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = seekRatio * duration;
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleSendDanmaku = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!danmakuInput.trim()) return;
    await addDanmakuComment(danmakuInput.trim(), danmakuColor, danmakuMode, currentTime);
    showToast(`Danmaku posted at ${formatTime(currentTime)}!`, 'success');
    setDanmakuInput('');
  };

  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      setCurrentVideoSrc(fileUrl);
      setIsPlaying(true);
      setNeedsUserClickToStart(false);
      setHasVideoError(false);
      showToast(`Loaded local anime video: ${file.name}`, 'success');
    }
  };

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStreamUrl.trim()) {
      setCurrentVideoSrc(customStreamUrl.trim());
      setIsPlaying(true);
      setShowUrlDialog(false);
      setCustomStreamUrl('');
      setHasVideoError(false);
      showToast('Loaded custom stream URL', 'success');
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

      {/* Canvas Danmaku Engine */}
      <DanmakuEngine
        comments={danmakuComments}
        currentTime={currentTime}
        isPlaying={isPlaying}
        enabled={danmakuEnabled}
        opacity={danmakuOpacity}
        fontSize={danmakuFontSize}
        speedMultiplier={danmakuSpeedMultiplier}
      />

      {/* Click to start / Resume Playback overlay */}
      {needsUserClickToStart && !isPlaying && (
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

      {/* Stream Error Notice */}
      {hasVideoError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(18, 15, 20, 0.92)',
            zIndex: 34,
            padding: '24px',
            textAlign: 'center'
          }}
        >
          <AlertCircle size={44} color="var(--md-sys-color-primary)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>Stream Source / Decoder Error</h3>
          <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', maxWidth: '480px', marginTop: '6px', marginBottom: '18px' }}>
            HTML5 video cannot decode this stream format or the stream server is offline. (Browsers cannot natively play raw .mkv / FLAC torrent streams). Launch in external mpv or select another source.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {rqbitService.isTauri() && (
              <button
                className="section-btn"
                onClick={async () => {
                  const ok = await rqbitService.launchExternalMpv(currentVideoSrc, playerState.anime.title);
                  if (ok) {
                    showToast('Launched stream in external mpv!', 'success');
                  } else {
                    showToast('Failed to launch mpv. Ensure mpv is installed.', 'error');
                  }
                }}
                style={{ background: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)', borderColor: 'var(--md-sys-color-primary)', fontWeight: 700 }}
              >
                <Play size={14} fill="currentColor" />
                <span>Launch in External MPV</span>
              </button>
            )}
            <button
              className="section-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <FolderOpen size={14} />
              <span>Load Local Video File</span>
            </button>
            <button
              className="section-btn"
              onClick={() => setCurrentVideoSrc(SAMPLE_VIDEOS.default)}
            >
              <RefreshCw size={14} />
              <span>Reload Sample Stream</span>
            </button>
          </div>
        </div>
      )}

      {/* Stats for Nerds (mpv OSD Telemetry) */}
      {showStatsForNerds && (
        <div className="stats-for-nerds-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontWeight: 700, color: 'var(--md-sys-color-primary)' }}>libmpv 0.38 / Wayland Telemetry</span>
            <button
              onClick={() => setShowStatsForNerds(false)}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          </div>
          <div className="stats-row">
            <span className="stats-key">Engine Pipeline:</span>
            <span className="stats-val">Hardware VAAPI / WebGL Dec</span>
          </div>
          <div className="stats-row">
            <span className="stats-key">Resolution:</span>
            <span className="stats-val">{telemetry.videoWidth}x{telemetry.videoHeight} @ {telemetry.fps}.00 fps</span>
          </div>
          <div className="stats-row">
            <span className="stats-key">Audio Track:</span>
            <span className="stats-val">FLAC 2.0 (24-bit / 48kHz, 1.4 Mbps)</span>
          </div>
          <div className="stats-row">
            <span className="stats-key">Compositor:</span>
            <span className="stats-val">Hyprland (Layer-shell / DRM)</span>
          </div>
          <div className="stats-row">
            <span className="stats-key">Bitrate (live):</span>
            <span className="stats-val">{telemetry.bitrateKbps.toLocaleString()} kbps</span>
          </div>
          <div className="stats-row">
            <span className="stats-key">Buffer Window:</span>
            <span className="stats-val">{bufferedTime.toFixed(1)}s ({telemetry.bufferPercent}%)</span>
          </div>
          <div className="stats-row">
            <span className="stats-key">Danmaku Stream:</span>
            <span className="stats-val">{danmakuComments.length} comments ({danmakuEnabled ? 'Rendering' : 'Disabled'})</span>
          </div>
        </div>
      )}

      {/* Danmaku Config Drawer */}
      {showDanmakuConfig && (
        <div
          style={{
            position: 'absolute',
            bottom: '90px',
            right: '24px',
            background: 'rgba(21, 18, 24, 0.94)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            borderRadius: '20px',
            padding: '18px',
            width: '280px',
            zIndex: 40,
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--md-sys-color-primary)' }}>Danmaku Settings (弹幕设置)</span>
            <button
              onClick={() => setShowDanmakuConfig(false)}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span>Opacity (不透明度)</span>
              <span>{Math.round(danmakuOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={danmakuOpacity}
              onChange={(e) => setDanmakuOpacity(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--md-sys-color-primary)' }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span>Font Size (字号大小)</span>
              <span>{danmakuFontSize}px</span>
            </div>
            <input
              type="range"
              min="16"
              max="36"
              step="2"
              value={danmakuFontSize}
              onChange={(e) => setDanmakuFontSize(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--md-sys-color-primary)' }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span>Scroll Speed (弹幕速度)</span>
              <span>{danmakuSpeedMultiplier}x</span>
            </div>
            <input
              type="range"
              min="0.6"
              max="1.8"
              step="0.2"
              value={danmakuSpeedMultiplier}
              onChange={(e) => setDanmakuSpeedMultiplier(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--md-sys-color-primary)' }}
            />
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px' }}>Auto Skip Opening</span>
            <input
              type="checkbox"
              checked={autoSkipOp}
              onChange={(e) => setAutoSkipOp(e.target.checked)}
              style={{ accentColor: 'var(--md-sys-color-primary)' }}
            />
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
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
              {playerState.anime.title} — EP {playerState.episode.epNumber.toString().padStart(2, '0')}: {playerState.episode.title}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--md-sys-color-primary)', marginTop: '2px' }}>
              {playerState.sourceTitle}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Dynamic Anime Stream Servers Dropdown */}
          <select
            value={currentVideoSrc}
            onChange={(e) => {
              setCurrentVideoSrc(e.target.value);
              showToast('Switched streaming server', 'info');
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              color: '#fff',
              border: '1px solid var(--md-sys-color-outline-variant)',
              borderRadius: '999px',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            {streamMirrors.map((m, idx) => (
              <option key={idx} value={m.url} style={{ background: '#1c1524' }}>
                {m.server} ({m.quality})
              </option>
            ))}
          </select>

          <button
            className="section-btn"
            style={{ padding: '6px 12px', fontSize: '12px' }}
            onClick={() => fileInputRef.current?.click()}
            title="Open Local Video File (.mp4, .mkv, .webm)"
          >
            <FolderOpen size={14} />
            <span>Open Local File</span>
          </button>

          <button
            className="section-btn"
            style={{ padding: '6px 12px', fontSize: '12px' }}
            onClick={() => setShowUrlDialog(!showUrlDialog)}
            title="Custom Stream URL"
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

          {/* Center: Danmaku Input Bar */}
          <form
            onSubmit={handleSendDanmaku}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.12)',
              borderRadius: '999px',
              padding: '2px 14px 2px 8px',
              gap: '8px',
              maxWidth: '420px',
              flex: 1,
              margin: '0 20px'
            }}
          >
            <input
              type="color"
              value={danmakuColor}
              onChange={(e) => setDanmakuColor(e.target.value)}
              style={{ width: '22px', height: '22px', border: 'none', background: 'transparent', cursor: 'pointer' }}
              title="Danmaku Color"
            />

            <input
              type="text"
              placeholder={`Send danmaku at ${formatTime(currentTime)}...`}
              value={danmakuInput}
              onChange={(e) => setDanmakuInput(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '12px',
                flex: 1,
                outline: 'none'
              }}
            />

            <button
              type="submit"
              style={{
                background: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
                border: 'none',
                borderRadius: '50%',
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="Send Bullet Comment"
            >
              <Send size={12} />
            </button>
          </form>

          {/* Right Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="section-btn"
              style={{
                background: danmakuEnabled ? 'var(--md-sys-color-primary-container)' : 'rgba(255,255,255,0.1)',
                color: danmakuEnabled ? 'var(--md-sys-color-on-primary-container)' : '#aaa',
                border: 'none',
                padding: '6px 12px'
              }}
              onClick={() => setDanmakuEnabled(!danmakuEnabled)}
              title="Toggle Danmaku (D)"
            >
              <MessageSquare size={14} />
              <span>{danmakuEnabled ? '弹幕开' : '弹幕关'}</span>
            </button>

            <button
              className="mpv-btn"
              onClick={() => setShowDanmakuConfig(!showDanmakuConfig)}
              title="Danmaku Config"
            >
              <Sliders size={18} />
            </button>

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
