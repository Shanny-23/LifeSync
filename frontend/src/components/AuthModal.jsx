import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal() {
  const {
    isAuthModalOpen,
    closeAuthModal,
    user,
    availableProfiles = [],
    loginWithDemo,
    loginWithGoogle,
    loading
  } = useAuth();

  if (!isAuthModalOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 30, 23, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={closeAuthModal}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          border: '1px solid #E5E7EB'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: '#1B3B2E',
            color: '#FFFFFF',
            padding: '24px 28px',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase'
              }}
            >
              Google & Multi-Tenant Identity
            </span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
            Sign In to LifeSync
          </h2>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#D1E0D7' }}>
            Multi-tenant identity, synced academic schedules, and AI ingestion
          </p>

          <button
            onClick={closeAuthModal}
            aria-label="Close modal"
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'none',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '22px',
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px 28px' }}>
          {/* Current Active Account Card or Get Started Card */}
          {user ? (
            <div
              style={{
                backgroundColor: '#F4F7F5',
                border: '1px solid #E2EAE5',
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                marginBottom: '20px'
              }}
            >
              <img
                src={user.avatar || user.picture_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"}
                alt={user.name || 'User'}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid #1F5C3D'
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#1F5C3D', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Active Session
                </div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name || 'Student Account'}
                </div>
                <div style={{ fontSize: '12px', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.email || user.major || 'Authenticated'}
                </div>
              </div>
              <span
                style={{
                  backgroundColor: '#E7F0EA',
                  color: '#1F5C3D',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600
                }}
              >
                Connected
              </span>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px dashed #CBD5E1',
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '20px'
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: '#E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px'
                }}
              >
                🎓
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>
                  Not Signed In
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  Choose Google or pick a student demo profile below.
                </div>
              </div>
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            onClick={loginWithGoogle}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '10px',
              border: '1px solid #D1D5DB',
              backgroundColor: '#FFFFFF',
              color: '#374151',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#F9FAFB')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.27 21.37 7.36 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.27 2.63 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            {loading ? "Authenticating..." : "Continue with Google"}
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              margin: '20px 0',
              color: '#9CA3AF',
              fontSize: '12px'
            }}
          >
            <div style={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB' }} />
            <span style={{ padding: '0 12px', fontWeight: 500 }}>or switch demo student</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB' }} />
          </div>

          {/* Student Demo Persona Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {availableProfiles.map((p) => {
              const isSelected = user?.uid === p.uid || user?.email === p.email;
              return (
                <div
                  key={p.uid}
                  onClick={() => loginWithDemo(p.uid)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid #1F5C3D' : '1px solid #E5E7EB',
                    backgroundColor: isSelected ? '#F2F8F4' : '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = '#F9FAFB';
                  }}
                  onMouseOut={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = '#FFFFFF';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={p.avatar}
                      alt={p.name}
                      style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>
                        {p.major} • {p.streak_days}d streak
                      </div>
                    </div>
                  </div>

                  {isSelected ? (
                    <span style={{ color: '#1F5C3D', fontWeight: 700, fontSize: '18px' }}>✓</span>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#1F5C3D', fontWeight: 600 }}>Switch</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Security & Token Note */}
          <div
            style={{
              marginTop: '20px',
              padding: '10px 14px',
              backgroundColor: '#F8FAFC',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>🔒</span>
            <span>All API calls automatically verify Bearer tokens via Firebase Admin SDK.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
