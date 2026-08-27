import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { StreamData, SubtitleTrack } from '../../types/anime';
import { useAnimeStore } from '../../store/useAnimeStore';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  SkipForward 
} from 'lucide-react';

interface VideoPlayerProps {
  streamData: StreamData;
  mediaId: string;
  episodeId: string;
  episodeNumber: number;
  totalEpisodes?: number;
  anilistMediaId?: number;
  onNextEpisode?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  streamData,
  mediaId,
  episodeId,
  episodeNumber,
  totalEpisodes,
  anilistMediaId,
  onNextEpisode,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const {
    volume,
    setVolume,
    autoPlayNext,
    autoSkipIntro,
    preferredQuality,
    setProgress,
    getProgress,
  } = useAnimeStore();

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [qualities, setQualities] = useState<{ id: number; height: number; bitrate: number }[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1);
  const [showControls, setShowControls] = useState<boolean>(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedSource = streamData.sources.find((s) => s.quality === preferredQuality) || streamData.sources[0];

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !selectedSource) return;

    if (Hls.isSupported() && selectedSource.isM3U8) {
      if (hlsRef.current) hlsRef.current.destroy();

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        xhrSetup: (xhr) => {
          if (streamData.headers) {
            Object.entries(streamData.headers).forEach(([key, val]) => {
              xhr.setRequestHeader(key, val);
            });
          }
        },
      });

      hls.loadSource(selectedSource.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        const mappedQualities = data.levels.map((level, index) => ({
          id: index,
          height: level.height,
          bitrate: level.bitrate,
        }));
        setQualities(mappedQualities);

        const savedProgress = getProgress(mediaId, episodeId);
        if (savedProgress && savedProgress.progressSeconds > 10 && !savedProgress.completed) {
          video.currentTime = savedProgress.progressSeconds;
        }

        video.play().catch(() => setIsPlaying(false));
      });

      hls.on(Hls.Events.ERROR, (_, errorData) => {
        if (errorData.fatal) {
          switch (errorData.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl') || !selectedSource.isM3U8) {
      video.src = selectedSource.url;
      video.load();
      video.play().catch(() => setIsPlaying(false));
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [selectedSource, mediaId, episodeId]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const curr = video.currentTime;
    const dur = video.duration || 0;
    setCurrentTime(curr);
    setDuration(dur);

    if (autoSkipIntro && streamData.intro) {
      if (curr >= streamData.intro.start && curr < streamData.intro.end) {
        video.currentTime = streamData.intro.end;
      }
    }

    const isFinished = dur > 0 && curr / dur >= 0.9;
    setProgress(
      mediaId,
      {
        mediaId,
        episodeId,
        episodeNumber,
        progressSeconds: curr,
        durationSeconds: dur,
        lastUpdated: Date.now(),
        completed: isFinished,
      },
      anilistMediaId,
      totalEpisodes
    );
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (autoPlayNext && onNextEpisode) {
      onNextEpisode();
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleQualityChange = (levelId: number) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = levelId;
    setSelectedQuality(levelId);
  };

  const resetControlTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3500);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlTimeout}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className="relative w-full aspect-video bg-black rounded-lg overflow-hidden select-none group"
    >
      <video
        ref={videoRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="w-full h-full object-contain"
        crossOrigin="anonymous"
      >
        {streamData.subtitles.map((sub: SubtitleTrack) => (
          <track
            key={sub.url}
            src={sub.url}
            kind="subtitles"
            srcLang={sub.lang}
            label={sub.label}
            default={sub.isDefault}
          />
        ))}
      </video>

      {/* Intro Skip Action */}
      {streamData.intro &&
        currentTime >= streamData.intro.start &&
        currentTime < streamData.intro.end && (
          <button
            onClick={() => {
              if (videoRef.current && streamData.intro) {
                videoRef.current.currentTime = streamData.intro.end;
              }
            }}
            className="absolute bottom-20 right-8 z-30 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded shadow-lg transition"
          >
            Skip Intro
          </button>
        )}

      {/* Control Overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 flex flex-col justify-between p-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex justify-between items-center text-white">
          <span className="text-sm font-medium">Episode {episodeNumber}</span>
        </div>

        <div className="flex flex-col gap-2">
          {/* Seek Bar */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (videoRef.current) videoRef.current.currentTime = val;
              setCurrentTime(val);
            }}
            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />

          <div className="flex justify-between items-center text-white">
            <div className="flex items-center gap-4">
              <button onClick={togglePlay} className="hover:text-blue-400">
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>

              {onNextEpisode && (
                <button onClick={onNextEpisode} className="hover:text-blue-400">
                  <SkipForward size={20} />
                </button>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleVolumeChange(isMuted ? 1 : 0)}
                  className="hover:text-blue-400"
                >
                  {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <span className="text-xs text-gray-300">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-4">
              {qualities.length > 0 && (
                <select
                  value={selectedQuality}
                  onChange={(e) => handleQualityChange(Number(e.target.value))}
                  className="bg-black/60 border border-gray-700 text-xs rounded px-2 py-1 outline-none"
                >
                  <option value={-1}>Auto</option>
                  {qualities.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.height}p
                    </option>
                  ))}
                </select>
              )}

              <button onClick={toggleFullscreen} className="hover:text-blue-400">
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
