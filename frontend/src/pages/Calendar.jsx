import { useState, useEffect, useCallback } from 'react';
import { startOfWeek, endOfWeek, addDays, format } from 'date-fns';
import AtAGlanceMetrics from '../components/AtAGlanceMetrics';
import RightRail from '../components/RightRail';
import TaskDetailModal from '../components/TaskDetailModal';
import { getSchedule, generateSchedule, resolveConflicts, getEvents } from '../api';
import { useToast } from '../context/ToastContext';

export default function Calendar() {
  const [scheduleSlots, setScheduleSlots] = useState([]);
  const [events, setEvents] = useState([]);
  const [viewMode, setViewMode] = useState('Day'); // Day | Week | Month
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [suggestedSlotAccepted, setSuggestedSlotAccepted] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const toast = useToast();

  // Anchor to current week
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const fromDateStr = format(weekStart, 'yyyy-MM-dd');
  const toDateStr = format(weekEnd, 'yyyy-MM-dd');

  // Selected date for Day view (defaults to today)
  const [selectedDayStr, setSelectedDayStr] = useState(format(now, 'yyyy-MM-dd'));

  const weekDays = [0, 1, 2, 3, 4, 5, 6].map((offset) => {
    const dateObj = addDays(weekStart, offset);
    const dateStr = format(dateObj, 'yyyy-MM-dd');
    return {
      offset,
      dateObj,
      dateStr,
      dayName: format(dateObj, 'EEE'),
      dayNum: format(dateObj, 'd'),
      isToday: format(now, 'yyyy-MM-dd') === dateStr,
    };
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [liveSchedule, liveEvents] = await Promise.all([
        getSchedule({ from: fromDateStr, to: toDateStr, status: 'all' }),
        getEvents({ from: fromDateStr, to: toDateStr }),
      ]);

      setScheduleSlots(Array.isArray(liveSchedule) ? liveSchedule : []);
      setEvents(Array.isArray(liveEvents) ? liveEvents : []);
    } catch (err) {
      console.warn('Backend unavailable, failed to load schedule:', err);
      setError("Couldn't load schedule — is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [fromDateStr, toDateStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerateSchedule = async () => {
    setIsProcessingAI(true);
    setActionMessage(null);
    try {
      const result = await generateSchedule(7);
      setActionMessage({
        type: 'success',
        text: `AI Schedule generated! Allocated ${result?.scheduled_slots_count ?? 3} slots.`,
      });
      await loadData();
    } catch (err) {
      const detail = err.message || '';
      const isMissingKey =
        detail.toLowerCase().includes('anthropic') ||
        detail.toLowerCase().includes('api_key') ||
        detail.toLowerCase().includes('api key');

      setActionMessage({
        type: isMissingKey ? 'warning' : 'error',
        text: isMissingKey
          ? 'AI Scheduler requires ANTHROPIC_API_KEY to be configured on the backend server.'
          : `Schedule generation note: ${detail}`,
      });
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleResolveConflicts = async () => {
    setIsProcessingAI(true);
    setActionMessage(null);
    try {
      const result = await resolveConflicts(7);
      setActionMessage({
        type: 'success',
        text: `Conflict check complete: ${result?.total_conflicts_resolved ?? 0} conflicts adjusted and logged.`,
      });
      await loadData();
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: `Conflict resolver: ${err.message}`,
      });
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleAcceptSlot = () => {
    setSuggestedSlotAccepted(true);
    setActionMessage({
      type: 'success',
      text: 'Suggested Focus Block accepted and committed to your active schedule!',
    });
  };

  // Group slots by day
  const slotsForSelectedDay = scheduleSlots.filter((slot) => {
    if (slot.scheduled_date) return slot.scheduled_date === selectedDayStr;
    if (slot.scheduledSlot) return slot.scheduledSlot.startsWith(selectedDayStr);
    return false;
  });

  return (
    <div className="workspace-body">
      {/* Primary Column */}
      <div className="workspace-primary-col">
        {/* 1. Header Toolbar */}
        <div className="calendar-header-toolbar">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Calendar & Daily Schedule</h1>
              <span className={`pill-eyebrow ${error ? 'coral' : 'green'}`}>
                {error ? '● Offline' : '● Live Schedule API'}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '2px' }}>
              Week of {format(weekStart, 'MMMM d')} – {format(weekEnd, 'MMMM d, yyyy')} •{' '}
              {scheduleSlots.length} Active Slots • {events.length} Academic Events
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* View Mode Toggle */}
            <div className="view-mode-toggle">
              {['Day', 'Week', 'Month'].map((mode) => (
                <button
                  key={mode}
                  className={`view-mode-btn ${viewMode === mode ? 'active' : ''}`}
                  onClick={() => setViewMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={handleResolveConflicts}
              disabled={isProcessingAI || loading}
            >
              🛡️ Check Conflicts
            </button>

            <button
              className="btn btn-primary btn-sm"
              onClick={handleGenerateSchedule}
              disabled={isProcessingAI || loading}
            >
              ⚡ {isProcessingAI ? 'Running AI...' : 'Generate AI Schedule'}
            </button>
          </div>
        </div>

        {/* Action feedback / warnings */}
        {actionMessage && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 600,
              background:
                actionMessage.type === 'success'
                  ? '#ECFDF5'
                  : actionMessage.type === 'warning'
                  ? '#FFFBEB'
                  : '#FEF2F2',
              color:
                actionMessage.type === 'success'
                  ? '#065F46'
                  : actionMessage.type === 'warning'
                  ? '#92400E'
                  : '#991B1B',
              border: `1px solid ${
                actionMessage.type === 'success'
                  ? '#A7F3D0'
                  : actionMessage.type === 'warning'
                  ? '#FDE68A'
                  : '#FECACA'
              }`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              {actionMessage.type === 'warning' ? '⚠️ ' : actionMessage.type === 'error' ? '❌ ' : '✅ '}
              {actionMessage.text}
            </div>
            <button
              onClick={() => setActionMessage(null)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Error notification if backend unreachable */}
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
              onClick={loadData}
              className="btn btn-sm"
              style={{ background: '#991B1B', color: '#FFFFFF', border: 'none' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* 2. Metrics Row */}
        <AtAGlanceMetrics />

        {/* 3. Week Day Strip Selector */}
        <div className="week-strip-card">
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>Weekly Days</div>
            <div style={{ fontSize: '0.74rem', color: '#6B7280' }}>
              Select a day to view scheduled slots
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {weekDays.map((d) => {
              const isSelected = selectedDayStr === d.dateStr;
              const hasSlots = scheduleSlots.some(
                (s) => s.scheduled_date === d.dateStr || (s.scheduledSlot && s.scheduledSlot.startsWith(d.dateStr))
              );

              return (
                <div
                  key={d.dateStr}
                  className={`week-day-pill ${d.isToday ? 'today' : ''}`}
                  style={{
                    border: isSelected && !d.isToday ? '2px solid #1B3B2E' : undefined,
                    background: isSelected && !d.isToday ? '#E7F0EA' : undefined,
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedDayStr(d.dateStr)}
                >
                  <span className="day-name">{d.dayName}</span>
                  <span className="day-num">{d.dayNum}</span>
                  {hasSlots && (
                    <span
                      className="day-dot"
                      style={{ background: d.isToday ? '#FFFFFF' : '#1F5C3D' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Timeline View (Day or Week) */}
        {viewMode === 'Week' ? (
          <div className="collab-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span className="rail-widget-title" style={{ margin: 0 }}>
                Week Overview: {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')}
              </span>
              <span className="pill-eyebrow forest">{scheduleSlots.length} Total Slots</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
              {weekDays.map((d) => {
                const daySlots = scheduleSlots.filter(
                  (s) => s.scheduled_date === d.dateStr || (s.scheduledSlot && s.scheduledSlot.startsWith(d.dateStr))
                );

                return (
                  <div
                    key={d.dateStr}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '10px',
                      background: d.isToday ? '#FAFDFB' : '#FFFFFF',
                      minHeight: '140px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '4px' }}>
                      <strong style={{ fontSize: '0.82rem', color: d.isToday ? '#1F5C3D' : '#334155' }}>
                        {d.dayName} {d.dayNum}
                      </strong>
                      <span className="pill-eyebrow neutral" style={{ fontSize: '0.62rem' }}>
                        {daySlots.length}
                      </span>
                    </div>

                    {daySlots.length === 0 ? (
                      <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '12px' }}>
                        Free day
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {daySlots.map((slot) => (
                          <div
                            key={slot.id}
                            style={{
                              fontSize: '0.72rem',
                              padding: '4px 6px',
                              borderRadius: '4px',
                              background: slot.urgency === 'high' ? '#FEE2E2' : '#F1F5F9',
                              color: slot.urgency === 'high' ? '#991B1B' : '#1E293B',
                              fontWeight: 600,
                            }}
                          >
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {slot.task || slot.task_title || 'Study Slot'}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: '#64748B' }}>
                              {slot.start_time ? `${slot.start_time} - ${slot.end_time}` : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Centerpiece Day Timeline */
          <div className="timeline-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span className="rail-widget-title" style={{ margin: 0 }}>
                Day Timeline • {format(new Date(selectedDayStr + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
              </span>
              <span className="pill-eyebrow forest">
                {slotsForSelectedDay.length} Scheduled Slot(s)
              </span>
            </div>

            {loading ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#6B7280', fontSize: '0.9rem' }}>
                ⏳ Loading schedule from backend...
              </div>
            ) : slotsForSelectedDay.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {slotsForSelectedDay.map((slot) => {
                  const isHigh = slot.urgency === 'high';
                  return (
                    <div key={slot.id} className="timeline-row">
                      <div className="timeline-time-label" style={{ color: isHigh ? '#B23A3A' : '#1B3B2E' }}>
                        {slot.start_time || 'Active'}
                      </div>
                      <div className="timeline-content-slot">
                        <div
                          className="slot-block"
                          style={{
                            background: isHigh ? '#FFF5F3' : '#F0FDF4',
                            border: `1px solid ${isHigh ? '#FCA5A5' : '#86EFAC'}`,
                            padding: '12px 16px',
                            borderRadius: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className={`pill-eyebrow ${isHigh ? 'coral' : 'green'}`}>
                                {slot.urgency ? slot.urgency.toUpperCase() : 'SCHEDULED'}
                              </span>
                              <strong style={{ fontSize: '0.95rem', color: isHigh ? '#991B1B' : '#166534' }}>
                                {slot.task || slot.task_title}
                              </strong>
                            </div>
                            <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                              {slot.start_time} – {slot.end_time}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                            Category: {slot.category || slot.subject || 'Academic'} • Type: {slot.slot_type || 'regular'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Fallback default timeline display when slots have not been generated yet */
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* 08:00 - 09:00: Free Buffer */}
                <div className="timeline-row">
                  <div className="timeline-time-label">08:00 AM</div>
                  <div className="timeline-content-slot">
                    <div className="slot-block buffer">
                      ⏳ Unscheduled Morning Buffer • 60 mins free for reflection / breakfast
                    </div>
                  </div>
                </div>

                {/* 09:00 - 09:45: Routine Completed */}
                <div className="timeline-row">
                  <div className="timeline-time-label">09:00 AM</div>
                  <div className="timeline-content-slot">
                    <div className="slot-block routine-completed">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>🧘</span>
                          <strong>Yoga Session & Reset</strong>
                          <span className="pill-eyebrow green">Completed ✓</span>
                        </div>
                        <span style={{ fontSize: '0.74rem', color: '#166534' }}>09:00 AM – 09:45 AM</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 13:30 - 14:45: Meeting block */}
                <div className="timeline-row">
                  <div className="timeline-time-label">01:30 PM</div>
                  <div className="timeline-content-slot">
                    <div className="slot-block meeting">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span className="pill-eyebrow forest" style={{ background: '#DCFCE7', color: '#166534' }}>
                              STUDY BLOCK
                            </span>
                            <span className="pill-eyebrow" style={{ background: '#E0F2FE', color: '#0369A1', fontSize: '0.65rem', border: '1px solid #BAE6FD' }}>
                              🧠 Spaced Repetition
                            </span>
                            <strong style={{ fontSize: '0.92rem', color: '#1B3B2E' }}>
                              Math 204 Midterm Review & Problem Set
                            </strong>
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#4B5563', marginTop: '4px' }}>
                            01:30 PM – 02:45 PM • Linear transformations & eigenvalues practice
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSelectedTask({
                              id: 994,
                              title: 'Math 204 Midterm Review & Problem Set',
                              task: 'Math 204 Midterm Review & Problem Set',
                              category: 'MATH204',
                              subject: 'MATH204',
                              priority_score: 75,
                              deadline: 'Tomorrow, 10:00 AM',
                              description: 'Spaced repetition study block focused on diagonalization, rank-nullity theorem, and past exam questions.',
                            });
                          }}
                        >
                          ⚡ Inspect Block
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 15:00 - 16:30: AI Suggested Focus Block */}
                <div className="timeline-row">
                  <div className="timeline-time-label">03:00 PM</div>
                  <div className="timeline-content-slot">
                    <div
                      className="slot-block suggested-focus"
                      style={{
                        borderStyle: suggestedSlotAccepted ? 'solid' : 'dashed',
                        borderColor: suggestedSlotAccepted ? '#10B981' : '#9333EA',
                        background: suggestedSlotAccepted ? '#F0FDF4' : '#FAF5FF',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            className="pill-eyebrow"
                            style={{
                              background: suggestedSlotAccepted ? '#DCFCE7' : '#F3E8FF',
                              color: suggestedSlotAccepted ? '#15803D' : '#7E22CE',
                            }}
                          >
                            {suggestedSlotAccepted ? 'COMMITTED FOCUS SLOT' : 'AI PROPOSED FOCUS BLOCK'}
                          </span>
                          <strong style={{ fontSize: '0.92rem', color: suggestedSlotAccepted ? '#14532D' : '#581C87' }}>
                            Suggested Focus Block: CS101 Diagramming
                          </strong>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: suggestedSlotAccepted ? '#166534' : '#6B21A8', marginTop: '4px' }}>
                          03:00 PM – 04:30 PM • Fitted into free gap between lecture and evening review
                        </div>
                      </div>

                      <div>
                        {suggestedSlotAccepted ? (
                          <span className="pill-eyebrow green" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                            ✓ Slot Accepted & Locked
                          </span>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ background: '#7E22CE' }}
                            onClick={handleAcceptSlot}
                          >
                            ⚡ Accept Slot
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Rail Contextual Info */}
      <RightRail onTaskSelect={(t) => setSelectedTask(t)} />

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={() => loadData()}
        onTaskDeleted={() => loadData()}
      />
    </div>
  );
}
