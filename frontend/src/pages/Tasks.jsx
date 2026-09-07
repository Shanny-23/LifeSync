import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getTasks, updateTask } from '../api';
import RightRail from '../components/RightRail';
import TaskDetailModal from '../components/TaskDetailModal';
import NewTaskModal from '../components/NewTaskModal';
import { useToast } from '../context/ToastContext';
import gsap, { Flip, prefersReducedMotion } from '../lib/gsap';

export default function Tasks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const taskCardsRef = useRef(null);

  const initialUrgency = searchParams.get('urgency') || 'all';
  const [tasks, setTasks] = useState([]);
  const [urgencyFilter, setUrgencyFilter] = useState(initialUrgency);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [knownCategories, setKnownCategories] = useState(['all', 'Academic', 'Research', 'Personal', 'Work']);

  // Modals
  const [selectedTask, setSelectedTask] = useState(null);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);

  // Ref to cancel stale requests
  const requestCount = useRef(0);

  // Sync with searchParams if url changes
  useEffect(() => {
    const urlUrgency = searchParams.get('urgency');
    if (urlUrgency && urlUrgency !== urgencyFilter) {
      setUrgencyFilter(urlUrgency);
    }
  }, [searchParams]);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch tasks with server-side query parameters
  const fetchFilteredTasks = useCallback(async () => {
    const currentRequestId = ++requestCount.current;
    setLoading(true);
    setError(null);

    try {
      const params = {};
      if (urgencyFilter && urgencyFilter !== 'all') params.urgency = urgencyFilter;
      if (categoryFilter && categoryFilter !== 'all') params.category = categoryFilter;
      if (debouncedSearch && debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const data = await getTasks(params);

      if (currentRequestId === requestCount.current) {
        const taskList = Array.isArray(data) ? data : [];
        setTasks(taskList);

        // Dynamically discover and preserve categories
        setKnownCategories((prev) => {
          const newCats = taskList.map((t) => t.category || t.subject || 'General');
          const combined = new Set([...prev, ...newCats]);
          return Array.from(combined);
        });
      }
    } catch (err) {
      if (currentRequestId === requestCount.current) {
        console.warn('Failed to fetch tasks:', err);
        setError("Couldn't load tasks — is the backend running?");
      }
    } finally {
      if (currentRequestId === requestCount.current) {
        setLoading(false);
      }
    }
  }, [urgencyFilter, categoryFilter, debouncedSearch]);

  useEffect(() => {
    fetchFilteredTasks();
    const handleTaskCreated = () => {
      fetchFilteredTasks();
    };
    window.addEventListener('lifesync:task-created', handleTaskCreated);
    return () => window.removeEventListener('lifesync:task-created', handleTaskCreated);
  }, [fetchFilteredTasks]);

  // Animate incoming cards smoothly when filter, category, or search changes
  useEffect(() => {
    if (loading || prefersReducedMotion() || !taskCardsRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.metric-card',
        { opacity: 0, y: 12 },
        {
          opacity: 1,
          y: 0,
          duration: 0.28,
          stagger: 0.04,
          ease: 'power2.out',
        }
      );
    }, taskCardsRef);
    return () => ctx.revert();
  }, [tasks.length, urgencyFilter, categoryFilter, debouncedSearch]);

  const handleUrgencyChange = (urg) => {
    setUrgencyFilter(urg);
    if (urg === 'all') {
      searchParams.delete('urgency');
    } else {
      searchParams.set('urgency', urg);
    }
    setSearchParams(searchParams);
  };

  const handleToggleComplete = async (task, e) => {
    e.stopPropagation(); // Don't open modal when clicking checkbox
    const newCompleted = !(task.status === 'completed' || task.completed);

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, status: newCompleted ? 'completed' : 'pending', completed: newCompleted } : t
      )
    );

    try {
      await updateTask(task.id, { completed: newCompleted });
      toast.success(
        newCompleted ? `"${task.title || task.task}" completed! ✓` : `"${task.title || task.task}" restored to pending.`
      );
    } catch (err) {
      toast.error(`Failed to update task: ${err.message}`);
      fetchFilteredTasks(); // Revert on failure
    }
  };

  return (
    <div className="workspace-body">
      <div className="workspace-primary-col">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Tasks & Commitments</h1>
            <p style={{ fontSize: '0.84rem', color: '#6B7280' }}>
              Priority-scored academic tasks, study topics, and exam preparations. Click any task to inspect details.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsNewTaskModalOpen(true)}
            >
              <span>+</span> New Task
            </button>
            <span className={`pill-eyebrow ${error ? 'coral' : 'green'}`}>
              {error ? '● Backend Offline' : '● Live Backend API'}
            </span>
          </div>
        </div>

        {/* Error message banner if backend unreachable */}
        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: '#FEE2E2',
              color: '#991B1B',
              border: '1px solid #FCA5A5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.86rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
            <button
              onClick={fetchFilteredTasks}
              className="btn btn-sm"
              style={{ background: '#991B1B', color: '#FFFFFF', border: 'none' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Filter Card */}
        <div className="rail-widget" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                placeholder="Search tasks, subject codes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.86rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Category dropdown */}
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.86rem',
                  backgroundColor: '#FFFFFF',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {knownCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Urgency filters */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {['all', 'high', 'medium', 'low'].map((urg) => (
                <button
                  key={urg}
                  type="button"
                  className={`btn btn-sm ${urgencyFilter === urg ? 'btn-forest' : 'btn-secondary'}`}
                  onClick={() => handleUrgencyChange(urg)}
                >
                  {urg.charAt(0).toUpperCase() + urg.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tasks List */}
        <div ref={taskCardsRef} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#6B7280', fontSize: '0.9rem' }}>
              ⏳ Loading tasks from backend...
            </div>
          ) : tasks.length === 0 ? (
            <div
              className="metric-card"
              style={{ padding: '36px', textAlign: 'center', color: '#6B7280' }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📋</div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                No tasks found
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#64748B' }}>
                {searchQuery || urgencyFilter !== 'all' || categoryFilter !== 'all'
                  ? 'Try adjusting your search query or filter criteria.'
                  : 'No tasks currently stored in the database. Click "+ New Task" to create one!'}
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ marginTop: '12px' }}
                onClick={() => setIsNewTaskModalOpen(true)}
              >
                + Create First Task
              </button>
            </div>
          ) : (
            tasks.map((task) => {
              const isDone = task.status === 'completed' || task.completed;
              const isHigh = task.urgency === 'high' || (task.priority_score || 0) >= 75;
              const isMedium = task.urgency === 'medium';

              return (
                <div
                  key={task.id}
                  className="metric-card"
                  onClick={() => setSelectedTask(task)}
                  style={{
                    background: isDone ? '#F8FAFC' : isHigh ? '#FFF5F3' : '#FFFFFF',
                    borderColor: isDone ? '#E2E8F0' : isHigh ? '#F87171' : '#E2E8F0',
                    padding: '16px 20px',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    opacity: isDone ? 0.75 : 1,
                  }}
                  title="Click to view details or edit"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className={`pill-eyebrow ${isHigh ? 'coral' : isMedium ? 'amber' : 'neutral'}`}>
                        {task.urgency ? task.urgency.toUpperCase() : 'NORMAL'}
                      </span>
                      <span className="pill-eyebrow forest">
                        {task.category || task.subject || 'General'}
                      </span>
                      {task.status === 'needs_manual_review' && (
                        <span
                          className="pill-eyebrow"
                          style={{ background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', fontSize: '0.65rem' }}
                        >
                          ⚠️ Needs Manual Review
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.78rem', color: '#6B7280' }}>Priority Score:</span>
                      <strong style={{ fontSize: '1rem', color: isHigh ? '#B23A3A' : '#1F5C3D' }}>
                        {task.priority_score !== undefined ? `${task.priority_score}/100` : '—'}
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                    {/* Checkbox for instant toggle */}
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={(e) => handleToggleComplete(task, e)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        accentColor: '#1B3B2E'
                      }}
                      title="Toggle task completion"
                    />

                    <div style={{
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      color: '#0F172A',
                      textDecoration: isDone ? 'line-through' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                      flex: 1
                    }}>
                      <span>{task.task || task.title}</span>
                      {task.googleEventId && (
                        <span className="pill-eyebrow" style={{ background: '#E0F2FE', color: '#0369A1', fontSize: '0.65rem', border: '1px solid #BAE6FD' }}>
                          📅 Synced with Google
                        </span>
                      )}
                    </div>
                  </div>

                  {task.description && (
                    <p style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '8px', paddingLeft: '30px' }}>
                      {task.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #F1F5F9', paddingLeft: '30px' }}>
                    <div style={{ fontSize: '0.76rem', color: '#6B7280' }}>
                      📅 {task.scheduledSlot ? `Scheduled: ${task.scheduledSlot}` : task.deadline ? `Deadline: ${task.deadline.replace('T', ' ').slice(0, 16)}` : 'Flexible timing'}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`pill-eyebrow ${isDone ? 'green' : 'neutral'}`}>
                        {isDone ? '✓ Completed' : 'Pending'}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: '#1B3B2E', fontWeight: 600 }}>
                        Details ›
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <RightRail onTaskSelect={(t) => setSelectedTask(t)} />

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={() => fetchFilteredTasks()}
        onTaskDeleted={() => fetchFilteredTasks()}
      />

      {/* New Task Modal */}
      <NewTaskModal
        isOpen={isNewTaskModalOpen}
        onClose={() => setIsNewTaskModalOpen(false)}
        onTaskCreated={() => fetchFilteredTasks()}
      />
    </div>
  );
}
