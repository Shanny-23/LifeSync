import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function StreakBreakdownModal({ isOpen, onClose }) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleGoToDeepDive = () => {
    onClose();
    navigate('/streak-details');
  };

  return (
    <div
      className="streak-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-breakdown-title"
    >
      <div
        className="streak-breakdown-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Section */}
        <div className="streak-modal-header streak-seq-1">
          <div className="streak-header-left">
            <div className="streak-flame-badge-wrap">
              <div className="streak-flame-circle">
                <span>🔥</span>
              </div>
              <span className="streak-count-bubble">5</span>
            </div>
            <div>
              <h2 id="streak-breakdown-title" className="streak-modal-title">
                Study & Habit Streak Breakdown
              </h2>
              <div className="streak-momentum-row">
                <span className="streak-momentum-text">
                  Current Momentum: <strong>5-Day Active Streak</strong>
                </span>
                <span className="streak-top-badge">Top 5% among students</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="streak-close-btn"
            onClick={onClose}
            aria-label="Close Streak Modal"
          >
            ✕
          </button>
        </div>

        {/* 4 Stat Cards Grid */}
        <div className="streak-stats-grid">
          {/* Card 1: Current Streak (Dark Emerald) */}
          <div className="streak-card streak-card-current streak-seq-2">
            <div className="streak-card-top">
              <span className="streak-card-label highlight">CURRENT STREAK</span>
              <span className="streak-card-icon">⚡</span>
            </div>
            <div className="streak-card-body">
              <span className="streak-card-value">5</span>
              <span className="streak-card-unit">Days Active</span>
            </div>
            <div className="streak-card-sub highlight">Streak goal: 7 days</div>
          </div>

          {/* Card 2: All-Time Best */}
          <div className="streak-card streak-seq-3">
            <div className="streak-card-top">
              <span className="streak-card-label">ALL-TIME BEST</span>
              <span className="streak-card-icon">🏆</span>
            </div>
            <div className="streak-card-body">
              <span className="streak-card-value">19</span>
              <span className="streak-card-unit">Days</span>
            </div>
            <div className="streak-card-sub">Set during Midterms (Mar)</div>
          </div>

          {/* Card 3: Total Focus Time */}
          <div className="streak-card streak-seq-4">
            <div className="streak-card-top">
              <span className="streak-card-label">TOTAL FOCUS TIME</span>
              <span className="streak-card-icon">⏱️</span>
            </div>
            <div className="streak-card-body">
              <span className="streak-card-value">34.5</span>
              <span className="streak-card-unit">Hours</span>
            </div>
            <div className="streak-card-sub">Avg 6.9 hrs / day</div>
          </div>

          {/* Card 4: Streak Freezes */}
          <div className="streak-card streak-seq-5">
            <div className="streak-card-top">
              <span className="streak-card-label">STREAK FREEZES</span>
              <span className="streak-card-icon">❄️</span>
            </div>
            <div className="streak-card-body">
              <span className="streak-card-value">1</span>
              <span className="streak-card-unit">Available</span>
            </div>
            <div className="streak-card-sub">Auto-shields tomorrow</div>
          </div>
        </div>

        {/* Weekly Milestone Tracker */}
        <div className="streak-milestone-panel streak-seq-6">
          <div className="streak-milestone-header">
            <span className="streak-milestone-title">Weekly Milestone Tracker</span>
            <span className="streak-milestone-target">5/7 Target Met</span>
          </div>

          <div className="streak-days-row">
            {/* Monday 14 */}
            <div className="streak-day-item done">
              <span className="streak-day-name">M</span>
              <div className="streak-day-disc checked">
                <span>✓</span>
              </div>
              <span className="streak-day-num">14</span>
            </div>

            {/* Tuesday 15 */}
            <div className="streak-day-item done">
              <span className="streak-day-name">T</span>
              <div className="streak-day-disc checked">
                <span>✓</span>
              </div>
              <span className="streak-day-num">15</span>
            </div>

            {/* Wednesday 16 */}
            <div className="streak-day-item done">
              <span className="streak-day-name">W</span>
              <div className="streak-day-disc checked">
                <span>✓</span>
              </div>
              <span className="streak-day-num">16</span>
            </div>

            {/* Thursday 17 */}
            <div className="streak-day-item done">
              <span className="streak-day-name">T</span>
              <div className="streak-day-disc checked">
                <span>✓</span>
              </div>
              <span className="streak-day-num">17</span>
            </div>

            {/* Friday 18 - Active Current Day */}
            <div className="streak-day-item active-today">
              <span className="streak-day-name active">F</span>
              <div className="streak-day-disc active-flame">
                <span>🔥</span>
              </div>
              <span className="streak-day-num active">18</span>
            </div>

            {/* Saturday 19 - Locked */}
            <div className="streak-day-item locked">
              <span className="streak-day-name">S</span>
              <div className="streak-day-disc locked">
                <span>🔒</span>
              </div>
              <span className="streak-day-num">19</span>
            </div>

            {/* Sunday 20 - Locked */}
            <div className="streak-day-item locked">
              <span className="streak-day-name">S</span>
              <div className="streak-day-disc locked">
                <span>🔒</span>
              </div>
              <span className="streak-day-num">20</span>
            </div>
          </div>
        </div>

        {/* Motivational Callout Banner */}
        <div className="streak-motivation-banner streak-seq-7">
          <div className="streak-banner-icon">
            <span>📈</span>
          </div>
          <div className="streak-banner-text">
            Maintaining a 7-day streak boosts exam retention rates by up to 34%. Two more days to complete the weekly sprint!
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="streak-modal-footer streak-seq-8">
          <button
            type="button"
            className="streak-btn-close"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="streak-btn-deepdive"
            onClick={handleGoToDeepDive}
          >
            <span>View Full Breakdown Day-by-Day & Week-by-Week</span>
            <span className="streak-btn-arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
