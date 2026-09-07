import { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import NewTaskModal from './NewTaskModal';
import UserProfileModal from './UserProfileModal';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useWorkspace, WORKSPACES } from '../context/WorkspaceContext';

export default function Sidebar({ pendingTasksCount = 3 }) {
  const toast = useToast();
  const { user, openAuthModal, logout } = useAuth();
  const { activeWorkspace, switchWorkspace } = useWorkspace();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);

  const workspaceRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (workspaceRef.current && !workspaceRef.current.contains(e.target)) {
        setIsWorkspaceMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectWorkspace = (ws) => {
    switchWorkspace(ws);
    setIsWorkspaceMenuOpen(false);
    toast.info(`Switched to ${ws.name}`);
  };

  return (
    <>
      <aside className="workspace-sidebar">
        <div>
          <div className="sidebar-header">
            <NavLink to="/home" className="sidebar-brand">
              <img
                src="/logo.png"
                alt="LifeSync Logo"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  objectFit: 'cover',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
                  flexShrink: 0
                }}
              />
              <span>LifeSync</span>
              <span className="sidebar-brand-badge">PRO</span>
            </NavLink>

            {/* Interactive Workspace Selector Dropdown */}
            <div style={{ position: 'relative' }} ref={workspaceRef}>
              <div
                className="workspace-selector"
                onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                <span>{activeWorkspace.icon} {activeWorkspace.name}</span>
                <span style={{ fontSize: '0.65rem', transition: 'transform 0.2s', transform: isWorkspaceMenuOpen ? 'rotate(180deg)' : 'none' }}>
                  ▼
                </span>
              </div>

              {isWorkspaceMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '6px',
                    background: '#12281F',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
                    zIndex: 100,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ fontSize: '0.65rem', color: '#9CA3AF', padding: '8px 12px 4px', fontWeight: 700, textTransform: 'uppercase' }}>
                    Select Workspace
                  </div>
                  {WORKSPACES.map((ws) => (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => handleSelectWorkspace(ws)}
                      style={{
                        padding: '8px 12px',
                        background: activeWorkspace.id === ws.id ? 'rgba(255,255,255,0.12)' : 'transparent',
                        color: activeWorkspace.id === ws.id ? '#FFFFFF' : '#D1D5DB',
                        border: 'none',
                        textAlign: 'left',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = activeWorkspace.id === ws.id ? 'rgba(255,255,255,0.12)' : 'transparent')}
                    >
                      <span>{ws.icon} {ws.name}</span>
                      {activeWorkspace.id === ws.id && <span style={{ color: '#10B981', fontWeight: 700 }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              className="btn-quick-task"
              onClick={() => setIsTaskModalOpen(true)}
              type="button"
            >
              <span>+</span> New Quick Task
            </button>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-category-label">Workspace</div>

            <NavLink
              to="/home"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span>🏠</span>
              <span>Home</span>
            </NavLink>

            <NavLink
              to="/dashboard"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span>📊</span>
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/calendar"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span>📅</span>
              <span>Calendar</span>
            </NavLink>

            <NavLink
              to="/tasks"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span>✅</span>
              <span>Tasks</span>
              {pendingTasksCount > 0 && (
                <span className="sidebar-link-badge">{pendingTasksCount}</span>
              )}
            </NavLink>

            <div className="nav-category-label">Data & Ingestion</div>

            <NavLink
              to="/upload"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span>📤</span>
              <span>Upload Pipeline</span>
            </NavLink>

            <NavLink
              to="/landing"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span>🌐</span>
              <span>Product Landing</span>
            </NavLink>
          </nav>
        </div>

        {/* User Profile Footer */}
        {user ? (
          <div
            className="sidebar-user"
            onClick={() => setIsProfileModalOpen(true)}
            role="button"
            tabIndex={0}
            title="Click to view full user profile & academic stats"
            style={{
              padding: '10px 10px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'background 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1 }}>
              {user.picture_url || user.avatar ? (
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img
                    src={user.picture_url || user.avatar}
                    alt={user.name || 'User'}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div className="presence-dot" />
                </div>
              ) : (
                <div className="user-avatar" style={{ flexShrink: 0 }}>
                  {user.name ? user.name.substring(0, 2).toUpperCase() : 'LS'}
                  <div className="presence-dot" />
                </div>
              )}
              <div className="user-details" style={{ overflow: 'hidden' }}>
                <div className="user-name" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {user.name || 'LifeSync Student'}
                </div>
                <div className="user-role" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '0.72rem', color: '#94A3B8' }}>
                  {user.email || user.major || 'Authenticated'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                id="sidebar-switch-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  openAuthModal();
                }}
                title="Switch persona or Google account"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  color: '#10B981',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
              >
                🔄
              </button>

              <button
                type="button"
                id="sidebar-logout-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  logout();
                }}
                title="Sign out of LifeSync"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  color: '#EF4444',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
              >
                🚪
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '8px 4px' }}>
            <button
              type="button"
              id="sidebar-login-btn"
              onClick={openAuthModal}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                background: '#10B981',
                color: '#FFFFFF',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
              }}
            >
              <span>🔐</span> Sign In / Demo
            </button>
          </div>
        )}
      </aside>

      <NewTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
      />

      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </>
  );
}
