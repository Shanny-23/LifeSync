import { useState, useEffect, useRef, useCallback } from 'react';
import { createTask } from '../api';
import gsap, { animateModalEnter, animateModalExit } from '../lib/gsap';

export default function NewTaskModal({ isOpen, onClose, onTaskCreated }) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('CS101');
  const [customSubject, setCustomSubject] = useState('');
  const [urgency, setUrgency] = useState('medium');
  const [taskType, setTaskType] = useState('assignment');
  const [deadline, setDeadline] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [touched, setTouched] = useState(false);

  const titleInputRef = useRef(null);
  const backdropRef = useRef(null);
  const modalRef = useRef(null);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    animateModalExit(backdropRef.current, modalRef.current, () => {
      setIsClosing(false);
      setShouldRender(false);
      onClose();
    });
  }, [isClosing, onClose]);

  // Sync shouldRender with isOpen prop
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      setTitle('');
      setSubject('CS101');
      setCustomSubject('');
      setUrgency('medium');
      setTaskType('assignment');
      setDeadline('');
      setDescription('');
      setIsSubmitting(false);
      setErrorMessage(null);
      setTouched(false);
    } else if (shouldRender && !isClosing) {
      handleClose();
    }
  }, [isOpen]);

  // Animate enter when shouldRender becomes true
  useEffect(() => {
    if (!shouldRender || isClosing) return;

    const ctx = gsap.context(() => {
      animateModalEnter(backdropRef.current, modalRef.current, () => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
        }
      });
    }, backdropRef);

    return () => ctx.revert();
  }, [shouldRender]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && shouldRender && !isClosing) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shouldRender, isClosing, handleClose]);

  if (!shouldRender) return null;

  const isTitleValid = title.trim().length > 0;
  const resolvedSubject = subject === 'custom' ? (customSubject.trim() || 'General') : subject;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);

    if (!isTitleValid) {
      setErrorMessage('Please enter a task title.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const taskPayload = {
      title: title.trim(),
      subject: resolvedSubject,
      category: resolvedSubject,
      type: taskType,
      urgency,
      priority_score: urgency === 'high' ? 88 : urgency === 'low' ? 30 : 60,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      description: description.trim() || null,
    };

    try {
      const createdTask = await createTask(taskPayload);

      // Notify parent & dispatch global event for active pages to react
      if (onTaskCreated) {
        onTaskCreated(createdTask);
      }
      window.dispatchEvent(
        new CustomEvent('lifesync:task-created', { detail: createdTask })
      );

      handleClose();
    } catch (err) {
      console.error('Backend createTask failed:', err);
      const detail = err.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : err.message || 'Failed to create task on server. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      ref={backdropRef}
      className="modal-backdrop" 
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal-card" ref={modalRef}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="pill-eyebrow forest" style={{ fontSize: '0.65rem' }}>
              QUICK COMMITMENT
            </span>
            <h2 id="modal-title" className="modal-title">New Quick Task</h2>
          </div>
          <button 
            type="button" 
            className="modal-close-btn" 
            onClick={handleClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="modal-error-banner">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="modal-form">
          {/* Required: Task Title */}
          <div className="form-group">
            <label htmlFor="task-title" className="form-label">
              Task Title <span style={{ color: '#B23A3A' }}>*</span>
            </label>
            <input
              id="task-title"
              ref={titleInputRef}
              type="text"
              className={`form-input ${touched && !isTitleValid ? 'input-error' : ''}`}
              placeholder="e.g., Read CS101 Chapter 4 or Review Methodologies"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              required
            />
            {touched && !isTitleValid && (
              <span className="form-helper error">Task title is required.</span>
            )}
          </div>

          {/* Row: Subject & Task Type */}
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="task-subject" className="form-label">
                Subject / Course
              </label>
              <select
                id="task-subject"
                className="form-select"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              >
                <option value="CS101">CS101 (Computer Science)</option>
                <option value="MATH204">MATH204 (Linear Algebra)</option>
                <option value="CS202">CS202 (Operating Systems)</option>
                <option value="ROBOTICS">ROBOTICS Club</option>
                <option value="PRODUCT">PRODUCT Design</option>
                <option value="General">General / Routine</option>
                <option value="custom">+ Custom Subject...</option>
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="task-type" className="form-label">
                Commitment Type
              </label>
              <select
                id="task-type"
                className="form-select"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
              >
                <option value="assignment">Assignment</option>
                <option value="study_topic">Study Topic</option>
                <option value="exam_work">Exam Prep</option>
                <option value="routine_habit">Routine Habit</option>
              </select>
            </div>
          </div>

          {/* Custom Subject text field if chosen */}
          {subject === 'custom' && (
            <div className="form-group">
              <label htmlFor="custom-subject" className="form-label">
                Custom Subject Name
              </label>
              <input
                id="custom-subject"
                type="text"
                className="form-input"
                placeholder="e.g., ECON101 or Lab Project"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
              />
            </div>
          )}

          {/* Row: Urgency & Deadline */}
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Urgency Level</label>
              <div className="urgency-pill-group">
                <button
                  type="button"
                  className={`urgency-pill-btn ${urgency === 'high' ? 'active high' : ''}`}
                  onClick={() => setUrgency('high')}
                >
                  🔴 High (85+)
                </button>
                <button
                  type="button"
                  className={`urgency-pill-btn ${urgency === 'medium' ? 'active medium' : ''}`}
                  onClick={() => setUrgency('medium')}
                >
                  🟡 Medium (60)
                </button>
                <button
                  type="button"
                  className={`urgency-pill-btn ${urgency === 'low' ? 'active low' : ''}`}
                  onClick={() => setUrgency('low')}
                >
                  🟢 Low (30)
                </button>
              </div>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="task-deadline" className="form-label">
                Deadline (Optional)
              </label>
              <input
                id="task-deadline"
                type="datetime-local"
                className="form-input"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          {/* Optional: Description */}
          <div className="form-group">
            <label htmlFor="task-desc" className="form-label">
              Notes & Description (Optional)
            </label>
            <textarea
              id="task-desc"
              rows={2}
              className="form-textarea"
              placeholder="Add key milestones, topics to review, or reference links..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Modal Footer Actions */}
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!isTitleValid || isSubmitting}
              style={{
                opacity: !isTitleValid || isSubmitting ? 0.6 : 1,
                cursor: !isTitleValid || isSubmitting ? 'not-allowed' : 'pointer',
                minWidth: '96px',
              }}
            >
              {isSubmitting ? 'Creating...' : '+ Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
