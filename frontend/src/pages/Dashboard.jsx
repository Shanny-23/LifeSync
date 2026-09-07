import { useState, useEffect, useCallback } from 'react';
import AtAGlanceMetrics from '../components/AtAGlanceMetrics';
import WeekStrip from '../components/WeekStrip';
import EscalatedDeadlineCard from '../components/EscalatedDeadlineCard';
import RightRail from '../components/RightRail';
import NewTaskModal from '../components/NewTaskModal';
import TaskDetailModal from '../components/TaskDetailModal';
import FocusTimerWidget from '../components/FocusTimerWidget';
import SyllabusMasteryCard from '../components/SyllabusMasteryCard';
import ReadinessGauge from '../components/ReadinessGauge';
import WeeklyStudyChart from '../components/WeeklyStudyChart';
import { getTasks, recalculatePriorities } from '../api';
import { useToast } from '../context/ToastContext';

export default function Dashboard() {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcFeedback, setRecalcFeedback] = useState(null);

  // Modals
  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Daily focus queue
  const [focusQueue, setFocusQueue] = useState([
    { id: 1, title: 'Literature Review & Citations', category: 'CS101', est: '45m', status: 'next' },
    { id: 2, title: 'Review Team Feedback', category: 'Design Sync', est: '30m', status: 'standby' },
    { id: 3, title: 'Export Analytics Summary', category: 'Math 204', est: '15m', status: 'queued' },
  ]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const liveTasks = await getTasks();
      setTasks(Array.isArray(liveTasks) ? liveTasks : []);
    } catch (err) {
      console.warn('Failed to load tasks for Dashboard:', err);
      setError("Couldn't load tasks — is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    const handleTaskCreated = () => {
      loadTasks();
    };
    window.addEventListener('lifesync:task-created', handleTaskCreated);
    return () => window.removeEventListener('lifesync:task-created', handleTaskCreated);
  }, [loadTasks]);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    setRecalcFeedback(null);
    try {
      const res = await recalculatePriorities();
      const count = res?.tasks_updated ?? res?.updated_count ?? 0;
      toast.success(`Priorities recalculated! ${count} task(s) updated.`);
      setRecalcFeedback({
        type: 'success',
        text: `Priorities recalculated! ${count} task(s) updated.`,
      });
      await loadTasks();
    } catch (err) {
      toast.error(`Recalculation error: ${err.message}`);
      setRecalcFeedback({
        type: 'error',
        text: `Recalculation error: ${err.message}`,
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleAddFocusTask = () => {
    setIsFocusModalOpen(true);
  };

  const handleFocusTaskCreated = (newTask) => {
    setFocusQueue((prev) => [
      ...prev,
      {
        id: newTask.id || Date.now(),
        title: newTask.title,
        category: newTask.subject || newTask.category || 'General',
        est: '30m',
        status: 'queued',
      },
    ]);
    toast.success(`Added "${newTask.title}" to Daily Focus Queue`);
    loadTasks();
  };

  const handleCycleFocusStatus = (item) => {
    const nextStatus = item.status === 'next' ? 'standby' : item.status === 'standby' ? 'queued' : 'next';
    setFocusQueue((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, status: nextStatus } : it))
    );
    toast.info(`Status for "${item.title}" updated to: ${nextStatus.toUpperCase()}`);
  };

  // Metrics computation
  const totalCount = tasks.length;
  const highCount = tasks.filter((t) => t.urgency === 'high' || (t.priority_score || 0) >= 75).length;
  const mediumCount = tasks.filter((t) => t.urgency === 'medium' || ((t.priority_score || 0) >= 40 && (t.priority_score || 0) < 75)).length;
  const lowCount = tasks.filter((t) => t.urgency === 'low' || (t.priority_score !== undefined && t.priority_score < 40)).length;

  // Urgent priorities list (top priority tasks)
  const urgentPriorities = [...tasks]
    .filter((t) => !t.completed && t.status !== 'completed')
    .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
    .slice(0, 4);

  // Highest priority task for escalated banner
  const highestPriorityTask = urgentPriorities[0] || tasks[0];

  return (
    <div className="workspace-body">
      {/* Primary Column */}
      <div className="workspace-primary-col">
        {/* Top bar info */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Workspace Dashboard</h1>
            <p style={{ fontSize: '0.84rem', color: '#6B7280' }}>
              High-density view of schedules, focus queues, and collaborative team activity.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleRecalculate}
              disabled={isRecalculating || loading}
            >
              {isRecalculating ? 'Calculating...' : '🔄 Recalculate Priorities'}
            </button>
            <span className={`pill-eyebrow ${error ? 'coral' : 'green'}`}>
              {error ? '● Offline' : '● Live Backend'}
            </span>
          </div>
        </div>

        {/* Error notification banner if backend unreachable */}
        {error && (
          <div
            style={{
              padding: '14px 18px',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
            <button
              onClick={loadTasks}
              className="btn btn-sm"
              style={{ background: '#991B1B', color: '#FFFFFF', border: 'none' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Recalculate feedback */}
        {recalcFeedback && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 600,
              background: recalcFeedback.type === 'success' ? '#ECFDF5' : '#FEF2F2',
              color: recalcFeedback.type === 'success' ? '#065F46' : '#991B1B',
              border: `1px solid ${recalcFeedback.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
            }}
          >
            {recalcFeedback.text}
          </div>
        )}

        {/* Metric Cards Row: Total, High, Medium, Low */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <div className="metric-card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>Total Tasks</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1B3B2E', marginTop: '4px' }}>
              {loading ? '—' : totalCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>All active commitments</div>
          </div>

          <div className="metric-card" style={{ padding: '14px 16px', borderLeft: '4px solid #B23A3A' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#B23A3A', textTransform: 'uppercase' }}>High Urgency</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#B23A3A', marginTop: '4px' }}>
              {loading ? '—' : highCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>Score ≥ 75 or critical</div>
          </div>

          <div className="metric-card" style={{ padding: '14px 16px', borderLeft: '4px solid #D9A441' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#B45309', textTransform: 'uppercase' }}>Medium Urgency</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#D9A441', marginTop: '4px' }}>
              {loading ? '—' : mediumCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>Score 40–74</div>
          </div>

          <div className="metric-card" style={{ padding: '14px 16px', borderLeft: '4px solid #1F5C3D' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#1F5C3D', textTransform: 'uppercase' }}>Low Urgency</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1F5C3D', marginTop: '4px' }}>
              {loading ? '—' : lowCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>Score &lt; 40</div>
          </div>
        </div>

        {/* 1. At a Glance Metrics Row */}
        <AtAGlanceMetrics tasks={tasks} />

        {/* 1.5 Figma Academic Readiness & Weekly Study Breakdown Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', margin: '8px 0' }}>
          <ReadinessGauge score={73} />
          <WeeklyStudyChart />
        </div>

        {/* 2. Urgent Priorities List */}
        <div className="collab-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span className="rail-widget-title" style={{ margin: 0 }}>Urgent Priorities</span>
            <span className="pill-eyebrow coral">{highCount} Critical</span>
          </div>

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#6B7280', fontSize: '0.88rem' }}>
              ⏳ Loading tasks from backend...
            </div>
          ) : urgentPriorities.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280', fontSize: '0.84rem' }}>
              No urgent priority tasks at the moment. All caught up!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {urgentPriorities.map((task) => (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    background: (task.urgency === 'high' || (task.priority_score || 0) >= 75) ? '#FFF5F3' : '#FFFFFF',
                    borderLeft: `4px solid ${(task.urgency === 'high' || (task.priority_score || 0) >= 75) ? '#B23A3A' : '#D9A441'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title="Click to view full task details"
                >
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0F172A' }}>
                      {task.task || task.title}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '2px' }}>
                      {task.category || task.subject || 'General'} • {task.scheduledSlot ? `Slot: ${task.scheduledSlot}` : task.deadline ? `Deadline: ${task.deadline.replace('T', ' ').slice(0, 16)}` : 'Unscheduled'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`pill-eyebrow ${task.urgency === 'high' ? 'coral' : 'amber'}`}>
                      Score: {task.priority_score ?? '—'}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#1B3B2E', fontWeight: 600 }}>Inspect ›</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Week Strip */}
        <WeekStrip />

        {/* 4. Upcoming Timeline / Today's Schedule & Routine */}
        <div className="collab-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span className="rail-widget-title" style={{ margin: 0 }}>Upcoming Timeline & Routine</span>
            <span className="pill-eyebrow green">Today's Focus</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#F0FDF4', borderRadius: '8px', borderLeft: '4px solid #16A34A' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>🧘</span>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>Morning Yoga Session & Reset</div>
                  <div style={{ fontSize: '0.72rem', color: '#166534' }}>08:00 AM • Routine Habit</div>
                </div>
              </div>
              <span className="pill-eyebrow green">Done ✓</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#EFF6FF', borderRadius: '8px', borderLeft: '4px solid #2563EB' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>🎯</span>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>Study Session • CS101 Algorithm Analysis</div>
                  <div style={{ fontSize: '0.72rem', color: '#1E40AF' }}>1:00 PM - 1:45 PM • Spaced Repetition Block</div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  if (highestPriorityTask) setSelectedTask(highestPriorityTask);
                  else toast.info('Starting study session: CS101 Algorithm Analysis');
                }}
              >
                Inspect Block →
              </button>
            </div>
          </div>
        </div>

        {/* 5. Focus & Study Timer Mode (Replaces Team Collaboration) */}
        <FocusTimerWidget
          activeTask={highestPriorityTask}
          onSessionComplete={(mode) => toast.success(`Great job completing your ${mode} session!`)}
        />

        {/* 6. Course Syllabus & Exam Mastery Tracker */}
        <SyllabusMasteryCard
          onPlanExamStudy={(course) => toast.success(`Generated 3-stage spaced repetition review for ${course.code}!`)}
        />

        {/* 6. Escalated Deadline Card */}
        <EscalatedDeadlineCard
          taskTitle={highestPriorityTask ? (highestPriorityTask.task || highestPriorityTask.title) : 'Assignment Due: CS101 Paper'}
          category={highestPriorityTask ? (highestPriorityTask.category || highestPriorityTask.subject || 'Academic') : 'Academic'}
          dueText={highestPriorityTask ? `Priority ${highestPriorityTask.priority_score}/100` : 'OVERDUE WARNING'}
          countdownText="Active"
          onActionClick={() => {
            if (highestPriorityTask) setSelectedTask(highestPriorityTask);
          }}
        />

        {/* 7. Daily Focus Queue */}
        <div className="focus-queue-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span className="rail-widget-title" style={{ margin: 0 }}>Daily Focus Queue</span>
              <div style={{ fontSize: '0.74rem', color: '#6B7280', marginTop: '2px' }}>
                Total Focus Time: 1h 30m • Click badge to cycle status
              </div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddFocusTask}>
              + Add Focus Task
            </button>
          </div>

          <div className="queue-items-list">
            {focusQueue.map((item) => (
              <div
                key={item.id}
                className="queue-item"
                onClick={() => handleCycleFocusStatus(item)}
                style={{ cursor: 'pointer', transition: 'background 0.15s ease' }}
                title="Click to change status"
              >
                <div className="queue-item-left">
                  <span className={`queue-badge ${item.status}`}>
                    {item.status === 'next' ? 'Next Up' : item.status === 'standby' ? 'Standby' : 'Queued'}
                  </span>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>{item.title}</div>
                    <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>{item.category}</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
                  {item.est}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Rail */}
      <RightRail onTaskSelect={(t) => setSelectedTask(t)} />

      {/* Focus Task Modal */}
      <NewTaskModal
        isOpen={isFocusModalOpen}
        onClose={() => setIsFocusModalOpen(false)}
        onTaskCreated={handleFocusTaskCreated}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={() => loadTasks()}
        onTaskDeleted={() => loadTasks()}
      />
    </div>
  );
}
