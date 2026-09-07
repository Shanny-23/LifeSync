import { useState, useEffect } from 'react';
import { updateTask, deleteTask } from '../api';
import { useToast } from '../context/ToastContext';

export default function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}) {
  const toast = useToast();
  const [isCompleted, setIsCompleted] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (task) {
      setIsCompleted(task.status === 'completed' || task.completed === true);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const isHigh = task.urgency === 'high' || (task.priority_score || 0) >= 75;
  const isMedium = task.urgency === 'medium';

  const handleToggleComplete = async () => {
    setIsUpdating(true);
    const newStatus = !isCompleted;
    try {
      const updated = await updateTask(task.id, { completed: newStatus });
      setIsCompleted(newStatus);
      toast.success(
        newStatus ? 'Task marked completed! ✓' : 'Task restored to pending.'
      );
      if (onTaskUpdated) onTaskUpdated(updated);
      window.dispatchEvent(
        new CustomEvent('lifesync:task-created', { detail: updated })
      );
    } catch (err) {
      toast.error(`Failed to update task: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${task.title || task.task}"?`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteTask(task.id);
      toast.info('Task deleted.');
      if (onTaskDeleted) onTaskDeleted(task.id);
      window.dispatchEvent(
        new CustomEvent('lifesync:task-created', { detail: { id: task.id, deleted: true } })
      );
      onClose();
    } catch (err) {
      toast.error(`Failed to delete task: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-card" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`pill-eyebrow ${isHigh ? 'coral' : isMedium ? 'amber' : 'green'}`}>
              {task.urgency ? task.urgency.toUpperCase() : 'NORMAL'}
            </span>
            <span className="pill-eyebrow forest">
              {task.category || task.subject || 'Academic'}
            </span>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: '#0F172A',
              textDecoration: isCompleted ? 'line-through' : 'none',
              opacity: isCompleted ? 0.65 : 1
            }}>
              {task.task || task.title}
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '4px' }}>
              Subject Code: <strong>{task.subject || task.category || 'General'}</strong>
              {task.weightage && ` • Syllabus Weightage: ${task.weightage}`}
            </div>
          </div>

          {/* Description */}
          <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: '#6B7280', marginBottom: '4px' }}>
              Description & Rubric Notes
            </div>
            <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5, margin: 0 }}>
              {task.description || 'No detailed instructions entered for this task.'}
            </p>
          </div>

          {/* Key metadata grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="metric-card" style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 }}>
                Priority Urgency Score
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: isHigh ? '#B23A3A' : '#1F5C3D', marginTop: '2px' }}>
                {task.priority_score !== undefined ? `${task.priority_score}/100` : '50/100'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>
                Calculated by Claude AI logic
              </div>
            </div>

            <div className="metric-card" style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 }}>
                Target Deadline
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
                {task.deadline ? task.deadline.replace('T', ' ').slice(0, 16) : 'No strict deadline'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>
                {task.scheduledSlot ? `Slot: ${task.scheduledSlot}` : 'Flexible allocation'}
              </div>
            </div>
          </div>

          {/* Status banner */}
          <div style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: isCompleted ? '#ECFDF5' : '#FFFBEB',
            border: `1px solid ${isCompleted ? '#A7F3D0' : '#FDE68A'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.84rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{isCompleted ? '✅' : '⏳'}</span>
              <strong style={{ color: isCompleted ? '#065F46' : '#92400E' }}>
                Status: {isCompleted ? 'Completed' : 'Pending Commitment'}
              </strong>
            </div>
            <button
              type="button"
              className={`btn btn-sm ${isCompleted ? 'btn-secondary' : 'btn-primary'}`}
              onClick={handleToggleComplete}
              disabled={isUpdating}
            >
              {isUpdating ? 'Saving...' : isCompleted ? 'Mark Pending' : 'Mark Completed ✓'}
            </button>
          </div>

          {/* Footer controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #E2E8F0' }}>
            <button
              type="button"
              className="btn btn-sm"
              style={{ color: '#B23A3A', background: 'transparent', border: '1px solid #FCA5A5' }}
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : '🗑️ Delete Task'}
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
