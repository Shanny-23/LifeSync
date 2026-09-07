import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthModal() {
  const {
    isAuthModalOpen,
    closeAuthModal,
    user,
    availableProfiles = [],
    loginWithDemo,
    loginWithEmail,
    register,
    loginWithGoogle,
    loading
  } = useAuth();

  const navigate = useNavigate();
  const [tab, setTab] = useState('signin'); // 'signin' | 'signup' | 'demo'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [major, setMajor] = useState('Computer Science & AI');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (tab === 'signin') {
        if (!email.trim()) {
          setError('Please enter your university or student email.');
          setSubmitting(false);
          return;
        }
        await loginWithEmail(email, password);
        navigate('/dashboard');
      } else if (tab === 'signup') {
        if (!name.trim()) {
          setError('Please enter your full name.');
          setSubmitting(false);
          return;
        }
        if (!email.trim() || !email.includes('@')) {
          setError('Please enter a valid email.');
          setSubmitting(false);
          return;
        }
        await register({ name, email, password, major });
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSelect = async (uid) => {
    setSubmitting(true);
    try {
      await loginWithDemo(uid);
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to switch to demo profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const goToFullLoginPage = () => {
    closeAuthModal();
    navigate('/login');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 30, 23, 0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={closeAuthModal}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#FFFFFF',
          borderRadius: '18px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
          border: '1px solid #E5E7EB',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: '#14382A',
            color: '#FFFFFF',
            padding: '22px 24px',
            position: 'relative',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase'
              }}
            >
              Academic Identity
            </span>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            {user ? 'Manage LifeSync Session' : 'Sign In to LifeSync'}
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#D1E0D7' }}>
            Sync schedules, syllabus dates, and AI study intervals
          </p>

          <button
            onClick={closeAuthModal}
            aria-label="Close modal"
            style={{
              position: 'absolute',
              top: '18px',
              right: '18px',
              background: 'none',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '24px',
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        {!user && (
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid #E5E7EB',
              backgroundColor: '#F9FAFB',
              flexShrink: 0
            }}
          >
            <button
              type="button"
              onClick={() => { setTab('signin'); setError(''); }}
              style={{
                flex: 1,
                padding: '11px 12px',
                border: 'none',
                background: tab === 'signin' ? '#FFFFFF' : 'transparent',
                fontWeight: tab === 'signin' ? 700 : 500,
                color: tab === 'signin' ? '#14382A' : '#6B7280',
                borderBottom: tab === 'signin' ? '2.5px solid #10B981' : '2.5px solid transparent',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setTab('signup'); setError(''); }}
              style={{
                flex: 1,
                padding: '11px 12px',
                border: 'none',
                background: tab === 'signup' ? '#FFFFFF' : 'transparent',
                fontWeight: tab === 'signup' ? 700 : 500,
                color: tab === 'signup' ? '#14382A' : '#6B7280',
                borderBottom: tab === 'signup' ? '2.5px solid #10B981' : '2.5px solid transparent',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => { setTab('demo'); setError(''); }}
              style={{
                flex: 1,
                padding: '11px 12px',
                border: 'none',
                background: tab === 'demo' ? '#FFFFFF' : 'transparent',
                fontWeight: tab === 'demo' ? 700 : 500,
                color: tab === 'demo' ? '#14382A' : '#6B7280',
                borderBottom: tab === 'demo' ? '2.5px solid #10B981' : '2.5px solid transparent',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              1-Click Demo
            </button>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto' }}>
          {error && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                color: '#991B1B',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '0.82rem',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* If user is active */}
          {user ? (
            <div>
              <div
                style={{
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  marginBottom: '16px'
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
                    border: '2px solid #10B981'
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>
                    Signed In
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name || 'Student'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.email || user.major || 'Active Student Session'}
                  </div>
                </div>
                <span
                  style={{
                    backgroundColor: '#DCFCE7',
                    color: '#15803D',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700
                  }}
                >
                  Active
                </span>
              </div>

              <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>
                Switch Student Profile:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {availableProfiles.map((p) => (
                  <div
                    key={p.uid}
                    onClick={() => handleDemoSelect(p.uid)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: user?.uid === p.uid ? '2px solid #10B981' : '1px solid #E5E7EB',
                      backgroundColor: user?.uid === p.uid ? '#F0FDF4' : '#FFFFFF',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={p.avatar} alt={p.name} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: '11px', color: '#6B7280' }}>{p.major}</div>
                      </div>
                    </div>
                    {user?.uid === p.uid ? (
                      <span style={{ color: '#10B981', fontWeight: 700 }}>✓ Current</span>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#10B981', fontWeight: 600 }}>Switch</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Unauthenticated Forms */
            <>
              {tab !== 'demo' ? (
                <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {tab === 'signup' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Alex Morgan"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid #D1D5DB',
                          fontSize: '0.9rem',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                      Student / University Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="student@university.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #D1D5DB',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                      Password
                    </label>
                    <input
                      type="password"
                      placeholder={tab === 'signin' ? 'Enter password (or leave blank for demo)' : 'Create password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #D1D5DB',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {tab === 'signup' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                        Department / Major
                      </label>
                      <select
                        value={major}
                        onChange={(e) => setMajor(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid #D1D5DB',
                          fontSize: '0.9rem',
                          backgroundColor: '#FFFFFF',
                          boxSizing: 'border-box'
                        }}
                      >
                        <option value="Computer Science & AI">Computer Science & AI</option>
                        <option value="Biomedical Engineering">Biomedical Engineering</option>
                        <option value="Data Science & Analytics">Data Science & Analytics</option>
                      </select>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || loading}
                    style={{
                      marginTop: '6px',
                      width: '100%',
                      padding: '11px 16px',
                      backgroundColor: '#14382A',
                      color: '#FFFFFF',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(20, 56, 42, 0.25)'
                    }}
                  >
                    {submitting ? 'Authenticating...' : tab === 'signin' ? 'Sign In →' : 'Register Account →'}
                  </button>
                </form>
              ) : (
                /* Demo profiles tab */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#6B7280', marginBottom: '4px' }}>
                    Select a student persona to immediately explore active tasks and calendar sync:
                  </div>
                  {availableProfiles.map((p) => (
                    <div
                      key={p.uid}
                      onClick={() => handleDemoSelect(p.uid)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: '1px solid #E5E7EB',
                        backgroundColor: '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#F0FDF4';
                        e.currentTarget.style.borderColor = '#10B981';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '#FFFFFF';
                        e.currentTarget.style.borderColor = '#E5E7EB';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={p.avatar} alt={p.name} style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{p.name}</div>
                          <div style={{ fontSize: '12px', color: '#6B7280' }}>{p.major} • {p.streak_days}d streak</div>
                        </div>
                      </div>
                      <span style={{ fontSize: '12px', color: '#047857', fontWeight: 700 }}>Enter →</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Divider */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  margin: '18px 0',
                  color: '#9CA3AF',
                  fontSize: '12px'
                }}
              >
                <div style={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB' }} />
                <span style={{ padding: '0 10px', fontWeight: 500 }}>or</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB' }} />
              </div>

              {/* Google Sign In Button */}
              <button
                onClick={loginWithGoogle}
                disabled={loading || submitting}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  backgroundColor: '#FFFFFF',
                  color: '#374151',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
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
                Continue with Google
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: '#F8FAFC',
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#6B7280',
            flexShrink: 0
          }}
        >
          <button
            type="button"
            onClick={goToFullLoginPage}
            style={{
              background: 'none',
              border: 'none',
              color: '#10B981',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0
            }}
          >
            Open Dedicated Sign-in Page ↗
          </button>
          <span>🔒 256-bit Encrypted</span>
        </div>
      </div>
    </div>
  );
}
