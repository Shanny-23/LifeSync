import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { recalculatePriorities } from '../api';
import gsap, { animateModalEnter, animateModalExit } from '../lib/gsap';

export default function UserProfileModal({ isOpen, onClose }) {
  const toast = useToast();
  const { user, openAuthModal, logout } = useAuth();
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [activePanel, setActivePanel] = useState('overview'); // overview, notifications, lms, cache
  const [isSyncing, setIsSyncing] = useState(false);

  const backdropRef = useRef(null);
  const modalRef = useRef(null);
  const contentRef = useRef(null);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    animateModalExit(backdropRef.current, modalRef.current, () => {
      setIsClosing(false);
      setShouldRender(false);
      onClose();
    });
  }, [isClosing, onClose]);

  // Sync shouldRender with isOpen prop
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      setActivePanel('overview');
    } else if (shouldRender && !isClosing) {
      handleClose();
    }
  }, [isOpen]);

  // Modal entrance animation
  useEffect(() => {
    if (!shouldRender || isClosing) return;

    const ctx = gsap.context(() => {
      animateModalEnter(backdropRef.current, modalRef.current);
    }, backdropRef);

    return () => ctx.revert();
  }, [shouldRender]);

  // Tab content transition animation
  useEffect(() => {
    if (!contentRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }
      );
    }, contentRef);
    return () => ctx.revert();
  }, [activePanel]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && shouldRender && !isClosing) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shouldRender, isClosing, handleClose]);

  // Notification states (persisted in localStorage)
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('lifesync_notif_prefs');
      return saved ? JSON.parse(saved) : { urgencyChimes: true, dailyDigest: true, overdueAlerts: true };
    } catch {
      return { urgencyChimes: true, dailyDigest: true, overdueAlerts: true };
    }
  });

  // LMS / Canvas state
  const [canvasUrl, setCanvasUrl] = useState(() => {
    try {
      return localStorage.getItem('lifesync_canvas_url') || '';
    } catch {
      return '';
    }
  });

  if (!shouldRender) return null;

  const handleToggleNotif = (key, label) => {
    setNotifications((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('lifesync_notif_prefs', JSON.stringify(updated));
      } catch {}
      toast.info(`${label} ${updated[key] ? 'enabled' : 'disabled'}`);
      return updated;
    });
  };

  const handleSaveLms = (e) => {
    e.preventDefault();
    try {
      localStorage.setItem('lifesync_canvas_url', canvasUrl.trim());
    } catch {}
    if (canvasUrl.trim()) {
      toast.success('🎓 University Canvas / LMS feed configured and saved!');
    } else {
      toast.info('LMS feed URL cleared.');
    }
    setActivePanel('overview');
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      const res = await recalculatePriorities();
      toast.success(`⚡ Cloud sync complete! ${res?.tasks_updated ?? 'All'} tasks refreshed.`);
      window.dispatchEvent(new CustomEvent('lifesync:refresh'));
      setActivePanel('overview');
    } catch (err) {
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearCache = () => {
    try {
      localStorage.removeItem('lifesync_habit_yoga');
      localStorage.removeItem('lifesync_cal_sources');
      toast.success('Local cache cleared successfully.');
    } catch {
      toast.error('Failed to clear cache.');
    }
    setActivePanel('overview');
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'LS';

  return (
    <div
      ref={backdropRef}
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-card" ref={modalRef} style={{ maxWidth: '460px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {activePanel !== 'overview' && (
              <button
                type="button"
                onClick={() => setActivePanel('overview')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#1B3B2E', padding: '0 4px' }}
                title="Back to settings overview"
              >
                ←
              </button>
            )}
            <span className="pill-eyebrow forest">ACCOUNT PROFILE</span>
            <h2 className="modal-title" style={{ fontSize: '1.2rem' }}>
              {activePanel === 'notifications' ? 'Notifications' : activePanel === 'lms' ? 'LMS Integration' : activePanel === 'cache' ? 'Cloud Sync & Cache' : 'User Settings'}
            </h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={handleClose}>✕</button>
        </div>

        <div ref={contentRef} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {activePanel === 'overview' && (
            <>
              {/* User badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {user?.picture_url || user?.avatar ? (
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                      src={user.picture_url || user.avatar}
                      alt={user.name || 'User'}
                      style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid #10B981'
                      }}
                    />
                    <span style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: '#10B981',
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      border: '2px solid #FFFFFF'
                    }} />
                  </div>
                ) : (
                  <div style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    background: '#1B3B2E',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    position: 'relative'
                  }}>
                    {initials}
                    <span style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: '#10B981',
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      border: '2px solid #FFFFFF'
                    }} />
                  </div>
                )}

                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.name || 'LifeSync Student'}
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.email || 'student@university.edu'} • {user?.major || "Computer Science '27"}
                  </p>
                  <span className="pill-eyebrow green" style={{ marginTop: '6px', display: 'inline-block' }}>
                    PRO WORKSPACE SUITE ACTIVE
                  </span>
                </div>
              </div>

              {/* Academic Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                <div style={{ background: '#F8FAFC', padding: '10px 8px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1B3B2E' }}>3.88</div>
                  <div style={{ fontSize: '0.68rem', color: '#6B7280', fontWeight: 600 }}>CUMULATIVE GPA</div>
                </div>
                <div style={{ background: '#F8FAFC', padding: '10px 8px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#B45309' }}>{user?.streak_days || 5} Days</div>
                  <div style={{ fontSize: '0.68rem', color: '#6B7280', fontWeight: 600 }}>STUDY STREAK</div>
                </div>
                <div style={{ background: '#F8FAFC', padding: '10px 8px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#15803D' }}>{user?.completion_rate || 88}%</div>
                  <div style={{ fontSize: '0.68rem', color: '#6B7280', fontWeight: 600 }}>DEADLINE ON-TIME</div>
                </div>
              </div>

              {/* Preferences & Navigation Links */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'space-between', padding: '10px 14px', background: '#F0FDF4', borderColor: '#BBF7D0' }}
                  onClick={() => {
                    onClose();
                    openAuthModal();
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#166534' }}>🔐 Switch Persona / Google Account</span>
                  <span style={{ color: '#166534' }}>›</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'space-between', padding: '10px 14px' }}
                  onClick={() => setActivePanel('notifications')}
                >
                  <span>🔔 Notification Preferences</span>
                  <span style={{ color: '#94A3B8' }}>›</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'space-between', padding: '10px 14px' }}
                  onClick={() => setActivePanel('lms')}
                >
                  <span>🎓 LMS & Canvas Integrations</span>
                  <span style={{ color: '#94A3B8' }}>›</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'space-between', padding: '10px 14px' }}
                  onClick={() => setActivePanel('cache')}
                >
                  <span>⚡ Cloud Sync & Cache</span>
                  <span style={{ color: '#94A3B8' }}>›</span>
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ color: '#EF4444', borderColor: '#FECACA' }}
                  onClick={() => {
                    onClose();
                    logout();
                  }}
                >
                  🚪 Sign Out
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={onClose}
                >
                  Done
                </button>
              </div>
            </>
          )}

          {activePanel === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.82rem', color: '#6B7280' }}>
                Configure real-time notifications and auditory nudges for high urgency deadlines.
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>Urgency Audio Chimes</div>
                  <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>Play sound when timer or session concludes</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.urgencyChimes}
                  onChange={() => handleToggleNotif('urgencyChimes', 'Audio Chimes')}
                  style={{ accentColor: '#1B3B2E', width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>Daily Morning Digest</div>
                  <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>Highlight top 3 tasks at 8:00 AM</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.dailyDigest}
                  onChange={() => handleToggleNotif('dailyDigest', 'Daily Digest')}
                  style={{ accentColor: '#1B3B2E', width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>Escalated Overdue Alerts</div>
                  <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>Banner alerts when tasks exceed deadline</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.overdueAlerts}
                  onChange={() => handleToggleNotif('overdueAlerts', 'Overdue Alerts')}
                  style={{ accentColor: '#1B3B2E', width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ marginTop: '8px' }}
                onClick={() => setActivePanel('overview')}
              >
                Save & Return
              </button>
            </div>
          )}

          {activePanel === 'lms' && (
            <form onSubmit={handleSaveLms} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.82rem', color: '#6B7280' }}>
                Connect your university's Canvas, Blackboard, or Moodle calendar export URL (.ics) for automated timetable synchronization.
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  Canvas / LMS iCal Feed URL
                </label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://canvas.instructure.com/feeds/calendars/user_..."
                  value={canvasUrl}
                  onChange={(e) => setCanvasUrl(e.target.value)}
                />
                <span className="form-helper">
                  Find this in Canvas &gt; Calendar &gt; Calendar Feed &gt; Copy URL
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => setActivePanel('overview')}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1 }}
                >
                  Save LMS Feed
                </button>
              </div>
            </form>
          )}

          {activePanel === 'cache' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.82rem', color: '#6B7280' }}>
                Manage cloud state and client-side cached data.
              </div>

              <div style={{ padding: '12px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0F172A' }}>Force Cloud Recalculation</div>
                <div style={{ fontSize: '0.74rem', color: '#6B7280', margin: '4px 0 10px 0' }}>
                  Invokes the server-side priority recalculation engine across all database tasks.
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-xs"
                  onClick={handleForceSync}
                  disabled={isSyncing}
                >
                  {isSyncing ? 'Recalculating...' : '🔄 Recalculate Now'}
                </button>
              </div>

              <div style={{ padding: '12px', borderRadius: '8px', background: '#FEF2F2', border: '1px solid #FECACA' }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#991B1B' }}>Reset Offline Cache</div>
                <div style={{ fontSize: '0.74rem', color: '#B91C1C', margin: '4px 0 10px 0' }}>
                  Clears local browser preferences, saved habit states, and offline feed toggles.
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  style={{ color: '#DC2626', borderColor: '#FCA5A5' }}
                  onClick={handleClearCache}
                >
                  Clear Local Storage Cache
                </button>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setActivePanel('overview')}
              >
                Back to Settings
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
