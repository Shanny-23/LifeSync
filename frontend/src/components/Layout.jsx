import { Outlet, useLocation, Link } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  const location = useLocation();
  const isLanding = location.pathname === '/landing';

  if (isLanding) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header className="landing-navbar">
          <Link to="/landing" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1B3B2E' }}>LifeSync</span>
            <span className="pill-eyebrow forest">v1.0</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link to="/home" className="btn btn-secondary btn-sm">Sign In</Link>
            <Link to="/home" className="btn btn-primary btn-sm">Get App</Link>
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
        {/* Workspace Topbar */}
        <header className="workspace-topbar">
          <div className="topbar-status">
            <span className="status-indicator-dot" />
            <span>Authenticated • Cloud Sync Active • Wednesday, Oct 28</span>
          </div>

          <div className="topbar-actions">
            <Link to="/upload" className="btn btn-pale btn-sm">
              📤 Upload Documents
            </Link>
            <Link to="/calendar" className="btn btn-secondary btn-sm">
              ⚡ AI Schedulers
            </Link>
          </div>
        </header>

        {/* Page Content Outlet */}
        <Outlet />
      </div>
    </div>
  );
}
