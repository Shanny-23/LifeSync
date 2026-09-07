import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, loginWithEmail, register, loginWithGoogle, loginWithDemo, availableProfiles = [], loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Mode: 'signin' | 'signup' | 'demo'
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [major, setMajor] = useState('Computer Science & AI');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // If already authenticated, redirect to /dashboard
  useEffect(() => {
    if (user && !loading) {
      const destination = location.state?.from || '/dashboard';
      navigate(destination, { replace: true });
    }
  }, [user, loading, navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        if (!email.trim()) {
          setErrorMessage('Please enter your student or university email.');
          setIsSubmitting(false);
          return;
        }
        await loginWithEmail(email, password);
        navigate('/dashboard');
      } else if (mode === 'signup') {
        if (!name.trim()) {
          setErrorMessage('Please enter your full name.');
          setIsSubmitting(false);
          return;
        }
        if (!email.trim() || !email.includes('@')) {
          setErrorMessage('Please enter a valid university email.');
          setIsSubmitting(false);
          return;
        }
        await register({ name, email, password, major });
        navigate('/dashboard');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoClick = async (personaUid) => {
    setIsSubmitting(true);
    try {
      await loginWithDemo(personaUid);
      navigate('/dashboard');
    } catch (err) {
      setErrorMessage('Could not sign in with demo profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0D261C 0%, #14382A 50%, #1A4735 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        color: '#FFFFFF',
        position: 'relative'
      }}
    >
      {/* Background ambient lighting */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '20%',
          width: '350px',
          height: '350px',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none',
          filter: 'blur(40px)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '18%',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(52, 211, 153, 0.12) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none',
          filter: 'blur(50px)'
        }}
      />

      {/* Top Navigation */}
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          zIndex: 2
        }}
      >
        <Link
          to="/landing"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: '#A7F3D0',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: 500,
            transition: 'color 0.15s ease'
          }}
        >
          ← Back to Overview
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src="/logo.png"
            alt="LifeSync Logo"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              objectFit: 'cover',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
            }}
          />
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
            LifeSync
          </span>
          <span
            style={{
              background: 'rgba(16, 185, 129, 0.25)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#34D399',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.72rem',
              fontWeight: 700
            }}
          >
            v1.0
          </span>
        </div>
      </div>

      {/* Main Authentication Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
          zIndex: 2,
          color: '#1E293B'
        }}
      >
        {/* Header Ribbon */}
        <div
          style={{
            background: 'linear-gradient(135deg, #14382A 0%, #1F5C3D 100%)',
            padding: '28px 32px 24px 32px',
            color: '#FFFFFF'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                padding: '3px 10px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}
            >
              Academic Workspace Auth
            </span>
            <img
              src="/logo.png"
              alt="LifeSync Logo"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                objectFit: 'cover',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)'
              }}
            />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 6px 0', color: '#FFFFFF' }}>
            {mode === 'signin' && 'Sign In to Your Workspace'}
            {mode === 'signup' && 'Create Your Student Account'}
            {mode === 'demo' && 'Select Demo Student Persona'}
          </h1>
          <p style={{ margin: 0, fontSize: '0.86rem', color: '#D1FAE5', lineHeight: 1.4 }}>
            {mode === 'signin' && 'Access course syllabi, deadline urgency, and automated study blocks.'}
            {mode === 'signup' && 'Join students optimizing their semester workload and exam preparation.'}
            {mode === 'demo' && 'Instantly test LifeSync with pre-populated courses, exams, and schedules.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC'
          }}
        >
          <button
            type="button"
            onClick={() => { setMode('signin'); setErrorMessage(''); }}
            style={{
              flex: 1,
              padding: '13px 16px',
              border: 'none',
              background: mode === 'signin' ? '#FFFFFF' : 'transparent',
              fontWeight: mode === 'signin' ? 700 : 500,
              color: mode === 'signin' ? '#14382A' : '#64748B',
              borderBottom: mode === 'signin' ? '2.5px solid #10B981' : '2.5px solid transparent',
              cursor: 'pointer',
              fontSize: '0.88rem',
              transition: 'all 0.15s ease'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setErrorMessage(''); }}
            style={{
              flex: 1,
              padding: '13px 16px',
              border: 'none',
              background: mode === 'signup' ? '#FFFFFF' : 'transparent',
              fontWeight: mode === 'signup' ? 700 : 500,
              color: mode === 'signup' ? '#14382A' : '#64748B',
              borderBottom: mode === 'signup' ? '2.5px solid #10B981' : '2.5px solid transparent',
              cursor: 'pointer',
              fontSize: '0.88rem',
              transition: 'all 0.15s ease'
            }}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => { setMode('demo'); setErrorMessage(''); }}
            style={{
              flex: 1,
              padding: '13px 16px',
              border: 'none',
              background: mode === 'demo' ? '#FFFFFF' : 'transparent',
              fontWeight: mode === 'demo' ? 700 : 500,
              color: mode === 'demo' ? '#14382A' : '#64748B',
              borderBottom: mode === 'demo' ? '2.5px solid #10B981' : '2.5px solid transparent',
              cursor: 'pointer',
              fontSize: '0.88rem',
              transition: 'all 0.15s ease'
            }}
          >
            ✨ 1-Click Demo
          </button>
        </div>

        {/* Tab Body */}
        <div style={{ padding: '28px 32px' }}>
          {errorMessage && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                color: '#991B1B',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '0.85rem',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* MODE: SIGN IN or CREATE ACCOUNT */}
          {mode !== 'demo' ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {mode === 'signup' && (
                <div>
                  <label
                    htmlFor="login-name"
                    style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
                  >
                    Full Name
                  </label>
                  <input
                    id="login-name"
                    type="text"
                    required
                    placeholder="e.g. Alex Morgan"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.92rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#10B981')}
                    onBlur={(e) => (e.target.style.borderColor = '#CBD5E1')}
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="login-email"
                  style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
                >
                  Student / University Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder="student@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.92rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#10B981')}
                  onBlur={(e) => (e.target.style.borderColor = '#CBD5E1')}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label
                    htmlFor="login-password"
                    style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748B',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'signin' ? 'Enter password (or leave blank for instant student demo)' : 'Create a secure password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.92rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#10B981')}
                  onBlur={(e) => (e.target.style.borderColor = '#CBD5E1')}
                />
                {mode === 'signin' && (
                  <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px' }}>
                    💡 Tip: If you are exploring LifeSync for the first time, any email will auto-provision a fresh workspace.
                  </div>
                )}
              </div>

              {mode === 'signup' && (
                <div>
                  <label
                    htmlFor="login-major"
                    style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
                  >
                    Academic Major / Department
                  </label>
                  <select
                    id="login-major"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.92rem',
                      outline: 'none',
                      backgroundColor: '#FFFFFF',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="Computer Science & AI">Computer Science & AI</option>
                    <option value="Biomedical Engineering">Biomedical Engineering</option>
                    <option value="Electrical & Electronics">Electrical & Electronics</option>
                    <option value="Mechanical Engineering">Mechanical Engineering</option>
                    <option value="Data Science & Analytics">Data Science & Analytics</option>
                    <option value="Business Administration">Business Administration</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                id="submit-auth-btn"
                disabled={isSubmitting}
                style={{
                  marginTop: '8px',
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: '#14382A',
                  color: '#FFFFFF',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(20, 56, 42, 0.25)',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1F5C3D')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#14382A')}
              >
                {isSubmitting
                  ? 'Connecting...'
                  : mode === 'signin'
                  ? 'Sign In →'
                  : 'Complete Registration →'}
              </button>
            </form>
          ) : (
            /* MODE: 1-CLICK DEMO PROFILES */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.82rem', color: '#64748B', marginBottom: '4px' }}>
                Pick an active university persona to explore pre-configured assignments, exam countdowns, and schedule optimization:
              </div>

              {availableProfiles.map((p) => (
                <div
                  key={p.uid}
                  id={`demo-persona-${p.uid}`}
                  onClick={() => handleDemoClick(p.uid)}
                  role="button"
                  tabIndex={0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: '1.5px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#10B981';
                    e.currentTarget.style.backgroundColor = '#F0FDF4';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#E2E8F0';
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <img
                      src={p.avatar}
                      alt={p.name}
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid #10B981'
                      }}
                    />
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                        {p.major}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        backgroundColor: '#ECFDF5',
                        color: '#047857',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}
                    >
                      🔥 {p.streak_days}d streak
                    </span>
                    <div style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 600, marginTop: '4px' }}>
                      Click to enter →
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              margin: '22px 0',
              color: '#94A3B8',
              fontSize: '0.78rem'
            }}
          >
            <div style={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
            <span style={{ padding: '0 12px', fontWeight: 500 }}>or sign in with</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
          </div>

          {/* Google Sign-In Button */}
          <button
            type="button"
            id="google-signin-btn"
            onClick={loginWithGoogle}
            disabled={isSubmitting || loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '11px 16px',
              borderRadius: '10px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
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
            Continue with Google
          </button>
        </div>

        {/* Footer Note */}
        <div
          style={{
            padding: '16px 32px',
            backgroundColor: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            textAlign: 'center',
            fontSize: '0.8rem',
            color: '#64748B'
          }}
        >
          {mode === 'signin' ? (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                style={{ background: 'none', border: 'none', color: '#10B981', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                Sign up now
              </button>
            </span>
          ) : mode === 'signup' ? (
            <span>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => setMode('signin')}
                style={{ background: 'none', border: 'none', color: '#10B981', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                Sign in here
              </button>
            </span>
          ) : (
            <span>
              Prefer regular login?{' '}
              <button
                type="button"
                onClick={() => setMode('signin')}
                style={{ background: 'none', border: 'none', color: '#10B981', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                Sign In with Email
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
