import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import { completeFocusSession, getFocusStats } from '../api/client';
import { animateTap } from '../lib/gsap';

const MODES = {
  POMODORO: { label: '25m Focus', duration: 25 * 60 },
  DEEP_WORK: { label: '50m Deep Work', duration: 50 * 60 },
  SHORT_BREAK: { label: '5m Break', duration: 5 * 60 },
};

export default function FocusTimerWidget({ activeTask, onSessionComplete }) {
  const toast = useToast();
  const [modeKey, setModeKey] = useState('POMODORO');
  const [timeLeft, setTimeLeft] = useState(MODES.POMODORO.duration);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);
  const timerRef = useRef(null);

  const fetchSessionStats = useCallback(async () => {
    try {
      const stats = await getFocusStats();
      if (stats && typeof stats.today_sessions_count === 'number') {
        setCompletedSessions(stats.today_sessions_count);
      }
    } catch {
      // Graceful fallback
    }
  }, []);

  useEffect(() => {
    fetchSessionStats();
    const handleFocusSync = () => fetchSessionStats();
    window.addEventListener('lifesync:focus-completed', handleFocusSync);
    return () => window.removeEventListener('lifesync:focus-completed', handleFocusSync);
  }, [fetchSessionStats]);

  const totalDuration = MODES[modeKey].duration;
  const progressPercent = Math.min(100, Math.max(0, ((totalDuration - timeLeft) / totalDuration) * 100));

  const finishSession = async (spentDuration) => {
    playChime();
    const target = activeTask ? (activeTask.task || activeTask.title) : 'Focus Session';
    try {
      await completeFocusSession({
        mode: modeKey,
        duration_seconds: spentDuration || (totalDuration - timeLeft) || totalDuration,
        target_name: target,
        task_id: activeTask?.id || null,
      });
      setCompletedSessions((c) => c + 1);
      toast.success(`🎉 Focus session complete! Target: "${target}" saved.`);
      window.dispatchEvent(new CustomEvent('lifesync:focus-completed'));
      if (onSessionComplete) onSessionComplete(modeKey);
    } catch (err) {
      console.error('Failed to persist focus session:', err);
      toast.error('Session finished, but failed to save to server.');
    }
  };

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsRunning(false);
            finishSession(totalDuration);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, modeKey, totalDuration, activeTask]);

  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch {
      // Audio context fallback
    }
  };

  const handleModeChange = (key) => {
    setIsRunning(false);
    setModeKey(key);
    setTimeLeft(MODES[key].duration);
  };

  const toggleTimer = () => {
    if (timeLeft === 0) {
      setTimeLeft(MODES[modeKey].duration);
    }
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(MODES[modeKey].duration);
    toast.info('Timer reset.');
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="focus-timer-card">
      <div className="focus-timer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="focus-flame-icon">🔥</span>
          <span className="rail-widget-title" style={{ margin: 0 }}>Focus & Study Mode</span>
        </div>
        <div className="focus-streak-badge" title="Focus sessions completed today">
          <span>🍅 {completedSessions} Sessions</span>
        </div>
      </div>

      {/* Mode selectors */}
      <div className="focus-mode-pills">
        {Object.entries(MODES).map(([key, config]) => (
          <button
            key={key}
            type="button"
            className={`focus-pill-btn ${modeKey === key ? 'active' : ''}`}
            onClick={() => handleModeChange(key)}
          >
            {config.label}
          </button>
        ))}
      </div>

      {/* Main Clock Display */}
      <div className="focus-clock-container">
        <div className="focus-time-display">{formatTime(timeLeft)}</div>
        <div className="focus-task-target">
          <span style={{ color: '#6B7280', fontSize: '0.74rem' }}>Target:</span>{' '}
          <strong style={{ color: '#1B3B2E' }}>
            {activeTask ? (activeTask.task || activeTask.title) : 'CS101 Term Paper Final • Literature Review'}
          </strong>
        </div>

        {/* Progress Bar */}
        <div className="focus-progress-track">
          <div
            className="focus-progress-fill"
            style={{
              width: `${progressPercent}%`,
              background: modeKey === 'SHORT_BREAK' ? 'var(--emerald-500, #10B981)' : 'var(--forest-green, #1B3B2E)',
            }}
          />
        </div>
      </div>

      {/* Timer Controls */}
      <div className="focus-controls" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn ${isRunning ? 'btn-secondary' : 'btn-primary'} btn-sm`}
          style={{ flex: '2 1 120px' }}
          onClick={(e) => {
            animateTap(e.currentTarget);
            toggleTimer();
          }}
        >
          {isRunning ? '⏸ Pause' : timeLeft === 0 ? '🔄 Restart' : '▶ Start Focus'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ flex: '1 1 50px' }}
          onClick={(e) => {
            animateTap(e.currentTarget);
            setTimeLeft((prev) => prev + 300);
            toast.info('+5 minutes added to timer');
          }}
          title="Add 5 minutes to focus timer"
        >
          +5m
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ flex: '1 1 50px' }}
          onClick={(e) => {
            animateTap(e.currentTarget);
            const spent = totalDuration - timeLeft;
            setIsRunning(false);
            finishSession(spent > 10 ? spent : 300);
            setTimeLeft(MODES[modeKey].duration);
          }}
          title="Mark this focus session complete and log XP"
        >
          ✓ Done
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ flex: '1 1 50px' }}
          onClick={(e) => {
            animateTap(e.currentTarget);
            handleReset();
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
