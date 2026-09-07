import { createContext, useContext, useState, useEffect } from 'react';

const WorkspaceContext = createContext(null);

export const WORKSPACES = [
  { id: 'academic', name: 'Workspace 01 • Academic', icon: '🎓', description: 'Coursework, assignments, study sessions & exams' },
  { id: 'club', name: 'Workspace 02 • Clubs & Events', icon: '👥', description: 'Extracurriculars, club events & campus festivals' },
  { id: 'all', name: 'Unified • All Spaces', icon: '🌐', description: 'All academic & campus commitments combined' },
];

export function WorkspaceProvider({ children }) {
  const [activeWorkspace, setActiveWorkspace] = useState(() => {
    try {
      const savedId = localStorage.getItem('lifesync_workspace_id');
      const found = WORKSPACES.find((w) => w.id === savedId);
      return found || WORKSPACES[0];
    } catch {
      return WORKSPACES[0];
    }
  });

  const switchWorkspace = (wsOrId) => {
    const ws = typeof wsOrId === 'string' ? WORKSPACES.find((w) => w.id === wsOrId) || WORKSPACES[0] : wsOrId;
    setActiveWorkspace(ws);
    try {
      localStorage.setItem('lifesync_workspace_id', ws.id);
    } catch {
      // LocalStorage fallback
    }
    window.dispatchEvent(new CustomEvent('lifesync:workspace-changed', { detail: ws }));
  };

  /**
   * Evaluates if a task, slot, or event belongs to the current active workspace.
   */
  const filterByWorkspace = (items = []) => {
    if (!Array.isArray(items)) return [];
    if (activeWorkspace.id === 'all') return items;

    return items.filter((item) => {
      const subject = (item.subject || item.category || '').toLowerCase();
      const type = (item.type || item.entityType || item.slot_type || '').toLowerCase();
      const title = (item.title || item.task || '').toLowerCase();

      const isExtracurricular =
        type.includes('fest') ||
        type.includes('club') ||
        type.includes('holiday') ||
        subject.includes('club') ||
        subject.includes('event') ||
        title.includes('robotics') ||
        title.includes('hackathon') ||
        title.includes('fest') ||
        title.includes('meeting') ||
        title.includes('sync');

      if (activeWorkspace.id === 'club') {
        return isExtracurricular;
      }

      if (activeWorkspace.id === 'academic') {
        // Academic matches coursework, assignments, study slots, exam preps unless strictly a club/fest
        return !isExtracurricular;
      }

      return true;
    });
  };

  return (
    <WorkspaceContext.Provider
      value={{
        activeWorkspace,
        workspaces: WORKSPACES,
        switchWorkspace,
        filterByWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return ctx;
}
