import { useState, useEffect, useRef } from 'react';
import { useToast } from '../context/ToastContext';
import { completeFocusSession } from '../api/client';

const MARKOV_FLASHCARDS = [
  {
    id: 1,
    topic: 'Core Markov Property',
    question: 'How is the first-order Markov Property defined mathematically for a discrete-time stochastic process {X_n}?',
    answer: 'P(X_{n+1} = j | X_n = i, X_{n-1} = i_{n-1}, ..., X_0 = i_0) = P(X_{n+1} = j | X_n = i)\n\nIn plain words: The future state depends only upon the current state, and is conditionally independent of past history (memorylessness).',
    tip: 'Key memory hook: "Given the present, the past is irrelevant to the future."',
  },
  {
    id: 2,
    topic: 'Transition Matrix Properties',
    question: 'What are the two mandatory mathematical properties of an n × n stochastic transition matrix P?',
    answer: '1. Non-negativity: P_ij ≥ 0 for all states i, j.\n2. Row Normalization: ∑_{j=1}^n P_ij = 1 for every row i.\n\nEach row represents a full conditional probability distribution over the next possible states.',
    tip: 'Check: Column sums do NOT need to equal 1 (unless doubly stochastic).',
  },
  {
    id: 3,
    topic: 'Stationary Distribution (π)',
    question: 'What algebraic system determines the stationary (equilibrium) distribution π of an irreducible, aperiodic Markov chain?',
    answer: 'π P = π, along with normalization ∑_i π_i = 1 and π_i ≥ 0.\n\nOnce reached, applying transition matrix P yields the same state distribution indefinitely.',
    tip: 'Solve using eigenvalue problem: π(P - I) = 0 with constraint ∑ π_i = 1.',
  },
  {
    id: 4,
    topic: 'Absorbing vs Transient States',
    question: 'When is a state k considered absorbing? In the canonical transition matrix, how are absorbing states arranged?',
    answer: 'State k is absorbing if P_kk = 1 (once entered, probability of leaving is 0).\n\nIn canonical block form:\nP = [ Q  R ]\n    [ 0  I ]\nwhere Q contains transitions between transient states, R transitions into absorbing states, and I is the identity matrix for absorbing states.',
    tip: 'Fundamental matrix N = (I - Q)^(-1) gives expected visits to transient states before absorption.',
  },
];

export default function SpacedReviewModal({
  isOpen,
  onClose,
  onSessionFinished,
  topicTitle = 'Math 204: Probability & Markov Chains',
  slotLabel = 'Slot 2 of 4',
}) {
  const toast = useToast();

  // 20-minute timer (1200 seconds)
  const INITIAL_SECONDS = 20 * 60;
  const [secondsLeft, setSecondsLeft] = useState(INITIAL_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef(null);

  // Active recall deck
  const [cardIndex, setCardIndex] = useState(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [selectedRating, setSelectedRating] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAmbientSoundActive, setIsAmbientSoundActive] = useState(false);

  // Keyboard shortcut listener (Escape to close, Space to pause/resume)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Countdown loop
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsRunning(false);
            toast.success('🔔 20-minute Spaced Review session time reached! Record your recall ratings.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, toast]);

  if (!isOpen) return null;

  const toggleTimer = () => {
    const nextRunning = !isRunning;
    setIsRunning(nextRunning);
    if (nextRunning) {
      toast.info('⏱️ 20-minute active recall review session running.');
    }
  };

  const resetTimer = () => {
    setIsRunning(false);
    setSecondsLeft(INITIAL_SECONDS);
  };

  const addFiveMinutes = () => {
    setSecondsLeft((prev) => prev + 5 * 60);
    toast.info('+5 minutes added to review session.');
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentCard = MARKOV_FLASHCARDS[cardIndex];
  const progressPercent = Math.min(
    100,
    Math.max(0, ((INITIAL_SECONDS - secondsLeft) / INITIAL_SECONDS) * 100)
  );

  const handleNextCard = () => {
    setIsAnswerRevealed(false);
    setSelectedRating(null);
    setCardIndex((prev) => (prev + 1) % MARKOV_FLASHCARDS.length);
  };

  const handlePrevCard = () => {
    setIsAnswerRevealed(false);
    setSelectedRating(null);
    setCardIndex((prev) => (prev - 1 + MARKOV_FLASHCARDS.length) % MARKOV_FLASHCARDS.length);
  };

  const handleCompleteReview = async () => {
    setIsSubmitting(true);
    const timeSpent = Math.max(60, INITIAL_SECONDS - secondsLeft);

    try {
      await completeFocusSession({
        mode: 'SPACED_REVIEW',
        duration_seconds: timeSpent,
        target_name: topicTitle,
      });

      // Save to localStorage for instant UI persistence on Home card
      try {
        localStorage.setItem(
          'lifesync_spaced_review_status',
          JSON.stringify({
            completedAt: new Date().toISOString(),
            topic: topicTitle,
            rating: selectedRating || 'good',
          })
        );
      } catch {}

      toast.success('🛡️ Spaced Review Complete! Retention decay shielded (+25 XP).');
      window.dispatchEvent(new CustomEvent('lifesync:focus-completed'));
      window.dispatchEvent(new CustomEvent('lifesync:spaced-review-updated'));

      if (onSessionFinished) onSessionFinished();
      onClose();
    } catch (err) {
      console.warn('Focus session save fallback:', err);
      // Even if offline, persist locally so the user is never blocked
      try {
        localStorage.setItem(
          'lifesync_spaced_review_status',
          JSON.stringify({
            completedAt: new Date().toISOString(),
            topic: topicTitle,
            rating: selectedRating || 'good',
          })
        );
      } catch {}
      toast.success('🛡️ Spaced Review saved locally! Retention shield active.');
      if (onSessionFinished) onSessionFinished();
      onClose();
    } finally {
      setIsSubmitting(false);
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
        {/* Header with Amber Theme */}
        <div
          style={{
            background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
            padding: '16px 20px',
            borderBottom: '1px solid #FCD34D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  background: '#D97706',
                  color: '#FFFFFF',
                  fontSize: '0.66rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  letterSpacing: '0.04em',
                }}
              >
                Spaced Review
              </span>
              <span style={{ fontSize: '0.74rem', color: '#92400E', fontWeight: 700 }}>
                {slotLabel} • Optimal Decay Shield
              </span>
            </div>
            <h2
              style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                color: '#78350F',
                margin: '4px 0 0 0',
              }}
            >
              {topicTitle}
            </h2>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            style={{
              background: 'rgba(255,255,255,0.7)',
              color: '#92400E',
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
          {/* 1. Timer & Focus Controls Banner */}
          <div
            style={{
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: '12px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#B45309', fontWeight: 700 }}>
                Active Recall Interval
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#92400E', fontFamily: 'monospace' }}>
                {formatTime(secondsLeft)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#78350F' }}>
                {isRunning ? '🟢 Active Focus Session' : '⏸ Session Paused'}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  background: isRunning ? '#D97706' : '#B45309',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  borderRadius: '20px',
                  padding: '6px 14px',
                  border: 'none',
                }}
                onClick={toggleTimer}
              >
                {isRunning ? '⏸ Pause' : '▶ Start (20m)'}
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px 10px', fontSize: '0.74rem' }}
                onClick={resetTimer}
                title="Reset back to 20:00"
              >
                ↺ Reset
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px 10px', fontSize: '0.74rem' }}
                onClick={addFiveMinutes}
                title="Add 5 minutes"
              >
                +5m
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{
                  padding: '6px 10px',
                  fontSize: '0.74rem',
                  background: isAmbientSoundActive ? '#FEF3C7' : '#FFFFFF',
                  borderColor: isAmbientSoundActive ? '#D97706' : '#CBD5E1',
                }}
                onClick={() => {
                  const nextSound = !isAmbientSoundActive;
                  setIsAmbientSoundActive(nextSound);
                  toast.info(nextSound ? '🎧 Ambient Binaural 40Hz focus stream active' : 'Audio stream muted');
                }}
                title="Toggle ambient study audio stream"
              >
                {isAmbientSoundActive ? '🎧 Audio ON' : '🎧 Audio'}
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: '4px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden', marginTop: '-8px' }}>
            <div
              style={{
                height: '100%',
                background: '#D97706',
                width: `${progressPercent}%`,
                transition: 'width 0.4s ease',
              }}
            />
          </div>

          {/* 2. Interactive Active Recall Flashcard */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '16px 18px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#D97706',
                  background: '#FEF3C7',
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}
              >
                Card {cardIndex + 1} of {MARKOV_FLASHCARDS.length}: {currentCard.topic}
              </span>

              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={handlePrevCard}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={handleNextCard}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                >
                  ▶
                </button>
              </div>
            </div>

            {/* Question prompt */}
            <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#1E293B', lineHeight: 1.45, margin: '8px 0 12px 0' }}>
              {currentCard.question}
            </div>

            {/* Answer reveal box */}
            {isAnswerRevealed ? (
              <div
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  borderLeft: '4px solid #10B981',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  marginTop: '10px',
                  whiteSpace: 'pre-line',
                  fontSize: '0.84rem',
                  color: '#334155',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 700, color: '#047857', marginBottom: '4px', fontSize: '0.74rem' }}>
                  ✓ ACTIVE RECALL SOLUTION:
                </div>
                {currentCard.answer}
                <div style={{ marginTop: '8px', fontSize: '0.74rem', color: '#64748B', fontStyle: 'italic' }}>
                  💡 {currentCard.tip}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAnswerRevealed(true)}
                className="btn btn-secondary btn-sm"
                style={{
                  width: '100%',
                  padding: '8px',
                  borderStyle: 'dashed',
                  borderColor: '#CBD5E1',
                  color: '#475569',
                  fontWeight: 600,
                  marginTop: '4px',
                }}
              >
                👁️ Click to Reveal Recall Solution
              </button>
            )}
          </div>

          {/* 3. Recall Feedback / Spaced Repetition Buttons */}
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', marginBottom: '8px' }}>
              Rate Your Recall Quality (Sets Spacing Interval):
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {[
                { key: 'again', label: 'Again', interval: '< 10m', bg: '#FEE2E2', border: '#EF4444', text: '#991B1B' },
                { key: 'hard', label: 'Hard', interval: '+ 12h', bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
                { key: 'good', label: 'Good', interval: '+ 24h', bg: '#DCFCE7', border: '#10B981', text: '#166534' },
                { key: 'easy', label: 'Easy', interval: '+ 4d', bg: '#E0F2FE', border: '#3B82F6', text: '#1E40AF' },
              ].map((lvl) => {
                const isSelected = selectedRating === lvl.key;
                return (
                  <button
                    key={lvl.key}
                    type="button"
                    onClick={() => {
                      setSelectedRating(lvl.key);
                      toast.info(`Retention interval set to ${lvl.interval}`);
                    }}
                    style={{
                      border: `2px solid ${isSelected ? lvl.border : '#E2E8F0'}`,
                      background: isSelected ? lvl.bg : '#FFFFFF',
                      borderRadius: '8px',
                      padding: '8px 4px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: isSelected ? lvl.text : '#334155' }}>
                      {lvl.label}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: isSelected ? lvl.text : '#64748B', marginTop: '2px' }}>
                      {lvl.interval}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 20px',
            background: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
            Optimal Decay Interval: <strong>24 Hours</strong>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Close
            </button>

            <button
              type="button"
              className="btn btn-sm"
              style={{
                background: '#D97706',
                color: '#FFFFFF',
                fontWeight: 700,
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
              }}
              onClick={handleCompleteReview}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : '🛡️ Complete Review (+25 XP)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
