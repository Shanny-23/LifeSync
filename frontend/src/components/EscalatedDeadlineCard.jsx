import { useState } from 'react';
import { useToast } from '../context/ToastContext';

export default function EscalatedDeadlineCard({
  taskTitle = "CS101 Term Paper Draft",
  category = "Academic",
  dueText = "Due Today • 5:00 PM",
  countdownText = "03h 14m left",
  subtasks = [
    { id: 1, text: "Finalize dataset & methodologies review", done: true },
    { id: 2, text: "Draft conclusion & future work", done: false },
    { id: 3, text: "Write task summary & IEEE format cross-check", done: false }
  ],
  onActionClick
}) {
  const toast = useToast();
  const [milestones, setMilestones] = useState(subtasks);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const toggleMilestone = (id) => {
    setMilestones((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const nextDone = !m.done;
          toast.info(nextDone ? `Milestone checked: ${m.text}` : `Milestone restored: ${m.text}`);
          return { ...m, done: nextDone };
        }
        return m;
      })
    );
  };

  const handleAddSubtask = (e) => {
    e.preventDefault();
    if (!newSubtaskText.trim()) return;
    setMilestones((prev) => [
      ...prev,
      { id: Date.now(), text: newSubtaskText.trim(), done: false }
    ]);
    toast.success(`Added subtask: "${newSubtaskText.trim()}"`);
    setNewSubtaskText('');
    setIsAdding(false);
  };

  const completedCount = milestones.filter((m) => m.done).length;

  const handleWorkspaceClick = () => {
    if (onActionClick) {
      onActionClick();
    } else {
      toast.info(`Opening Workspace view for: ${taskTitle}`);
    }
  };

  return (
    <div className="escalated-deadline-card">
      <div className="escalated-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="pill-eyebrow coral" style={{ background: '#B23A3A', color: '#FFFFFF' }}>
            {dueText}
          </span>
          <span className="pill-eyebrow neutral">{category}</span>
        </div>
        <span className="countdown-pill">{countdownText}</span>
      </div>

      <div className="escalated-task-title">{taskTitle}</div>
      <div className="escalated-task-meta">
        Completed {completedCount} of {milestones.length} milestones
      </div>

      <div className="milestone-checklist">
        {milestones.map((m) => (
          <label key={m.id} className="milestone-item" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={m.done}
              onChange={() => toggleMilestone(m.id)}
            />
            <span
              style={{
                textDecoration: m.done ? 'line-through' : 'none',
                opacity: m.done ? 0.65 : 1
              }}
            >
              {m.text}
            </span>
          </label>
        ))}

        {isAdding && (
          <form onSubmit={handleAddSubtask} style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
            <input
              type="text"
              placeholder="Enter subtask..."
              value={newSubtaskText}
              onChange={(e) => setNewSubtaskText(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 10px',
                fontSize: '0.8rem',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                outline: 'none'
              }}
              autoFocus
            />
            <button type="submit" className="btn btn-coral btn-sm">Add</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsAdding(false)}>Cancel</button>
          </form>
        )}
      </div>

      <div className="escalated-card-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setIsAdding(true)}
          style={{ background: '#FFFFFF', color: '#7F1D1D', borderColor: '#FCA5A5' }}
        >
          + Add Subtask
        </button>
        <button
          type="button"
          className="btn btn-coral btn-sm"
          onClick={handleWorkspaceClick}
        >
          Open Task Details →
        </button>
      </div>
    </div>
  );
}
