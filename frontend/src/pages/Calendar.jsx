import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
} from 'date-fns';
import AtAGlanceMetrics from '../components/AtAGlanceMetrics';
import RightRail from '../components/RightRail';
import TaskDetailModal from '../components/TaskDetailModal';
import { getSchedule, generateSchedule, resolveConflicts, getEvents, getTasks } from '../api';
import { useToast } from '../context/ToastContext';
import { useWorkspace } from '../context/WorkspaceContext';
import gsap, { prefersReducedMotion } from '../lib/gsap';

export default function Calendar() {
  const { filterByWorkspace } = useWorkspace();
  const calendarGridRef = useRef(null);
  const [scheduleSlots, setScheduleSlots] = useState([]);
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [calSources, setCalSources] = useState(() => {
    try {
      const saved = localStorage.getItem('lifesync_cal_sources');
      return saved ? JSON.parse(saved) : { canvas: true, google: true, personal: true };
    } catch {
      return { canvas: true, google: true, personal: true };
    }
  });
  const [viewMode, setViewMode] = useState('Day'); // Day | Week | Month
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const toast = useToast();

  useEffect(() => {
    const handleSourceChange = (e) => {
      if (e.detail) setCalSources(e.detail);
    };
    window.addEventListener('lifesync:calendar-sources-changed', handleSourceChange);
    return () => window.removeEventListener('lifesync:calendar-sources-changed', handleSourceChange);
  }, []);

  // Animate calendar items fading smoothly when sources or view mode changes
  useEffect(() => {
    if (!calendarGridRef.current || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        calendarGridRef.current,
        { opacity: 0.7 },
        { opacity: 1, duration: 0.22, ease: 'power1.out' }
      );
    }, calendarGridRef);
    return () => ctx.revert();
  }, [calSources, viewMode]);

  // Active anchor date (can be navigated backward/forward)
  const [anchorDate, setAnchorDate] = useState(new Date());

  // Selected day string for Day view (YYYY-MM-DD)
  const [selectedDayStr, setSelectedDayStr] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Calculated date ranges based on anchorDate
  const weekStart = useMemo(() => startOfWeek(anchorDate, { weekStartsOn: 1 }), [anchorDate]);
  const weekEnd = useMemo(() => endOfWeek(anchorDate, { weekStartsOn: 1 }), [anchorDate]);
  const monthStart = useMemo(() => startOfMonth(anchorDate), [anchorDate]);
  const monthEnd = useMemo(() => endOfMonth(anchorDate), [anchorDate]);

  // Query window covering at least the active month + week buffer
  const fromDateStr = format(monthStart < weekStart ? monthStart : weekStart, 'yyyy-MM-dd');
  const toDateStr = format(monthEnd > weekEnd ? monthEnd : weekEnd, 'yyyy-MM-dd');

  // Days of current week
  const weekDays = useMemo(() => {
    return [0, 1, 2, 3, 4, 5, 6].map((offset) => {
      const dateObj = addDays(weekStart, offset);
      const dateStr = format(dateObj, 'yyyy-MM-dd');
      return {
        offset,
        dateObj,
        dateStr,
        dayName: format(dateObj, 'EEE'),
        dayNum: format(dateObj, 'd'),
        isToday: format(new Date(), 'yyyy-MM-dd') === dateStr,
      };
    });
  }, [weekStart]);

  // Load all schedule slots, academic events, and tasks
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [liveSchedule, liveEvents, liveTasks] = await Promise.all([
        getSchedule({ from: fromDateStr, to: toDateStr, status: 'all' }),
        getEvents(),
        getTasks(),
      ]);

      setScheduleSlots(Array.isArray(liveSchedule) ? liveSchedule : []);
      setEvents(Array.isArray(liveEvents) ? liveEvents : []);
      setTasks(Array.isArray(liveTasks) ? liveTasks : []);
    } catch (err) {
      console.warn('Failed to load calendar schedule data:', err);
      setError("Couldn't load schedule — is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [fromDateStr, toDateStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen for global refresh events (e.g. from Document Ingestion Studio or Task Creator)
  useEffect(() => {
    const handleGlobalRefresh = () => {
      loadData();
    };
    window.addEventListener('lifesync:refresh', handleGlobalRefresh);
    return () => {
      window.removeEventListener('lifesync:refresh', handleGlobalRefresh);
    };
  }, [loadData]);

  // Date navigation handlers
  const handlePrev = () => {
    if (viewMode === 'Month') {
      setAnchorDate((prev) => subMonths(prev, 1));
    } else {
      setAnchorDate((prev) => subWeeks(prev, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'Month') {
      setAnchorDate((prev) => addMonths(prev, 1));
    } else {
      setAnchorDate((prev) => addWeeks(prev, 1));
    }
  };

  const handleToday = () => {
    const today = new Date();
    setAnchorDate(today);
    setSelectedDayStr(format(today, 'yyyy-MM-dd'));
  };

  // AI Schedule Generation
  const handleGenerateSchedule = async () => {
    setIsProcessingAI(true);
    setActionMessage(null);
    try {
      const result = await generateSchedule(7);
      const count = result?.slots_created ?? result?.scheduled_slots_count ?? 0;
      setActionMessage({
        type: 'success',
        text: `⚡ AI Schedule generated successfully! ${count} study focus block(s) allocated around your fixed classes.`,
      });
      await loadData();
    } catch (err) {
      const detail = err.message || '';
      setActionMessage({
        type: 'error',
        text: `Schedule generation note: ${detail}`,
      });
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Conflict Resolution
  const handleResolveConflicts = async () => {
    setIsProcessingAI(true);
    setActionMessage(null);
    try {
      const result = await resolveConflicts(7);
      setActionMessage({
        type: 'success',
        text: `🛡️ Conflict check complete: ${result?.total_conflicts_resolved ?? 0} conflicts checked and adjusted.`,
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

  // Sorted list of unique academic milestones from events
  const academicMilestones = useMemo(() => {
    const list = [];
    const seen = new Set();
    events.forEach((ev) => {
      const evStart = ev.start_datetime ? new Date(ev.start_datetime) : null;
      const dStr = evStart ? format(evStart, 'yyyy-MM-dd') : ev.date;
      if (!dStr) return;
      const key = `${dStr}_${ev.title}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({
          id: ev.id,
          title: ev.title,
          type: ev.type || 'event',
          dateStr: dStr,
          dateDisplay: evStart ? format(evStart, 'MMM d, yyyy') : dStr,
        });
      }
    });
    return list.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [events]);

  // ---------------------------------------------------------------------------
  // Aggregate unified commitments for a specific date (YYYY-MM-DD)
  // ---------------------------------------------------------------------------
  const getCommitmentsForDate = useCallback(
    (targetDateStr) => {
      const items = [];

      // 1. Academic Events & Fixed Classes (models.Event)
      events.forEach((ev) => {
        const evStart = ev.start_datetime ? new Date(ev.start_datetime) : null;
        const evEnd = ev.end_datetime ? new Date(ev.end_datetime) : evStart;
        const sDateStr = evStart ? format(evStart, 'yyyy-MM-dd') : (ev.date || '');
        const eDateStr = evEnd ? format(evEnd, 'yyyy-MM-dd') : sDateStr;

        if (targetDateStr >= sDateStr && targetDateStr <= eDateStr) {
          const isHoliday = ev.type === 'holiday';
          const isExam = ev.type === 'exam' || ev.type === 'exam_work';
          const isClass = ev.type === 'class' || ev.type === 'class_session';
          const isFest = ev.type === 'fest';
          const isAcademic = ev.type === 'academic_event';

          const startTimeStr = evStart ? format(evStart, 'HH:mm') : '09:00';
          const endTimeStr = ev.end_datetime ? format(new Date(ev.end_datetime), 'HH:mm') : '';

          items.push({
            id: `event-${ev.id}`,
            entityType: 'event',
            type: ev.type,
            title: ev.title,
            subject: ev.subject || (isHoliday ? 'Campus Holiday' : isAcademic ? 'Academic Calendar' : 'Academic'),
            location: ev.location || '',
            description: ev.description || '',
            start_time: startTimeStr,
            end_time: endTimeStr,
            timeLabel: endTimeStr ? `${startTimeStr} – ${endTimeStr}` : startTimeStr,
            rawSortTime: startTimeStr,
            badge: isHoliday ? 'HOLIDAY' : isExam ? 'EXAM / TEST' : isClass ? 'CLASS SESSION' : isFest ? 'CAMPUS FEST' : isAcademic ? 'ACADEMIC EVENT' : 'CAMPUS EVENT',
            urgency: isExam ? 'high' : isHoliday ? 'low' : 'medium',
            colorTheme: isHoliday ? 'holiday' : isExam ? 'exam' : isClass ? 'class' : isFest ? 'fest' : isAcademic ? 'academic' : 'default',
            data: ev,
          });
        }
      });

      // 2. Pending Tasks with deadlines on this day (models.Task)
      tasks.forEach((t) => {
        if (!t.deadline) return;
        const dlDate = new Date(t.deadline);
        const dlDateStr = format(dlDate, 'yyyy-MM-dd');

        if (dlDateStr === targetDateStr) {
          const dlTimeStr = format(dlDate, 'HH:mm');
          const isCompleted = t.status === 'completed';

          items.push({
            id: `task-${t.id}`,
            entityType: 'task_deadline',
            type: t.type || 'assignment',
            title: `${t.title}`,
            subject: t.subject || 'Coursework',
            description: t.description || '',
            weightage: t.weightage,
            priority_score: t.priority_score,
            start_time: dlTimeStr,
            end_time: '',
            timeLabel: `Due at ${format(dlDate, 'hh:mm a')}`,
            rawSortTime: dlTimeStr,
            badge: isCompleted ? 'TASK COMPLETED ✓' : t.type === 'exam_work' ? 'EXAM SUBMISSION' : 'DEADLINE DUE',
            urgency: isCompleted ? 'low' : 'high',
            colorTheme: isCompleted ? 'completed' : 'deadline',
            data: t,
          });
        }
      });

      // 3. AI Scheduled Study Slots (models.ScheduledSlot)
      scheduleSlots.forEach((slot) => {
        const slotDate = slot.scheduled_date || (slot.scheduledSlot ? slot.scheduledSlot.substring(0, 10) : '');
        if (slotDate === targetDateStr) {
          const sTime = slot.start_time || '10:00';
          const eTime = slot.end_time || '11:00';

          items.push({
            id: `slot-${slot.id}`,
            entityType: 'scheduled_slot',
            type: slot.slot_type || 'study_session',
            title: slot.task || slot.task_title || 'Focused Study Session',
            subject: slot.subject || slot.category || 'Academic Focus',
            start_time: sTime,
            end_time: eTime,
            timeLabel: `${sTime} – ${eTime}`,
            rawSortTime: sTime,
            badge: slot.slot_type === 'study_session' ? 'AI STUDY BLOCK' : 'AI FOCUS SLOT',
            urgency: slot.urgency || 'medium',
            colorTheme: 'study_slot',
            data: slot,
          });
        }
      });

      // Chronological sort
      items.sort((a, b) => a.rawSortTime.localeCompare(b.rawSortTime));

      // Filter by active sources
      const sourceFiltered = items.filter((it) => {
        if (!calSources.canvas && (it.badge === 'CLASS SESSION' || it.badge === 'EXAM / TEST' || it.type === 'class' || it.type === 'exam')) {
          return false;
        }
        if (!calSources.google && (it.badge === 'CAMPUS FEST' || it.badge === 'CAMPUS EVENT' || it.type === 'fest' || it.data?.source === 'google')) {
          return false;
        }
        if (!calSources.personal && (it.type === 'habit' || it.type === 'personal')) {
          return false;
        }
        return true;
      });

      return filterByWorkspace(sourceFiltered);
    },
    [events, tasks, scheduleSlots, calSources, filterByWorkspace]
  );

  // Commitments for currently selected day in Day View
  const itemsForSelectedDay = useMemo(() => {
    return getCommitmentsForDate(selectedDayStr);
  }, [getCommitmentsForDate, selectedDayStr]);

  // Active week total count
  const weekTotalCommitments = useMemo(() => {
    return weekDays.reduce((acc, d) => acc + getCommitmentsForDate(d.dateStr).length, 0);
  }, [weekDays, getCommitmentsForDate]);

  // Days in month interval for Month view
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(anchorDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [anchorDate]);

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
              {viewMode === 'Month'
                ? `${format(anchorDate, 'MMMM yyyy')} • ${events.length} Academic Events • ${tasks.length} Tracked Tasks`
                : `Week of ${format(weekStart, 'MMMM d')} – ${format(weekEnd, 'MMMM d, yyyy')} • ${weekTotalCommitments} Active Schedule Items`}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Date Navigation Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.76rem' }}
                onClick={handlePrev}
                title="Previous Period"
              >
                ◀
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.76rem', fontWeight: 700 }}
                onClick={handleToday}
              >
                Today
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.76rem' }}
                onClick={handleNext}
                title="Next Period"
              >
                ▶
              </button>
            </div>

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

            <a
              href="https://calendar.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
              title="Open Google Calendar where your external and synced events are saved"
            >
              <span>📅</span>
              <span>Open Google Calendar ↗</span>
            </a>

            <button
              className="btn btn-primary btn-sm"
              onClick={handleGenerateSchedule}
              disabled={isProcessingAI || loading}
            >
              ⚡ {isProcessingAI ? 'Scheduling...' : 'Generate AI Schedule'}
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
        <AtAGlanceMetrics tasks={tasks} />

        {/* Academic Milestones Quick Jump Selector */}
        {academicMilestones.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px 18px',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>📌</span>
              <div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0F172A' }}>
                  Academic Circular Milestones & Holidays
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                  {academicMilestones.length} dates extracted & synced across semester
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <select
                aria-label="Jump to academic milestone"
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#F8FAFC',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#1E293B',
                  cursor: 'pointer',
                  maxWidth: '320px',
                }}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const targetDate = e.target.value;
                  setSelectedDayStr(targetDate);
                  setAnchorDate(new Date(targetDate + 'T00:00:00'));
                  setViewMode('Day');
                }}
                value={academicMilestones.some((m) => m.dateStr === selectedDayStr) ? selectedDayStr : ''}
              >
                <option value="">Jump directly to any date...</option>
                {academicMilestones.map((m) => (
                  <option key={m.id} value={m.dateStr}>
                    {m.dateDisplay} — {m.title} ({m.type.toUpperCase()})
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {academicMilestones
                  .filter((m) => m.type === 'holiday' || m.type === 'exam')
                  .slice(0, 3)
                  .map((m) => (
                    <button
                      key={`quick-${m.id}`}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        background: selectedDayStr === m.dateStr ? '#1F5C3D' : '#FFFFFF',
                        color: selectedDayStr === m.dateStr ? '#FFFFFF' : '#334155',
                        borderColor: selectedDayStr === m.dateStr ? '#1F5C3D' : '#CBD5E1',
                      }}
                      onClick={() => {
                        setSelectedDayStr(m.dateStr);
                        setAnchorDate(new Date(m.dateStr + 'T00:00:00'));
                        setViewMode('Day');
                      }}
                      title={`${m.dateDisplay}: ${m.title}`}
                    >
                      {m.type === 'holiday' ? '🏖️ ' : '📝 '}
                      {m.title.length > 16 ? m.title.slice(0, 16) + '…' : m.title}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. Week Day Strip Selector (visible in Day & Week views) */}
        {viewMode !== 'Month' && (
          <div className="week-strip-card">
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>Weekly Days</div>
              <div style={{ fontSize: '0.74rem', color: '#6B7280' }}>
                Select a day to view scheduled slots, classes, and deadlines
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {weekDays.map((d) => {
                const isSelected = selectedDayStr === d.dateStr;
                const dayCommitments = getCommitmentsForDate(d.dateStr);
                const hasItems = dayCommitments.length > 0;

                return (
                  <div
                    key={d.dateStr}
                    className={`week-day-pill ${isSelected ? 'selected' : ''} ${d.isToday ? 'today' : ''}`}
                    style={{
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                    onClick={() => {
                      setSelectedDayStr(d.dateStr);
                      if (viewMode !== 'Day') setViewMode('Day');
                    }}
                  >
                    <span className="day-name">{d.dayName}</span>
                    <span className="day-num">{d.dayNum}</span>
                    {hasItems && (
                      <span
                        className="day-dot"
                        style={{
                          background: d.isToday ? '#FFFFFF' : '#1F5C3D',
                        }}
                        title={`${dayCommitments.length} item(s)`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. TIMELINE VIEWS (Day, Week, or Month) */}
        <div ref={calendarGridRef} id="calendar-timeline-section">
        {/* VIEW MODE 1: DAY TIMELINE */}
        {viewMode === 'Day' && (
          <div className="timeline-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <span className="rail-widget-title" style={{ margin: 0 }}>
                  Day Timeline • {format(new Date(selectedDayStr + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
                </span>
                <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '2px' }}>
                  Integrated view of classes, deadlines, exams, and AI focus blocks
                </div>
              </div>
              <span className="pill-eyebrow forest">
                {itemsForSelectedDay.length} Scheduled Commitment(s)
              </span>
            </div>

            {loading ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#6B7280', fontSize: '0.9rem' }}>
                ⏳ Loading schedule from database...
              </div>
            ) : itemsForSelectedDay.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {itemsForSelectedDay.map((item) => {
                  const isExam = item.colorTheme === 'exam';
                  const isDeadline = item.colorTheme === 'deadline';
                  const isClass = item.colorTheme === 'class';
                  const isHoliday = item.colorTheme === 'holiday';
                  const isAcademic = item.colorTheme === 'academic';
                  const isStudy = item.colorTheme === 'study_slot';

                  return (
                    <div key={item.id} className="timeline-row" style={{ alignItems: 'flex-start' }}>
                      {/* Left Time Label */}
                      <div
                        className="timeline-time-label"
                        style={{
                          color: isExam
                            ? '#B23A3A'
                            : isDeadline
                            ? '#B45309'
                            : isHoliday
                            ? '#7C3AED'
                            : isAcademic
                            ? '#1D4ED8'
                            : isClass
                            ? '#1F5C3D'
                            : '#1B3B2E',
                          fontWeight: 700,
                        }}
                      >
                        {item.start_time}
                      </div>

                      {/* Content Card */}
                      <div className="timeline-content-slot">
                        <div
                          className="slot-block"
                          style={{
                            background: isExam
                              ? '#FEF2F2'
                              : isDeadline
                              ? '#FFFBEB'
                              : isHoliday
                              ? '#FAF5FF'
                              : isAcademic
                              ? '#EFF6FF'
                              : isClass
                              ? '#F0FDF4'
                              : '#F8FAFC',
                            border: `1px solid ${
                              isExam
                                ? '#FCA5A5'
                                : isDeadline
                                ? '#FDE68A'
                                : isHoliday
                                ? '#DDD6FE'
                                : isAcademic
                                ? '#BFDBFE'
                                : isClass
                                ? '#86EFAC'
                                : '#CBD5E1'
                            }`,
                            borderLeft: `4px solid ${
                              isExam
                                ? '#DC2626'
                                : isDeadline
                                ? '#D97706'
                                : isHoliday
                                ? '#8B5CF6'
                                : isAcademic
                                ? '#2563EB'
                                : isClass
                                ? '#15803D'
                                : '#10B981'
                            }`,
                            padding: '12px 16px',
                            borderRadius: '10px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span
                                className="pill-eyebrow"
                                style={{
                                  background: isExam
                                    ? '#FEE2E2'
                                    : isDeadline
                                    ? '#FEF3C7'
                                    : isHoliday
                                    ? '#EDE9FE'
                                    : isAcademic
                                    ? '#DBEAFE'
                                    : isClass
                                    ? '#DCFCE7'
                                    : '#E0F2FE',
                                  color: isExam
                                    ? '#991B1B'
                                    : isDeadline
                                    ? '#92400E'
                                    : isHoliday
                                    ? '#6D28D9'
                                    : isAcademic
                                    ? '#1E40AF'
                                    : isClass
                                    ? '#166534'
                                    : '#0369A1',
                                  fontWeight: 700,
                                }}
                              >
                                {item.badge}
                              </span>

                              <strong
                                style={{
                                  fontSize: '0.95rem',
                                  color: isExam
                                    ? '#991B1B'
                                    : isDeadline
                                    ? '#92400E'
                                    : isHoliday
                                    ? '#5B21B6'
                                    : isAcademic
                                    ? '#1E3A8A'
                                    : isClass
                                    ? '#14532D'
                                    : '#0F172A',
                                }}
                              >
                                {item.title}
                              </strong>
                            </div>

                            <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
                              {item.timeLabel}
                            </span>
                          </div>

                          {/* Detail row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem', color: '#475569', marginTop: '4px' }}>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                              {item.subject && <span>📖 <strong>{item.subject}</strong></span>}
                              {item.location && <span>📍 {item.location}</span>}
                              {item.weightage && <span>⚖️ Weightage: {item.weightage}</span>}
                              {item.description && <span>ℹ️ {item.description}</span>}
                            </div>

                            {item.entityType === 'task_deadline' && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                                onClick={() => setSelectedTask(item.data)}
                              >
                                Inspect Task
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Empty state when no items on selected day */
              <div
                style={{
                  textAlign: 'center',
                  padding: '48px 24px',
                  background: '#F8FAFC',
                  borderRadius: '12px',
                  border: '1px dashed #CBD5E1',
                }}
              >
                <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>🏖️</div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1E293B', marginBottom: '4px' }}>
                  No Commitments Scheduled for this Day
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#64748B', maxWidth: '420px', margin: '0 auto 16px auto' }}>
                  This day is clear of classes, exams, and deadlines. You can generate an AI study block or enjoy free time.
                </p>
                <button
                  type="button"
                  className="btn btn-forest btn-sm"
                  onClick={handleGenerateSchedule}
                  disabled={isProcessingAI}
                >
                  ⚡ Generate AI Study Block for Today
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW MODE 2: WEEK OVERVIEW */}
        {viewMode === 'Week' && (
          <div className="collab-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span className="rail-widget-title" style={{ margin: 0 }}>
                Week Overview: {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
              </span>
              <span className="pill-eyebrow forest">{weekTotalCommitments} Total Items This Week</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
              {weekDays.map((d) => {
                const dayItems = getCommitmentsForDate(d.dateStr);
                const isSelected = selectedDayStr === d.dateStr;

                return (
                  <div
                    key={d.dateStr}
                    onClick={() => {
                      setSelectedDayStr(d.dateStr);
                      setViewMode('Day');
                    }}
                    style={{
                      border: isSelected ? '2px solid #1B3B2E' : '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '10px',
                      background: d.isToday ? '#FAFDFB' : '#FFFFFF',
                      minHeight: '170px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '4px' }}>
                      <strong style={{ fontSize: '0.84rem', color: d.isToday ? '#1F5C3D' : '#334155' }}>
                        {d.dayName} {d.dayNum}
                      </strong>
                      <span className={`pill-eyebrow ${dayItems.length > 0 ? 'green' : 'neutral'}`} style={{ fontSize: '0.62rem' }}>
                        {dayItems.length}
                      </span>
                    </div>

                    {dayItems.length === 0 ? (
                      <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '20px', textAlign: 'center' }}>
                        Free day
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1 }}>
                        {dayItems.slice(0, 4).map((item) => {
                          const isExam = item.colorTheme === 'exam';
                          const isDeadline = item.colorTheme === 'deadline';
                          const isClass = item.colorTheme === 'class';
                          const isHoliday = item.colorTheme === 'holiday';
                          const isAcademic = item.colorTheme === 'academic';

                          return (
                            <div
                              key={item.id}
                              style={{
                                fontSize: '0.7rem',
                                padding: '4px 6px',
                                borderRadius: '5px',
                                background: isExam
                                  ? '#FEE2E2'
                                  : isDeadline
                                  ? '#FEF3C7'
                                  : isHoliday
                                  ? '#EDE9FE'
                                  : isAcademic
                                  ? '#DBEAFE'
                                  : isClass
                                  ? '#DCFCE7'
                                  : '#F1F5F9',
                                color: isExam
                                  ? '#991B1B'
                                  : isDeadline
                                  ? '#92400E'
                                  : isHoliday
                                  ? '#6D28D9'
                                  : isAcademic
                                  ? '#1E40AF'
                                  : isClass
                                  ? '#166534'
                                  : '#1E293B',
                                fontWeight: 600,
                                borderLeft: `3px solid ${
                                  isExam
                                    ? '#DC2626'
                                    : isDeadline
                                    ? '#D97706'
                                    : isHoliday
                                    ? '#8B5CF6'
                                    : isAcademic
                                    ? '#2563EB'
                                    : isClass
                                    ? '#15803D'
                                    : '#64748B'
                                }`,
                              }}
                            >
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.title}
                              </div>
                              <div style={{ fontSize: '0.62rem', opacity: 0.8 }}>
                                {item.start_time}
                              </div>
                            </div>
                          );
                        })}
                        {dayItems.length > 4 && (
                          <div style={{ fontSize: '0.68rem', color: '#64748B', textAlign: 'center' }}>
                            +{dayItems.length - 4} more...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW MODE 3: MONTH CALENDAR GRID */}
        {viewMode === 'Month' && (
          <div className="collab-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span className="rail-widget-title" style={{ margin: 0 }}>
                {format(anchorDate, 'MMMM yyyy')} Calendar
              </span>
              <span className="pill-eyebrow neutral">Click any day to view its detailed timeline</span>
            </div>

            {/* Day of Week Headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '6px', textAlign: 'center' }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', padding: '4px' }}>
                  {day}
                </div>
              ))}
            </div>

            {/* Month Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
              {monthDays.map((d) => {
                const dateStr = format(d, 'yyyy-MM-dd');
                const isCurrentMonth = isSameMonth(d, anchorDate);
                const isToday = isSameDay(d, new Date());
                const isSelected = selectedDayStr === dateStr;
                const dayItems = getCommitmentsForDate(dateStr);

                return (
                  <div
                    key={dateStr}
                    onClick={() => {
                      setSelectedDayStr(dateStr);
                      setViewMode('Day');
                    }}
                    style={{
                      border: isSelected ? '2px solid #1B3B2E' : isToday ? '1px solid #15803D' : '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '6px 8px',
                      background: isToday ? '#F0FDF4' : isCurrentMonth ? '#FFFFFF' : '#F8FAFC',
                      minHeight: '76px',
                      cursor: 'pointer',
                      opacity: isCurrentMonth ? 1 : 0.45,
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: isToday ? 800 : 600,
                          color: isToday ? '#15803D' : '#1E293B',
                        }}
                      >
                        {format(d, 'd')}
                      </span>
                      {dayItems.length > 0 && (
                        <span
                          style={{
                            background: '#1F5C3D',
                            color: '#FFFFFF',
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '10px',
                          }}
                        >
                          {dayItems.length}
                        </span>
                      )}
                    </div>

                    {dayItems.length > 0 && (
                      <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {dayItems.slice(0, 3).map((item) => {
                          const isExam = item.colorTheme === 'exam';
                          const isDeadline = item.colorTheme === 'deadline';
                          return (
                            <span
                              key={item.id}
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: isExam ? '#DC2626' : isDeadline ? '#D97706' : '#10B981',
                              }}
                              title={item.title}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Right Rail Contextual Info */}
      <RightRail
        onCalendarToggle={(newSources) => setCalSources(newSources)}
        onTaskSelect={(t) => setSelectedTask(t)}
      />

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
