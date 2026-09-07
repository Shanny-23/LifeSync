import { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import NewTaskModal from './NewTaskModal';
import UserProfileModal from './UserProfileModal';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const WORKSPACES = [
  { id: 'academic', name: 'Workspace 01 • Academic', icon: '🎓' },
  { id: 'research', name: 'Workspace 02 • Research Lab', icon: '🔬' },
  { id: 'personal', name: 'Workspace 03 • Personal & Habits', icon: '🌱' },
  { id: 'club', name: 'Workspace 04 • Clubs & Events', icon: '👥' },
];

export default function Sidebar({ pendingTasksCount = 3 }) {
  const toast = useToast();
  const { user, openAuthModal } = useAuth();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState(WORKSPACES[0]);

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
    setActiveWorkspace(ws);
    setIsWorkspaceMenuOpen(false);
    toast.info(`Switched to ${ws.name}`);
  };

  return (
    <>
      <aside className="workspace-sidebar">
        <div>
          <div className="sidebar-header">
            <NavLink to="/home" className="sidebar-brand">
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

        {/* User Profile Footer - Clickable */}
        <div
          className="sidebar-user"
          onClick={openAuthModal}
          style={{ cursor: 'pointer', transition: 'background 0.15s ease', padding: '12px 10px', borderRadius: '8px' }}
          title="Click to switch student persona or Google account"
          role="button"
          tabIndex={0}
        >
          {user?.avatar ? (
            <div style={{ position: 'relative' }}>
              <img
                src={user.avatar}
                alt={user.name}
                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div className="presence-dot" />
            </div>
          ) : (
            <div className="user-avatar">
              {user?.name ? user.name.substring(0, 2).toUpperCase() : 'AM'}
              <div className="presence-dot" />
            </div>
          )}
          <div className="user-details">
            <div className="user-name">{user?.name || "Alex Morgan"}</div>
            <div className="user-role">{user?.major || "CS & AI"} ⚙️</div>
          </div>
        </div>
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
