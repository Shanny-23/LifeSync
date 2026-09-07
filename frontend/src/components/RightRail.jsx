import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { useToast } from '../context/ToastContext';
import { getTasks } from '../api';
import gsap, { prefersReducedMotion } from '../lib/gsap';

function formatSlotTime(slotStr, deadlineStr) {
  if (slotStr) {
    const match = slotStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})$/);
    if (match) {
      const [, year, month, day, timeRange] = match;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = monthNames[parseInt(month, 10) - 1] || month;
      return `${monthName} ${parseInt(day, 10)} • ${timeRange.replace(/\s+/g, ' ')}`;
    }
    return slotStr;
  }
  if (deadlineStr) {
    try {
      const d = new Date(deadlineStr);
      if (!isNaN(d.getTime())) {
        return `Due ${format(d, 'MMM d, h:mm a')}`;
      }
    } catch {
      // fallback
    }
    return `Due ${deadlineStr.replace('T', ' ').slice(0, 16)}`;
  }
  return 'Flexible Schedule';
}

export default function RightRail({ onCalendarToggle, onTaskSelect, onDateSelect }) {
  const toast = useToast();
  const tasksListRef = useRef(null);
  const [currentMonthDate, setCurrentMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  const [sources, setSources] = useState(() => {
    try {
      const saved = localStorage.getItem('lifesync_cal_sources');
      return saved ? JSON.parse(saved) : { canvas: true, google: true, personal: true };
    } catch {
      return { canvas: true, google: true, personal: true };
    }
  });

  const fetchUpcoming = useCallback(async () => {
    try {
      setLoadingTasks(true);
      const allTasks = await getTasks();
      if (Array.isArray(allTasks)) {
        // Filter pending tasks sorted by priority score or deadline
        const pending = allTasks
          .filter((t) => !t.completed && t.status !== 'completed')
          .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
          .slice(0, 3);
        setUpcomingTasks(pending);
      }
    } catch (err) {
      console.warn('Failed to load upcoming tasks in RightRail:', err);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    fetchUpcoming();
    const handleRefresh = () => fetchUpcoming();
    window.addEventListener('lifesync:refresh', handleRefresh);
    window.addEventListener('lifesync:task-created', handleRefresh);
    return () => {
      window.removeEventListener('lifesync:refresh', handleRefresh);
      window.removeEventListener('lifesync:task-created', handleRefresh);
    };
  }, [fetchUpcoming]);

  // Stagger-fade incoming tasks on load
  useEffect(() => {
    if (loadingTasks || prefersReducedMotion() || !tasksListRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.lookahead-item',
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.28, stagger: 0.05, ease: 'power2.out' }
      );
    }, tasksListRef);
    return () => ctx.revert();
  }, [loadingTasks, upcomingTasks]);

  const toggleSource = (sourceKey, label) => {
    setSources((prev) => {
      const nextVal = !prev[sourceKey];
      const next = { ...prev, [sourceKey]: nextVal };
      try {
        localStorage.setItem('lifesync_cal_sources', JSON.stringify(next));
      } catch {
        // fallback
      }
      toast.info(`${label} feed ${nextVal ? 'enabled' : 'hidden'}`);
      window.dispatchEvent(new CustomEvent('lifesync:calendar-sources-changed', { detail: next }));
      if (onCalendarToggle) onCalendarToggle(next);
      return next;
    });
  };

  const daysHeader = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Dynamic calendar days generation for currentMonthDate
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonthDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const today = new Date();

    return days.map((day) => ({
      date: day,
      dayNumber: day.getDate(),
      isCurrentMonth: isSameMonth(day, currentMonthDate),
      isToday: isSameDay(day, today),
      isSelected: isSameDay(day, selectedDate),
      hasEvent: [1, 3, 5].includes(day.getDay()),
    }));
  }, [currentMonthDate, selectedDate]);

  const handlePrevMonth = () => {
    setCurrentMonthDate((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate((prev) => addMonths(prev, 1));
  };

  const handleDayClick = (item) => {
    if (!item.isCurrentMonth) return;
    setSelectedDate(item.date);
    toast.info(`Selected ${format(item.date, 'MMMM d, yyyy')}`);
    if (onDateSelect) onDateSelect(item);
  };

  const handleTaskClick = (task) => {
    if (onTaskSelect) {
      onTaskSelect(task);
    } else {
      toast.info(`Selected: ${task.task || task.title}`);
    }
  };

  return (
    <aside className="workspace-right-rail">
      {/* 1. Mini Calendar */}
      <div className="rail-widget">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span className="rail-widget-title" style={{ margin: 0 }}>
            {format(currentMonthDate, 'MMMM yyyy')}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span
              style={{ fontSize: '0.82rem', color: '#6B7280', cursor: 'pointer', padding: '2px 6px', userSelect: 'none' }}
              onClick={handlePrevMonth}
              title="Previous Month"
            >
              &lt;
            </span>
            <span
              style={{ fontSize: '0.82rem', color: '#6B7280', cursor: 'pointer', padding: '2px 6px', userSelect: 'none' }}
              onClick={handleNextMonth}
              title="Next Month"
            >
              &gt;
            </span>
          </div>
        </div>

        <div className="mini-cal-grid">
          {daysHeader.map((d) => (
            <div key={d} className="mini-cal-header">{d}</div>
          ))}
          {calendarDays.map((item, idx) => {
            return (
              <div
                key={idx}
                className={`mini-cal-day ${item.isSelected ? 'active' : ''} ${item.hasEvent ? 'has-event' : ''}`}
                style={{
                  opacity: item.isCurrentMonth ? 1 : 0.35,
                  color: item.isToday && !item.isSelected ? '#1B3B2E' : undefined,
                  fontWeight: item.isToday ? 800 : undefined,
                  cursor: item.isCurrentMonth ? 'pointer' : 'default',
                }}
                onClick={() => handleDayClick(item)}
              >
                {item.dayNumber}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Next 48 Hours */}
      <div className="rail-widget">
        <span className="rail-widget-title">⚡ Next 48 Hours</span>
        <div ref={tasksListRef} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loadingTasks && upcomingTasks.length === 0 ? (
            <div style={{ padding: '12px 0', fontSize: '0.78rem', color: '#6B7280', textAlign: 'center' }}>
              Loading upcoming commitments...
            </div>
          ) : upcomingTasks.length === 0 ? (
            <div style={{ padding: '12px 0', fontSize: '0.78rem', color: '#6B7280', textAlign: 'center' }}>
              No urgent tasks in the next 48 hours.
            </div>
          ) : (
            upcomingTasks.map((task) => (
              <div
                key={task.id}
                className="lookahead-item"
                onClick={() => handleTaskClick(task)}
                title="Click to inspect task"
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <span
                    className="lookahead-title"
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    {task.task || task.title}
                  </span>
                  <span
                    className={`pill-eyebrow ${(task.urgency === 'high' || (task.priority_score || 0) >= 75) ? 'coral' : 'green'}`}
                    style={{
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      fontSize: '0.62rem',
                      padding: '2px 7px',
                      letterSpacing: '0.04em',
                      marginTop: '1px',
                    }}
                  >
                    Score {task.priority_score || 0}
                  </span>
                </div>
                <div
                  className="lookahead-time"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                    marginTop: '2px',
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                      color: '#64748B',
                      fontSize: '0.72rem',
                    }}
                    title={formatSlotTime(task.scheduledSlot, task.deadline)}
                  >
                    <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>🕒</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {formatSlotTime(task.scheduledSlot, task.deadline)}
                    </span>
                  </span>
                  <span
                    style={{
                      flexShrink: 0,
                      background: '#F1F5F9',
                      color: '#334155',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontWeight: 600,
                      fontSize: '0.65rem',
                      letterSpacing: '0.02em',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    {task.category || task.subject || 'General'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. Connected Calendars */}
      <div className="rail-widget">
        <span className="rail-widget-title">Connected Calendars</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div className="calendar-source-item">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="source-dot" style={{ background: '#EA580C' }} />
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>University Canvas</div>
                <div style={{ fontSize: '0.68rem', color: '#6B7280' }}>Academic Timetable & LMS</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={sources.canvas}
              onChange={() => toggleSource('canvas', 'University Canvas')}
              style={{ accentColor: '#1B3B2E', cursor: 'pointer' }}
            />
          </div>

          <div className="calendar-source-item">
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1 }}
              onClick={() => window.open('https://calendar.google.com', '_blank', 'noopener,noreferrer')}
              title="Click to open Google Calendar where events are saved"
            >
              <span className="source-dot" style={{ background: '#2563EB' }} />
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Google Workspace</span>
                  <span style={{ fontSize: '0.65rem', color: '#2563EB' }}>↗</span>
                </div>
                <div style={{ fontSize: '0.68rem', color: '#6B7280' }}>Team meetings & syncs</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={sources.google}
              onChange={() => toggleSource('google', 'Google Workspace')}
              style={{ accentColor: '#1B3B2E', cursor: 'pointer' }}
            />
          </div>

          <div className="calendar-source-item">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="source-dot" style={{ background: '#059669' }} />
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Personal & Habits</div>
                <div style={{ fontSize: '0.68rem', color: '#6B7280' }}>Workouts, routines, meals</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={sources.personal}
              onChange={() => toggleSource('personal', 'Personal & Habits')}
              style={{ accentColor: '#1B3B2E', cursor: 'pointer' }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
