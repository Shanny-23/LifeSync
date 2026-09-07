import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { completeFocusSession } from '../api/client';

export default function StudyTargetPlanModal({
  isOpen,
  onClose,
  currentFocusMinutes = 468, // ~7.8h as in screenshot
  initialWeeklyGoal = 6.0,
}) {
  const navigate = useNavigate();
  const toast = useToast();

  const [weeklyGoal, setWeeklyGoal] = useState(() => {
    try {
      const saved = localStorage.getItem('lifesync_weekly_study_goal');
      return saved ? parseFloat(saved) : initialWeeklyGoal;
    } catch {
      return initialWeeklyGoal;
    }
  });

  const [studyBlocks, setStudyBlocks] = useState([
    {
      id: 1,
      title: 'Data Structures & Dynamic Programming',
      type: 'deep_work',
      duration: '45m',
      time: '10:00 – 10:45 AM',
      status: 'completed',
      subject: 'CS201',
    },
    {
      id: 2,
      title: 'Probability & Markov Chains (Active Recall)',
      type: 'spaced_review',
      duration: '20m',
      time: '02:00 – 02:20 PM',
      status: 'active',
      subject: 'Math 204',
    },
    {
      id: 3,
      title: 'OS Process Concurrency & Semaphores',
      type: 'deep_work',
      duration: '60m',
      time: '04:30 – 05:30 PM',
      status: 'upcoming',
      subject: 'CS304',
    },
  ]);

  // Keyboard shortcut listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentHours = (currentFocusMinutes / 60);
  const progressPercent = Math.min(100, Math.round((currentHours / (weeklyGoal || 1)) * 100));
  const isOverGoal = currentHours >= weeklyGoal;

  const handleGoalChange = (newGoal) => {
    setWeeklyGoal(newGoal);
    try {
      localStorage.setItem('lifesync_weekly_study_goal', String(newGoal));
    } catch {}
    toast.success(`Weekly study target updated to ${newGoal.toFixed(1)} hours!`);
    window.dispatchEvent(new CustomEvent('lifesync:focus-completed'));
  };

  const handleStartBlock = async (block) => {
    try {
      await completeFocusSession({
        mode: block.type === 'spaced_review' ? 'SPACED_REVIEW' : 'POMODORO',
        duration_seconds: 25 * 60,
        target_name: block.title,
      });
      toast.success(`⚡ Focus session logged for "${block.title}" (+25 XP)!`);
      setStudyBlocks((prev) =>
        prev.map((b) => (b.id === block.id ? { ...b, status: 'completed' } : b))
      );
      window.dispatchEvent(new CustomEvent('lifesync:focus-completed'));
    } catch {
      toast.info(`Starting focus session for: ${block.title}`);
    }
  };

  const handleViewTimeline = () => {
    onClose();
    if (window.location.pathname.includes('/calendar')) {
      const el = document.getElementById('calendar-timeline-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        toast.info('Scrolled to Day Timeline commitments.');
      }
    } else {
      navigate('/calendar');
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="modal-card"
        style={{
          maxWidth: '560px',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #14382A 0%, #1F5C3D 100%)',
            padding: '18px 22px',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: '#FFFFFF',
                  fontSize: '0.66rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  letterSpacing: '0.04em',
                }}
              >
                Academic Study Plan
              </span>
              <span style={{ fontSize: '0.74rem', color: '#86EFAC', fontWeight: 700 }}>
                {isOverGoal ? '🌟 Target Exceeded' : 'On Track'}
              </span>
            </div>
            <h2
              style={{
                fontSize: '1.2rem',
                fontWeight: 800,
                color: '#FFFFFF',
                margin: '4px 0 0 0',
              }}
            >
              Weekly Study Target & Focus Allocation
            </h2>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* 1. Progress Banner */}
          <div
            style={{
              background: '#F0FDF4',
              border: '1px solid #86EFAC',
              borderRadius: '12px',
              padding: '16px 18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
              <div>
                <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#14382A', fontFamily: 'monospace' }}>
                  {currentHours.toFixed(1)}h
                </span>
                <span style={{ fontSize: '0.9rem', color: '#166534', marginLeft: '8px', fontWeight: 600 }}>
                  / {weeklyGoal.toFixed(1)}h weekly target
                </span>
              </div>
              <span
                className="pill-eyebrow green"
                style={{ fontSize: '0.72rem', fontWeight: 800 }}
              >
                {progressPercent}% Achieved
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{ height: '8px', background: '#DCFCE7', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #15803D, #10B981)',
                  width: `${Math.min(100, progressPercent)}%`,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            {/* Goal Selector Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700 }}>
                Adjust Target:
              </span>
              {[4.0, 6.0, 8.0, 10.0, 12.0].map((goal) => {
                const isSelected = weeklyGoal === goal;
                return (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => handleGoalChange(goal)}
                    style={{
                      background: isSelected ? '#15803D' : '#FFFFFF',
                      color: isSelected ? '#FFFFFF' : '#166534',
                      border: `1px solid ${isSelected ? '#15803D' : '#86EFAC'}`,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {goal.toFixed(1)}h
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Today's Scheduled Focus Blocks */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase' }}>
                Today's Focus Blocks ({studyBlocks.length})
              </span>
              <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                Curated around your fixed classes
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {studyBlocks.map((block) => {
                const isDone = block.status === 'completed';
                const isActive = block.status === 'active';
                const isSpaced = block.type === 'spaced_review';

                return (
                  <div
                    key={block.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: isDone ? '#F8FAFC' : isActive ? '#FEF3C7' : '#FFFFFF',
                      border: `1px solid ${isDone ? '#E2E8F0' : isActive ? '#FCD34D' : '#CBD5E1'}`,
                      borderLeft: `4px solid ${isDone ? '#10B981' : isActive ? '#D97706' : '#3B82F6'}`,
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: isSpaced ? '#FDE68A' : '#E2E8F0',
                            color: isSpaced ? '#92400E' : '#334155',
                          }}
                        >
                          {block.subject}
                        </span>
                        <strong
                          style={{
                            fontSize: '0.86rem',
                            color: isDone ? '#64748B' : '#0F172A',
                            textDecoration: isDone ? 'line-through' : 'none',
                          }}
                        >
                          {block.title}
                        </strong>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>
                        {block.time} • {block.duration} Duration
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        background: isDone ? '#F1F5F9' : isActive ? '#D97706' : '#1F5C3D',
                        color: isDone ? '#94A3B8' : '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: isDone ? 'default' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                      onClick={() => !isDone && handleStartBlock(block)}
                      disabled={isDone}
                    >
                      {isDone ? '✓ Completed' : isActive ? '⚡ Start Block' : 'Start Focus'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 22px',
            background: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleViewTimeline}
            style={{ fontWeight: 600 }}
          >
            📅 View Day Timeline Commitments ↓
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-forest btn-sm"
              onClick={onClose}
              style={{ fontWeight: 700 }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
