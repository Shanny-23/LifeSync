import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import StreakBreakdownModal from './StreakBreakdownModal';

export default function AtAGlanceMetrics({
  tasks = [],
  routinePercent = 41,
  streakDays = 5,
  activeTaskName = "CS101 Paper - Literature Review",
  showTimerControls = true,
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const [seconds, setSeconds] = useState(6138); // 01:42:18
  const [isRunning, setIsRunning] = useState(true);
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);

  useEffect(() => {
    let interval = null;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (totalSecs) => {
    const hrs = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
    const mins = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  // Derive counts
  const totalTasks = tasks.length || 7;
  const completedTasks = tasks.filter((t) => t.status === 'completed' || t.completed).length;
  const pendingTasks = tasks.filter((t) => t.status !== 'completed' && !t.completed).length || (totalTasks - completedTasks);
  const academicTasks = tasks.filter((t) =>
    (t.type || '').includes('assignment') ||
    (t.subject || '').toLowerCase().includes('cs') ||
    (t.subject || '').toLowerCase().includes('math') ||
    (t.category || '').toLowerCase().includes('cs') ||
    (t.category || '').toLowerCase().includes('math')
  ).length || 5;

  const handleCompleteSession = () => {
    setIsRunning(false);
    toast.success('🎉 Focus session completed! +50 Mindful Focus XP recorded.');
  };

  return (
    <div className="at-a-glance-container">
      <div className="section-label-row">
        <span className="section-label">At a Glance</span>
        <span className="pill-eyebrow forest">Daily Workspace Active</span>
      </div>

      <div className="metrics-row">
        {/* Metric 1: Deadlines - Clickable */}
        <div
          className="metric-card"
          onClick={() => navigate('/tasks')}
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
          title="Click to view all tasks"
        >
          <div className="metric-card-header">
            <span className="metric-label">Deadlines</span>
            <span className="pill-eyebrow coral">{pendingTasks} Pending</span>
          </div>
          <div className="metric-content">
            <span className="metric-number">{pendingTasks}</span>
            <span className="metric-subtext">/ {totalTasks} total ({academicTasks} academic)</span>
          </div>
          <div className="metric-progress-bar">
            <div
              className="metric-progress-fill"
              style={{ width: `${Math.round((completedTasks / (totalTasks || 1)) * 100)}%` }}
            />
          </div>
          <div style={{ fontSize: '0.68rem', color: '#1B3B2E', marginTop: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>View Tasks List</span> <span>→</span>
          </div>
        </div>

        {/* Metric 2: Daily Routine - Clickable */}
        <div
          className="metric-card"
          onClick={() => navigate('/calendar')}
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
          title="Click to open Daily Routine Schedule"
        >
          <div className="metric-card-header">
            <span className="metric-label">Daily Routine</span>
            <span className="pill-eyebrow green">On Track</span>
          </div>
          <div className="routine-ring-box">
            <div className="ring-circle">
              <span>{routinePercent}%</span>
            </div>
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0F172A' }}>3 of 7 habits</div>
              <div style={{ fontSize: '0.70rem', color: '#6B7280' }}>Next: Morning Yoga (12:00 AM)</div>
            </div>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#1F5C3D', marginTop: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>Open Calendar</span> <span>→</span>
          </div>
        </div>

        {/* Metric 3: Study Streak - Clickable */}
        <div
          className="metric-card"
          onClick={() => setIsStreakModalOpen(true)}
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
          title="Click to inspect study streak breakdown"
        >
          <div className="metric-card-header">
            <span className="metric-label">Study Streak</span>
            <span className="pill-eyebrow amber">Top 5%</span>
          </div>
          <div className="metric-content">
            <span className="metric-number">{streakDays}</span>
            <span className="metric-subtext">consecutive days</span>
          </div>
          <div style={{ fontSize: '0.70rem', color: '#6B7280' }}>
            Logged: 2h 45m today
          </div>
          <div
            style={{ fontSize: '0.68rem', color: '#B45309', marginTop: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={(e) => {
              e.stopPropagation();
              setIsStreakModalOpen(true);
            }}
          >
            <span>Streak Details</span> <span>⚡</span>
          </div>
        </div>

        {/* Metric 4: Active Focus Session / Time Tracker */}
        <div className="metric-card" style={{ borderColor: 'rgba(31, 92, 61, 0.25)', background: '#FAFDFB' }}>
          <div className="metric-card-header">
            <span className="metric-label">Active Focus</span>
            <span className="pill-eyebrow green">Pomodoro 50/10</span>
          </div>
          <div className="metric-content" style={{ marginBottom: '2px' }}>
            <span className="metric-number" style={{ fontSize: '1.6rem' }}>
              {formatTime(seconds)}
            </span>
          </div>
          <div style={{ fontSize: '0.70rem', color: '#1B3B2E', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '6px' }}>
            {activeTaskName}
          </div>
          {showTimerControls && (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => {
                  setIsRunning(!isRunning);
                  toast.info(isRunning ? 'Timer paused' : 'Timer resumed');
                }}
                style={{ flex: 1 }}
              >
                {isRunning ? 'Pause' : 'Resume'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => {
                  setSeconds((s) => s + 300);
                  toast.info('+5 minutes added to focus session');
                }}
                title="Add 5 min break"
              >
                +5m
              </button>
              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={handleCompleteSession}
              >
                Complete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Study & Habit Streak Breakdown Modal */}
      <StreakBreakdownModal
        isOpen={isStreakModalOpen}
        onClose={() => setIsStreakModalOpen(false)}
      />
    </div>
  );
}
