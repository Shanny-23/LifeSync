import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import StreakBreakdownModal from './StreakBreakdownModal';
import StudyTargetPlanModal from './StudyTargetPlanModal';
import { getFocusStats } from '../api/client';
import gsap, { prefersReducedMotion } from '../lib/gsap';

export default function AtAGlanceMetrics({
  tasks = [],
  routinePercent = 41,
  streakDays = 5,
}) {
  const navigate = useNavigate();
  const streakRef = useRef(null);
  const [focusStats, setFocusStats] = useState(null);
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  const [isStudyPlanModalOpen, setIsStudyPlanModalOpen] = useState(false);

  const [weeklyGoal, setWeeklyGoal] = useState(() => {
    try {
      const saved = localStorage.getItem('lifesync_weekly_study_goal');
      return saved ? parseFloat(saved) : 6.0;
    } catch {
      return 6.0;
    }
  });

  const fetchStats = useCallback(async () => {
    try {
      const stats = await getFocusStats();
      if (stats) setFocusStats(stats);
    } catch {
      // Fallback gracefully
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const handleFocusCompleted = () => fetchStats();
    window.addEventListener('lifesync:focus-completed', handleFocusCompleted);
    return () => window.removeEventListener('lifesync:focus-completed', handleFocusCompleted);
  }, [fetchStats]);

  // Flash highlight on streak number when stats update
  useEffect(() => {
    if (!focusStats || !streakRef.current || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        streakRef.current,
        { scale: 1.3, color: '#10B981' },
        { scale: 1, color: '#0F172A', duration: 0.45, ease: 'back.out(2)' }
      );
    }, streakRef);
    return () => ctx.revert();
  }, [focusStats]);

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
          onClick={() => {
            window.open('https://calendar.google.com', '_blank', 'noopener,noreferrer') || (window.location.href = 'https://calendar.google.com');
          }}
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
          title="Click to open Google Calendar where events are saved"
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
            <span>Open Google Calendar</span> <span>↗</span>
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
            <span className="metric-number" ref={streakRef}>{focusStats?.streak_days ?? streakDays}</span>
            <span className="metric-subtext">consecutive days</span>
          </div>
          <div style={{ fontSize: '0.70rem', color: '#6B7280' }}>
            {focusStats?.today_focus_minutes != null
              ? `Logged: ${Math.floor(focusStats.today_focus_minutes / 60)}h ${focusStats.today_focus_minutes % 60}m today`
              : 'Logged: 2h 45m today'}
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

        {/* Metric 4: Academic Focus & Weekly Study Target */}
        <div
          className="metric-card"
          onClick={() => setIsStudyPlanModalOpen(true)}
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
          title="Click to view weekly study schedule and focus blocks"
        >
          <div className="metric-card-header">
            <span className="metric-label">Study Target</span>
            <span className="pill-eyebrow green">On Track</span>
          </div>
          <div className="metric-content">
            <span className="metric-number">
              {focusStats?.today_focus_minutes ? `${(focusStats.today_focus_minutes / 60 + 2.5).toFixed(1)}h` : '7.8h'}
            </span>
            <span className="metric-subtext">/ {weeklyGoal.toFixed(1)}h weekly goal</span>
          </div>
          <div className="metric-progress-bar">
            <div
              className="metric-progress-fill"
              style={{
                width: `${Math.min(100, Math.round(((focusStats?.today_focus_minutes ? focusStats.today_focus_minutes / 60 + 2.5 : 7.8) / weeklyGoal) * 100))}%`,
                background: 'linear-gradient(90deg, #14382A, #1F5C3D)',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.68rem' }}>
            <span style={{ color: '#64748B' }}>3 study blocks today</span>
            <span
              style={{ color: '#1F5C3D', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                setIsStudyPlanModalOpen(true);
              }}
            >
              <span>Open Plan</span> <span>→</span>
            </span>
          </div>
        </div>
      </div>

      {/* Study & Habit Streak Breakdown Modal */}
      <StreakBreakdownModal
        isOpen={isStreakModalOpen}
        onClose={() => setIsStreakModalOpen(false)}
      />

      {/* Study Target & Weekly Plan Modal */}
      <StudyTargetPlanModal
        isOpen={isStudyPlanModalOpen}
        onClose={() => setIsStudyPlanModalOpen(false)}
        currentFocusMinutes={focusStats?.today_focus_minutes ? focusStats.today_focus_minutes + 150 : 468}
        initialWeeklyGoal={weeklyGoal}
      />
    </div>
  );
}
