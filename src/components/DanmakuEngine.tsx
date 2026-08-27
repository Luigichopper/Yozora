import React, { useRef, useEffect } from 'react';
import { DanmakuComment } from '../types/anime';

interface DanmakuEngineProps {
  comments: DanmakuComment[];
  currentTime: number;
  isPlaying: boolean;
  enabled: boolean;
  opacity: number;
  fontSize: number;
  speedMultiplier: number;
}

interface ActiveDanmaku {
  id: string;
  text: string;
  color: string;
  mode: 'scroll' | 'top' | 'bottom';
  x: number;
  y: number;
  speed: number;
  width: number;
  spawnTime: number;
  durationMs: number;
}

export const DanmakuEngine: React.FC<DanmakuEngineProps> = ({
  comments,
  currentTime,
  isPlaying,
  enabled,
  opacity,
  fontSize,
  speedMultiplier
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeDanmakusRef = useRef<ActiveDanmaku[]>([]);
  const spawnedIdsRef = useRef<Set<string>>(new Set());

  // Handle resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Track playback time and spawn comments
  useEffect(() => {
    if (!enabled) return;

    // Find comments within recent 1.0 second window
    comments.forEach(comment => {
      if (
        Math.abs(comment.time - currentTime) < 0.6 &&
        !spawnedIdsRef.current.has(comment.id)
      ) {
        spawnedIdsRef.current.add(comment.id);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.font = `bold ${fontSize}px sans-serif`;
        const textWidth = ctx.measureText(comment.text).width;

        // Allocate lane
        const trackHeight = fontSize + 10;
        const maxTracks = Math.max(3, Math.floor((canvas.height * 0.7) / trackHeight));
        const laneIndex = Math.floor(Math.random() * maxTracks);
        const y = 50 + laneIndex * trackHeight;

        const baseDuration = 6000 / speedMultiplier;

        activeDanmakusRef.current.push({
          id: comment.id,
          text: comment.text,
          color: comment.color,
          mode: comment.mode,
          x: comment.mode === 'scroll' ? canvas.width : (canvas.width - textWidth) / 2,
          y: comment.mode === 'bottom' ? canvas.height - 80 - (laneIndex % 3) * trackHeight : y,
          speed: (canvas.width + textWidth) / (baseDuration / 16.6),
          width: textWidth,
          spawnTime: performance.now(),
          durationMs: baseDuration
        });
      }
    });
  }, [currentTime, comments, enabled, fontSize, speedMultiplier]);

  // Main Animation Loop
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (enabled) {
            ctx.globalAlpha = opacity;
            ctx.font = `bold ${fontSize}px "Outfit", "Noto Sans SC", sans-serif`;
            ctx.textBaseline = 'top';

            const remaining: ActiveDanmaku[] = [];

            activeDanmakusRef.current.forEach(dm => {
              // Draw black text stroke for high contrast readability
              ctx.lineWidth = 3;
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
              ctx.strokeText(dm.text, dm.x, dm.y);

              // Draw filled text
              ctx.fillStyle = dm.color;
              ctx.fillText(dm.text, dm.x, dm.y);

              if (isPlaying) {
                if (dm.mode === 'scroll') {
                  dm.x -= dm.speed;
                  if (dm.x + dm.width > 0) {
                    remaining.push(dm);
                  }
                } else {
                  // Fixed top / bottom modes expire after 4 seconds
                  if (performance.now() - dm.spawnTime < 4000) {
                    remaining.push(dm);
                  }
                }
              } else {
                remaining.push(dm);
              }
            });

            activeDanmakusRef.current = remaining;
          }
        }
      }
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [enabled, opacity, fontSize, isPlaying]);

  return <canvas ref={canvasRef} className="danmaku-canvas-layer" />;
};
