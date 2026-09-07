import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';

export default function StickyFocusPlayer({
  taskTitle = "CAT-2 Prep: Neural Networks",
  subTitle = "Deep Work Session • Claude Optimized",
  initialDuration = 25 * 60, // 25 minutes
}) {
  const toast = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(24 * 60 + 18); // 24:18 as in Figma design
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsPlaying(false);
            toast.success("🔔 Focus Session Complete! Time for a 5m refresh.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  const togglePlay = () => {
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    if (nextState) {
      toast.info("🎧 Focus Audio Stream Active — Deep Ambient Mode");
    } else {
      toast.info("Focus session paused.");
    }
  };

  const formatClock = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="sticky-focus-bar">
      <div className="focus-bar-left">
        {/* Play/Pause round button */}
        <button
          type="button"
          className="focus-play-btn"
          onClick={togglePlay}
          title={isPlaying ? "Pause Focus Session" : "Start Focus Session"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>

        <div className="focus-bar-meta">
          <div className="focus-bar-title">{taskTitle}</div>
          <div className="focus-bar-sub">
            {subTitle}
            {isPlaying && (
              <span className="soundwave-pulse">
                <span className="soundwave-bar" />
                <span className="soundwave-bar" />
                <span className="soundwave-bar" />
                <span className="soundwave-bar" />
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className="focus-bar-time">
          {formatClock(secondsLeft)} / 25:00
        </span>

        <button
          type="button"
          onClick={() => {
            setIsMuted(!isMuted);
            toast.info(isMuted ? "Audio unmuted" : "Ambient sound muted");
          }}
          style={{
            background: 'rgba(255,255,255,0.12)',
            border: 'none',
            color: '#FFFFFF',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s ease'
          }}
          title={isMuted ? "Unmute" : "Mute Sound"}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>
      </div>
    </div>
  );
}
