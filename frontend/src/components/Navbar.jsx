import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../api';

export default function Navbar() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    let mounted = true;
    api
      .getTasks()
      .then((data) => {
        if (mounted && Array.isArray(data)) {
          setTasks(data);
        }
      })
      .catch(() => {
        // Backend offline or error
      });
    return () => {
      mounted = false;
    };
  }, []);

  const highUrgencyCount = tasks.filter((t) => t.urgency === 'high').length;

  return (
    <header className="navbar">
      <div className="nav-container">
        <NavLink to="/dashboard" className="nav-brand">
          LifeSync
        </NavLink>

        <nav className="nav-links">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/tasks"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Tasks ({tasks.length})
          </NavLink>
          <NavLink
            to="/calendar"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Calendar
          </NavLink>
          <NavLink
            to="/upload"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Upload
          </NavLink>
        </nav>

        <div className="nav-actions">
          {highUrgencyCount > 0 && (
            <span
              style={{
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 'bold',
                fontSize: '0.85rem',
              }}
            >
              High Urgency: {highUrgencyCount}
            </span>
          )}
          <NavLink
            to="/upload"
            style={{
              backgroundColor: '#2563eb',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: '4px',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 'bold',
            }}
          >
            Sync Schedule
          </NavLink>
        </div>
      </div>
    </header>
  );
}
