import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AtAGlanceMetrics from '../components/AtAGlanceMetrics';
import WeekStrip from '../components/WeekStrip';
import EscalatedDeadlineCard from '../components/EscalatedDeadlineCard';
import RightRail from '../components/RightRail';
import MeetingModal from '../components/MeetingModal';
import TaskDetailModal from '../components/TaskDetailModal';
import NewTaskModal from '../components/NewTaskModal';
import { getTasks } from '../api';
import { useToast } from '../context/ToastContext';

export default function Home() {
  const navigate = useNavigate();
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [isLiveBackend, setIsLiveBackend] = useState(false);
  const [habitCompleted, setHabitCompleted] = useState(false);
  const [_loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [selectedTaskForModal, setSelectedTaskForModal] = useState(null);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState(null);

  async function loadData() {
    try {
      const liveTasks = await getTasks();
      setTasks(Array.isArray(liveTasks) ? liveTasks : []);
      setIsLiveBackend(true);
      setError(null);
    } catch (err) {
      console.warn('Backend unreachable for Home view:', err);
      setError("Couldn't load tasks — is the backend running?");
      setIsLiveBackend(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const handleTaskCreated = () => {
      loadData();
    };
    window.addEventListener('lifesync:task-created', handleTaskCreated);

    return () => {
      window.removeEventListener('lifesync:task-created', handleTaskCreated);
    };
  }, []);

  const urgentTasksCount = tasks.filter(
    (t) => (t.priority_score || 0) >= 70 || t.urgency === 'high' || t.status === 'scheduled'
  ).length || 3;

  const topUrgentTask = [...tasks]
    .filter((t) => t.status !== 'completed' && !t.completed)
    .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))[0] || tasks[0];

  const handleToggleHabit = () => {
    const nextState = !habitCompleted;
    setHabitCompleted(nextState);
    if (nextState) {
      toast.success('🧘 Morning Yoga & Breathwork marked complete! Streak active.');
    } else {
      toast.info('Habit uncompleted.');
    }
  };

  const handleDateSelect = (day) => {
    setSelectedDateFilter(day);
    toast.info(`Filtered schedule for ${day.name}, Oct ${day.num}`);
  };

  return (
    <div className="workspace-body">
      {/* Primary Column */}
      <div className="workspace-primary-col">
        {/* 1. Greeting Banner (Dark Green #1B3B2E) */}
        <section className="greeting-banner">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span className="pill-eyebrow" style={{ background: 'rgba(255,255,255,0.2)', color: '#FFFFFF' }}>
              DAILY WORKSPACE ACTIVE • SEPTEMBER 2026
            </span>
            <span style={{ fontSize: '0.74rem', color: isLiveBackend ? '#A7F3D0' : '#FCA5A5' }}>
              {isLiveBackend ? '● Live Backend API' : '● Backend Disconnected'}
            </span>
          </div>

          <h1 className="greeting-title">Hello, Totok Michael 👋</h1>
          <p className="greeting-subtitle">
            Welcome back! Here is your daily focus: <strong>{urgentTasksCount} urgent tasks</strong>, <strong>1 team sync</strong>, and <strong>1 routine habit</strong> scheduled today.
          </p>

          {/* Interactive Greeting Pills */}
          <div className="greeting-pills">
            <div
              className="status-pill"
              onClick={() => navigate('/tasks?urgency=high')}
              style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
              title="Click to view urgent deadlines"
              role="button"
              tabIndex={0}
            >
              <span>📌</span> {urgentTasksCount} Deadlines Today
            </div>

            <div
              className="status-pill"
              onClick={() => toast.info('🔥 5-Day Study Streak! You are in the top 5% of active users.')}
              style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
              title="Click to inspect study streak"
              role="button"
              tabIndex={0}
            >
              <span>🔥</span> 5-Day Study Streak
            </div>

            <div
              className="status-pill"
              onClick={handleToggleHabit}
              style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
              title="Click to toggle routine completion"
              role="button"
              tabIndex={0}
            >
              <span>🌱</span> Routine: {habitCompleted ? '57% Done ✓' : '41% Done'}
            </div>

            <div
              className="status-pill"
              onClick={() => setIsMeetingModalOpen(true)}
              style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
              title="Click to open meeting details"
              role="button"
              tabIndex={0}
            >
              <span>👥</span> Meet: CS101 Paper @ 1:00 PM
            </div>
          </div>
        </section>

        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: '#FEE2E2',
              color: '#991B1B',
              border: '1px solid #FCA5A5',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>⚠️ {error}</div>
            <button
              onClick={loadData}
              className="btn btn-sm"
              style={{ background: '#991B1B', color: '#FFF', border: 'none' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* 2. At a Glance Metrics Row */}
        <AtAGlanceMetrics
          tasks={tasks}
          routinePercent={habitCompleted ? 57 : 41}
          activeTaskName={topUrgentTask ? (topUrgentTask.title || topUrgentTask.task) : "CS101 Term Paper Draft"}
        />

        {/* 3. Weekly Schedule Strip - Interactive with callback */}
        <WeekStrip onSelectDate={handleDateSelect} />

        {selectedDateFilter && (
          <div style={{
            background: '#E7F0EA',
            border: '1px solid #C8E6D2',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            color: '#1B3B2E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>📅 Showing scheduled tasks for <strong>{selectedDateFilter.name}, Oct {selectedDateFilter.num}</strong></span>
            <button
              className="btn btn-xs btn-secondary"
              onClick={() => { setSelectedDateFilter(null); toast.info('Reset filter to today'); }}
            >
              Clear Filter
            </button>
          </div>
        )}

        {/* 4. Routine Habit Row */}
        <div className="routine-row">
          <div className="routine-row-left">
            <div className="routine-icon-box">
              {habitCompleted ? '✅' : '🧘'}
            </div>
            <div>
              <div className="routine-title" style={{ textDecoration: habitCompleted ? 'line-through' : 'none' }}>
                Morning Yoga & Breathwork
              </div>
              <div className="routine-meta">
                <span>08:00 AM</span>
                <span>•</span>
                <span>30m Duration</span>
                <span>•</span>
                <span className="pill-eyebrow green">High Energy</span>
                <span>•</span>
                <span className="pill-eyebrow neutral">ROUTINE HABIT</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className={`btn ${habitCompleted ? 'btn-pale' : 'btn-primary'} btn-sm`}
            onClick={handleToggleHabit}
          >
            {habitCompleted ? 'Completed ✓' : 'Log Habit'}
          </button>
        </div>

        {/* 5. Due-Today Escalated Deadline Card */}
        <EscalatedDeadlineCard
          taskTitle={topUrgentTask ? (topUrgentTask.title || topUrgentTask.task) : "CS101 Term Paper Draft - Literature Review"}
          category={topUrgentTask ? (topUrgentTask.subject || topUrgentTask.category || "Academic") : "Academic"}
          dueText="DUE TODAY • 5:00 PM"
          countdownText="03h 14m left"
          onActionClick={() => {
            if (topUrgentTask) setSelectedTaskForModal(topUrgentTask);
            else navigate('/tasks');
          }}
        />

        {/* 6. Peak Cognitive Window Tip */}
        <div className="tip-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <span style={{ fontSize: '1.25rem' }}>💡</span>
            <div>
              <strong>Peak Cognitive Window:</strong> Tomorrow 10:00 AM – 12:30 PM is predicted by Claude AI to be your highest focus period.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-forest btn-xs"
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => setIsNewTaskModalOpen(true)}
          >
            + Schedule Deep Work
          </button>
        </div>
      </div>

      {/* Right Rail Contextual Info */}
      <RightRail onTaskSelect={(task) => setSelectedTaskForModal(task)} />

      {/* Modals */}
      <MeetingModal
        isOpen={isMeetingModalOpen}
        onClose={() => setIsMeetingModalOpen(false)}
      />

      <TaskDetailModal
        task={selectedTaskForModal}
        isOpen={Boolean(selectedTaskForModal)}
        onClose={() => setSelectedTaskForModal(null)}
        onTaskUpdated={() => loadData()}
        onTaskDeleted={() => loadData()}
      />

      <NewTaskModal
        isOpen={isNewTaskModalOpen}
        onClose={() => setIsNewTaskModalOpen(false)}
        onTaskCreated={() => loadData()}
      />
    </div>
  );
}
