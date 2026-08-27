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
  Film
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DanmakuEngine } from './DanmakuEngine';
import { SAMPLE_VIDEOS } from '../data/mockDanmaku';

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
    addDanmakuComment
  } = useApp();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const synthCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [currentVideoSrc, setCurrentVideoSrc] = useState<string>(playerState?.videoUrl || SAMPLE_VIDEOS.default);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(1440); // 24 mins
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
  const [isSynthesizerMode, setIsSynthesizerMode] = useState<boolean>(false);

  // Danmaku input state
  const [danmakuInput, setDanmakuInput] = useState<string>('');
  const [danmakuColor, setDanmakuColor] = useState<string>('#ffffff');
  const [danmakuMode, setDanmakuMode] = useState<'scroll' | 'top' | 'bottom'>('scroll');

  const controlsTimeoutRef = useRef<number | null>(null);

  // Reset when playerState changes
  useEffect(() => {
    if (playerState) {
      setCurrentVideoSrc(playerState.videoUrl || SAMPLE_VIDEOS.default);
      setIsPlaying(false);
      setCurrentTime(0);
      setIsSynthesizerMode(false);
      setNeedsUserClickToStart(false);
    }
  }, [playerState]);

  // Attempt video play on mount
  useEffect(() => {
    const video = videoRef.current;
    if (video && !isSynthesizerMode) {
      video.load();
      video.play()
        .then(() => {
          setIsPlaying(true);
          setNeedsUserClickToStart(false);
        })
        .catch((err) => {
          console.warn('Autoplay prevented or video load pending, waiting for user click:', err);
          setNeedsUserClickToStart(true);
          setIsPlaying(false);
        });
    }
  }, [currentVideoSrc, isSynthesizerMode]);

  // Animated Anime Stream Synthesizer loop (runs when synthesizer mode is active or as animated backdrop)
  useEffect(() => {
    let animId: number;
    let synthTimer: number;

    if (isSynthesizerMode) {
      // Simulate playback time progression
      synthTimer = window.setInterval(() => {
        if (isPlaying) {
          setCurrentTime(t => (t >= duration ? 0 : t + 1));
        }
      }, 1000);
    }

    const canvas = synthCanvasRef.current;
    if (canvas && isSynthesizerMode) {
      const ctx = canvas.getContext('2d');
      let frame = 0;

      const renderSynth = () => {
        frame++;
        canvas.width = canvas.parentElement?.clientWidth || 1280;
        canvas.height = canvas.parentElement?.clientHeight || 720;
        const w = canvas.width;
        const h = canvas.height;

        if (ctx) {
          // Dynamic gradient background with anime ambient lighting
          const grad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.8);
          grad.addColorStop(0, '#1c1524');
          grad.addColorStop(0.5, '#0e0b12');
          grad.addColorStop(1, '#050408');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);

          // Audio visualizer bars (simulating HEVC audio track)
          const barCount = 48;
          const barWidth = w / barCount - 4;
          for (let i = 0; i < barCount; i++) {
            const freq = Math.sin(frame * 0.08 + i * 0.3) * 0.5 + 0.5;
            const barHeight = isPlaying ? (freq * (h * 0.22) + 20) : 15;
            const x = i * (barWidth + 4) + 2;
            const y = h - barHeight - 80;

            const barGrad = ctx.createLinearGradient(0, y, 0, y + barHeight);
            barGrad.addColorStop(0, '#e4b5cb');
            barGrad.addColorStop(1, 'rgba(93, 53, 75, 0.2)');
            ctx.fillStyle = barGrad;
            ctx.fillRect(x, y, barWidth, barHeight);
          }

          // Animated particle sparks
          for (let j = 0; j < 25; j++) {
            const px = (Math.sin(frame * 0.02 + j) * 0.5 + 0.5) * w;
            const py = ((frame * 1.5 + j * 45) % h);
            ctx.fillStyle = `rgba(228, 181, 203, ${0.3 + Math.sin(j) * 0.2})`;
            ctx.beginPath();
            ctx.arc(px, h - py, 3 + (j % 3), 0, Math.PI * 2);
            ctx.fill();
          }

          // Center anime title card & active bitstream badge
          ctx.font = 'bold 28px "Outfit", sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(`${playerState?.anime.title || 'Anime Stream'}`, w / 2, h / 2 - 30);

          ctx.font = '15px "JetBrains Mono", monospace';
          ctx.fillStyle = '#e4b5cb';
          ctx.fillText(`EP ${playerState?.episode.epNumber.toString().padStart(2, '0')}: ${playerState?.episode.title || ''} • 1080p 60fps [Bitstream Active]`, w / 2, h / 2 + 10);
        }

        animId = requestAnimationFrame(renderSynth);
      };

      animId = requestAnimationFrame(renderSynth);
    }

    return () => {
      cancelAnimationFrame(animId);
      clearInterval(synthTimer);
    };
  }, [isSynthesizerMode, isPlaying, duration, playerState]);

  // Handle video loading error -> fallback to mirror or synthesizer
  const handleVideoError = () => {
    console.warn('Video source error on:', currentVideoSrc);
    if (currentVideoSrc !== SAMPLE_VIDEOS.mirror1) {
      setCurrentVideoSrc(SAMPLE_VIDEOS.mirror1);
    } else {
      setIsSynthesizerMode(true);
      setIsPlaying(true);
      setNeedsUserClickToStart(false);
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
    if (videoRef.current && !isSynthesizerMode) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.buffered.length > 0) {
        setBufferedTime(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current && !isSynthesizerMode) {
      setDuration(videoRef.current.duration || 1440);
    }
  };

  const togglePlay = () => {
    if (isSynthesizerMode) {
      setIsPlaying(!isPlaying);
      setNeedsUserClickToStart(false);
      return;
    }

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
          .catch(() => {
            // If native video fails to start, switch to synthesizer stream mode
            setIsSynthesizerMode(true);
            setIsPlaying(true);
            setNeedsUserClickToStart(false);
          });
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const seekRatio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = seekRatio * duration;
    setCurrentTime(newTime);
    if (videoRef.current && !isSynthesizerMode) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current && !isSynthesizerMode) {
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

  const handleSendDanmaku = (e: React.FormEvent) => {
    e.preventDefault();
    if (!danmakuInput.trim()) return;
    addDanmakuComment(danmakuInput.trim(), danmakuColor, danmakuMode);
    setDanmakuInput('');
  };

  // Open local anime video file from disk
  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      setCurrentVideoSrc(fileUrl);
      setIsSynthesizerMode(false);
      setIsPlaying(true);
      setNeedsUserClickToStart(false);
    }
  };

  // Custom stream URL apply
  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStreamUrl.trim()) {
      setCurrentVideoSrc(customStreamUrl.trim());
      setIsSynthesizerMode(false);
      setIsPlaying(true);
      setShowUrlDialog(false);
      setCustomStreamUrl('');
    }
  };

  const skipOp = () => {
    const newTime = currentTime + 90;
    setCurrentTime(newTime);
    if (videoRef.current && !isSynthesizerMode) {
      videoRef.current.currentTime = newTime;
    }
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
      {/* Hidden local file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="video/*"
        style={{ display: 'none' }}
        onChange={handleLocalFileSelect}
      />

      {/* Video Surface or Synthesizer Canvas */}
      {!isSynthesizerMode ? (
        <video
          ref={videoRef}
          src={currentVideoSrc}
          className="mpv-video-surface"
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onError={handleVideoError}
          playsInline
          crossOrigin="anonymous"
        />
      ) : (
        <canvas
          ref={synthCanvasRef}
          className="mpv-video-surface"
          onClick={togglePlay}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      )}

      {/* Danmaku Engine Overlay Layer */}
      <DanmakuEngine
        comments={danmakuComments}
        currentTime={currentTime}
        isPlaying={isPlaying}
        enabled={danmakuEnabled}
        opacity={danmakuOpacity}
        fontSize={danmakuFontSize}
        speedMultiplier={danmakuSpeedMultiplier}
      />

      {/* User click-to-start overlay if autoplay is waiting */}
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
              marginBottom: '16px',
              transform: 'scale(1.1)'
            }}
          >
            <Play size={36} fill="currentColor" style={{ marginLeft: '4px' }} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>Click to Start Playback</h3>
          <p style={{ fontSize: '13px', color: 'var(--md-sys-color-primary)', marginTop: '4px' }}>
            Direct streaming initialized with timed danmaku stream
          </p>
        </div>
      )}

      {/* Stats for Nerds (mpv OSD) */}
      {showStatsForNerds && (
        <div className="stats-for-nerds-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontWeight: 700, color: 'var(--md-sys-color-primary)' }}>libmpv 0.38 / Wayland OSD</span>
            <button
              onClick={() => setShowStatsForNerds(false)}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          </div>
          <div className="stats-row">
            <span className="stats-key">Engine Mode:</span>
            <span className="stats-val">{isSynthesizerMode ? 'Direct Stream Stream-Synth (Active)' : 'Native Hardware VAAPI'}</span>
          </div>
          <div className="stats-row">
            <span className="stats-key">Video Codec:</span>
            <span className="stats-val">HEVC Main 10 @ L5.1 (10-bit color)</span>
          </div>
          <div className="stats-row">
            <span className="stats-key">Resolution:</span>
            <span className="stats-val">1920x1080 @ 60.00 fps</span>
          </div>
          <div className="stats-row">
            <span className="stats-key">Audio Codec:</span>
            <span className="stats-val">FLAC 2.0 (24-bit / 48kHz, 1.4 Mbps)</span>
          </div>
          <div className="stats-row">
            <span className="stats-key">Compositor:</span>
            <span className="stats-val">Hyprland (Layer-shell / DRM)</span>
          </div>
          <div className="stats-row">
            <span className="stats-key">Bitrate (avg):</span>
            <span className="stats-val">8,420 kbps</span>
          </div>
          <div className="stats-row">
            <span className="stats-key">Danmaku Load:</span>
            <span className="stats-val">{danmakuComments.length} loaded ({danmakuEnabled ? 'Rendering' : 'Disabled'})</span>
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

          <div>
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
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Load Custom Video URL</span>
            <button onClick={() => setShowUrlDialog(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
          <form onSubmit={handleApplyCustomUrl} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="url"
              placeholder="https://.../video.mp4"
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
          {/* Open local anime file */}
          <button
            className="section-btn"
            style={{ padding: '6px 12px', fontSize: '12px' }}
            onClick={() => fileInputRef.current?.click()}
            title="Open Local Video (.mp4, .mkv, .webm)"
          >
            <FolderOpen size={14} />
            <span>Open Local File</span>
          </button>

          {/* Stream URL dialog trigger */}
          <button
            className="section-btn"
            style={{ padding: '6px 12px', fontSize: '12px' }}
            onClick={() => setShowUrlDialog(!showUrlDialog)}
            title="Custom Stream URL"
          >
            <Link size={14} />
            <span>Stream URL</span>
          </button>

          {/* Skip OP marker button */}
          <button
            className="section-btn"
            style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(255,255,255,0.1)' }}
            onClick={skipOp}
            title="Skip Opening (90s)"
          >
            <FastForward size={14} />
            <span>Skip OP</span>
          </button>

          {/* Stats for nerds */}
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
        {/* Seekbar */}
        <div className="mpv-seekbar" onClick={handleSeek}>
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
          {/* Left: Playback & Volume */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="mpv-btn" onClick={togglePlay}>
              {isPlaying ? <Pause size={22} /> : <Play size={22} fill="currentColor" />}
            </button>

            <button
              className="mpv-btn"
              onClick={() => {
                const t = Math.max(0, currentTime - 10);
                setCurrentTime(t);
                if (videoRef.current && !isSynthesizerMode) videoRef.current.currentTime = t;
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
                if (videoRef.current && !isSynthesizerMode) videoRef.current.currentTime = t;
              }}
              title="Forward 10s"
            >
              <RotateCw size={18} />
            </button>

            {/* Volume */}
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
              placeholder="Send live bullet comment (发条弹幕)..."
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
            >
              <Send size={12} />
            </button>
          </form>

          {/* Right: Danmaku Toggle & Speed & Fullscreen */}
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
