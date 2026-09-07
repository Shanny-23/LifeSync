import { useToast } from '../context/ToastContext';

export default function UserProfileModal({ isOpen, onClose }) {
  const toast = useToast();

  if (!isOpen) return null;

  const handleAction = (msg) => {
    toast.info(msg);
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
      <div className="modal-card" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="pill-eyebrow forest">ACCOUNT PROFILE</span>
            <h2 className="modal-title" style={{ fontSize: '1.2rem' }}>User Settings</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* User badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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
              TM
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
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Totok Michael
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0 0' }}>
                totok.michael@university.edu • Computer Science '27
              </p>
              <span className="pill-eyebrow green" style={{ marginTop: '6px' }}>
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
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#B45309' }}>5 Days</div>
              <div style={{ fontSize: '0.68rem', color: '#6B7280', fontWeight: 600 }}>STUDY STREAK</div>
            </div>
            <div style={{ background: '#F8FAFC', padding: '10px 8px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#15803D' }}>88%</div>
              <div style={{ fontSize: '0.68rem', color: '#6B7280', fontWeight: 600 }}>DEADLINE ON-TIME</div>
            </div>
          </div>

          {/* Preferences */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ justifyContent: 'space-between', padding: '10px 14px' }}
              onClick={() => handleAction("Notification preferences updated.")}
            >
              <span>🔔 Notification Preferences</span>
              <span style={{ color: '#94A3B8' }}>›</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ justifyContent: 'space-between', padding: '10px 14px' }}
              onClick={() => handleAction("Connected LMS / Canvas synchronized.")}
            >
              <span>🎓 LMS & Canvas Integrations</span>
              <span style={{ color: '#94A3B8' }}>›</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ justifyContent: 'space-between', padding: '10px 14px' }}
              onClick={() => handleAction("Offline sync cache cleared.")}
            >
              <span>⚡ Cloud Sync & Cache</span>
              <span style={{ color: '#94A3B8' }}>›</span>
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
