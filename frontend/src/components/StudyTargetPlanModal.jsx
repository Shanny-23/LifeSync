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

  const [customGoalInput, setCustomGoalInput] = useState(weeklyGoal.toString());

  // Keep custom input synchronized with weeklyGoal
  useEffect(() => {
    setCustomGoalInput(weeklyGoal.toString());
  }, [weeklyGoal]);

  const [studyBlocks, setStudyBlocks] = useState(() => {
    try {
      const saved = localStorage.getItem('lifesync_daily_study_blocks');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
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
    ];
  });

  // Custom block creation form state
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [newBlockSubject, setNewBlockSubject] = useState('');
  const [newBlockTitle, setNewBlockTitle] = useState('');
  const [newBlockDuration, setNewBlockDuration] = useState('45m');
  const [newBlockTime, setNewBlockTime] = useState('06:00 – 06:45 PM');

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

  const currentHours = currentFocusMinutes / 60;
  const progressPercent = Math.min(100, Math.round((currentHours / (weeklyGoal || 1)) * 100));
  const isOverGoal = currentHours >= weeklyGoal;

  const handleGoalChange = (newGoal) => {
    const num = parseFloat(newGoal);
    if (isNaN(num) || num <= 0) return;
    setWeeklyGoal(num);
    setCustomGoalInput(num.toString());
    try {
      localStorage.setItem('lifesync_weekly_study_goal', String(num));
    } catch {}
    toast.success(`Weekly study target updated to ${num.toFixed(1)} hours!`);
    window.dispatchEvent(new CustomEvent('lifesync:focus-completed'));
  };

  const handleCustomInputSubmit = (e) => {
    e.preventDefault();
    const val = parseFloat(customGoalInput);
    if (!isNaN(val) && val > 0 && val <= 100) {
      handleGoalChange(val);
    } else {
      toast.error('Please enter a target between 0.5 and 100 hours');
    }
  };

  const handleStepGoal = (delta) => {
    const next = Math.max(0.5, Math.min(100, parseFloat((weeklyGoal + delta).toFixed(1))));
    handleGoalChange(next);
  };

  const saveStudyBlocks = (updated) => {
    setStudyBlocks(updated);
    try {
      localStorage.setItem('lifesync_daily_study_blocks', JSON.stringify(updated));
    } catch {}
  };

  const handleCreateCustomBlock = (e) => {
    e.preventDefault();
    if (!newBlockTitle.trim()) {
      toast.error('Please enter a topic title for the focus block');
      return;
    }
    const newBlock = {
      id: Date.now(),
      title: newBlockTitle.trim(),
      subject: (newBlockSubject.trim() || 'General').toUpperCase(),
      duration: newBlockDuration,
      time: newBlockTime.trim() || 'Flexible Time',
      type: newBlockDuration === '20m' ? 'spaced_review' : 'deep_work',
      status: 'upcoming',
    };
    saveStudyBlocks([...studyBlocks, newBlock]);
    setNewBlockTitle('');
    setNewBlockSubject('');
    setIsAddingBlock(false);
    toast.success(`⚡ Added focus block: "${newBlock.title}"`);
  };

  const handleDeleteBlock = (id) => {
    saveStudyBlocks(studyBlocks.filter((b) => b.id !== id));
    toast.info('Study block removed.');
  };

  const handleStartBlock = async (block) => {
    try {
      await completeFocusSession({
        mode: block.type === 'spaced_review' ? 'SPACED_REVIEW' : 'POMODORO',
        duration_seconds: 25 * 60,
        target_name: block.title,
      });
      toast.success(`⚡ Focus session logged for "${block.title}" (+25 XP)!`);
      const updated = studyBlocks.map((b) =>
        b.id === block.id ? { ...b, status: 'completed' } : b
      );
      saveStudyBlocks(updated);
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
          maxWidth: '580px',
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
          {/* 1. Progress Banner with Stepper & Input */}
          <div
            style={{
              background: '#F0FDF4',
              border: '1px solid #86EFAC',
              borderRadius: '12px',
              padding: '16px 18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#14382A', fontFamily: 'monospace' }}>
                  {currentHours.toFixed(1)}h
                </span>
                <span style={{ fontSize: '0.9rem', color: '#166534', fontWeight: 600 }}>
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

            {/* Goal Adjustment Controls: Quick Chips + Direct Custom Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700 }}>
                  Preset Targets:
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

              {/* Direct Custom Number Input & Stepper */}
              <form
                onSubmit={handleCustomInputSubmit}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#FFFFFF',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  border: '1px solid #86EFAC',
                  width: 'fit-content',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: '0.74rem', color: '#166534', fontWeight: 700 }}>
                  Enter Custom Target:
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => handleStepGoal(-0.5)}
                    className="btn btn-secondary btn-xs"
                    style={{ padding: '2px 6px', fontWeight: 800, fontSize: '0.76rem' }}
                    title="Decrease by 0.5h"
                  >
                    –
                  </button>

                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="100"
                    aria-label="Custom weekly study target in hours"
                    value={customGoalInput}
                    onChange={(e) => setCustomGoalInput(e.target.value)}
                    style={{
                      width: '68px',
                      padding: '4px 6px',
                      borderRadius: '6px',
                      border: '1px solid #86EFAC',
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      color: '#14382A',
                      textAlign: 'center',
                      background: '#F0FDF4',
                    }}
                    placeholder="e.g. 15"
                  />

                  <button
                    type="button"
                    onClick={() => handleStepGoal(0.5)}
                    className="btn btn-secondary btn-xs"
                    style={{ padding: '2px 6px', fontWeight: 800, fontSize: '0.76rem' }}
                    title="Increase by 0.5h"
                  >
                    +
                  </button>
                </div>

                <span style={{ fontSize: '0.74rem', color: '#166534', fontWeight: 600 }}>hrs/wk</span>

                <button
                  type="submit"
                  className="btn btn-forest btn-xs"
                  style={{ padding: '4px 10px', fontSize: '0.72rem', fontWeight: 700 }}
                >
                  Set Target
                </button>
              </form>
            </div>
          </div>

          {/* 2. Today's Scheduled Focus Blocks */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase' }}>
                Today's Focus Blocks ({studyBlocks.length})
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => setIsAddingBlock(!isAddingBlock)}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#1F5C3D',
                  borderColor: '#86EFAC',
                  background: isAddingBlock ? '#DCFCE7' : '#FFFFFF',
                }}
              >
                {isAddingBlock ? '✕ Close Form' : '+ Add Focus Block'}
              </button>
            </div>

            {/* Inline Custom Focus Block Input Form */}
            {isAddingBlock && (
              <form
                onSubmit={handleCreateCustomBlock}
                style={{
                  background: '#F8FAFC',
                  border: '1px dashed #94A3B8',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#1E293B' }}>
                  Create New Study Focus Block
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Subject (e.g. CS201)"
                    value={newBlockSubject}
                    onChange={(e) => setNewBlockSubject(e.target.value)}
                    style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8rem' }}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Topic Title (e.g. Graph Algorithms Review)"
                    value={newBlockTitle}
                    onChange={(e) => setNewBlockTitle(e.target.value)}
                    style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8rem' }}
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px' }}>
                  <select
                    value={newBlockDuration}
                    onChange={(e) => setNewBlockDuration(e.target.value)}
                    style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8rem', background: '#FFFFFF' }}
                  >
                    <option value="20m">20m (Spaced Review)</option>
                    <option value="25m">25m (Pomodoro)</option>
                    <option value="45m">45m (Focus Block)</option>
                    <option value="60m">60m (Deep Work)</option>
                    <option value="90m">90m (Extended Study)</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Time slot (e.g. 06:00 – 07:00 PM)"
                    value={newBlockTime}
                    onChange={(e) => setNewBlockTime(e.target.value)}
                    style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8rem' }}
                  />
                  <button
                    type="submit"
                    className="btn btn-forest btn-sm"
                    style={{ padding: '6px 14px', fontSize: '0.78rem', whiteSpace: 'nowrap', fontWeight: 700 }}
                  >
                    + Add Block
                  </button>
                </div>
              </form>
            )}

            {/* List of Study Blocks */}
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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

                      {/* Remove custom block button */}
                      {block.id > 10 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteBlock(block.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#94A3B8',
                            fontSize: '0.85rem',
                            padding: '2px 4px',
                          }}
                          title="Delete custom block"
                        >
                          ✕
                        </button>
                      )}
                    </div>
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
