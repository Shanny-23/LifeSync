import { Outlet, useLocation, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const location = useLocation();
  const toast = useToast();
  const { user, loginWithGoogle, openAuthModal } = useAuth();
  const isLanding = location.pathname === '/landing';

  if (isLanding) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header className="landing-navbar">
          <Link to="/landing" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src="/logo.png"
              alt="LifeSync Logo"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                objectFit: 'cover',
                boxShadow: '0 2px 8px rgba(20, 56, 42, 0.15)'
              }}
            />
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#14382A' }}>LifeSync</span>
            <span className="pill-eyebrow forest">v1.0</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {user ? (
              <Link to="/dashboard" className="btn btn-primary btn-sm" style={{ background: '#14382A' }}>
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="btn btn-secondary btn-sm"
                  style={{ textDecoration: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                >
                  Sign In
                </Link>
                <Link
                  to="/login"
                  className="btn btn-primary btn-sm"
                  style={{ background: '#14382A', textDecoration: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                >
                  Get Started →
                </Link>
              </>
            )}
          </div>
        </header>

        <main style={{ flex: 1 }}>
          <Outlet />
        </main>

        <footer style={{ background: '#0F172A', color: '#94A3B8', padding: '32px 48px', textAlign: 'center', fontSize: '0.85rem' }}>
          <p>© {new Date().getFullYear()} LifeSync Inc. Everything in sync, nothing out of time.</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="workspace-shell">
      {/* Persistent Left Sidebar */}
      <Sidebar pendingTasksCount={3} />

      {/* Main Content Area */}
      <div className="workspace-main">
        {/* Workspace Topbar with Figma View Switcher */}
        <header className="workspace-topbar">
          <div className="topbar-status" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="status-indicator-dot" />
            <span>Authenticated • Cloud Sync Active • Wednesday, Oct 28</span>

            {/* Dynamic student identity badge */}
            <div
              onClick={openAuthModal}
              role="button"
              tabIndex={0}
              title="Click to switch account or Google profile"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 10px',
                borderRadius: '20px',
                background: '#E7F0EA',
                color: '#14382A',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              <span>👤</span> {user?.name || 'LifeSync Student'}
            </div>
          </div>

          <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link to="/upload" className="btn btn-pale btn-sm">
              📤 Upload Documents
            </Link>
            <Link to="/calendar" className="btn btn-secondary btn-sm">
              ⚡ AI Schedulers
            </Link>
          </div>
        </header>

        {/* Standard Page Workspace Content */}
        <Outlet />
      </div>
    </div>
  );
}
