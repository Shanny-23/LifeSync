import { useState } from 'react';
import { useToast } from '../context/ToastContext';

export default function RightRail({ onCalendarToggle, onTaskSelect, onDateSelect }) {
  const toast = useToast();
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0); // 0 = Sep 2026, 1 = Oct 2026
  const [activeDate, setActiveDate] = useState(7);
  const [sources, setSources] = useState({
    canvas: true,
    google: true,
    personal: true,
  });

  const toggleSource = (sourceKey, label) => {
    setSources((prev) => {
      const nextVal = !prev[sourceKey];
      const next = { ...prev, [sourceKey]: nextVal };
      toast.info(`${label} feed ${nextVal ? 'enabled' : 'hidden'}`);
      if (onCalendarToggle) onCalendarToggle(next);
      return next;
    });
  };

  const daysHeader = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const septDays = [
    { day: 30, currentMonth: false },
    { day: 31, currentMonth: false },
    { day: 1, currentMonth: true },
    { day: 2, currentMonth: true },
    { day: 3, currentMonth: true },
    { day: 4, currentMonth: true },
    { day: 5, currentMonth: true },
    { day: 6, currentMonth: true },
    { day: 7, currentMonth: true, isToday: true, hasEvent: true },
    { day: 8, currentMonth: true, hasEvent: true },
    { day: 9, currentMonth: true, hasEvent: true },
    { day: 10, currentMonth: true, hasEvent: true },
    { day: 11, currentMonth: true },
    { day: 12, currentMonth: true, hasEvent: true },
    { day: 13, currentMonth: true },
    { day: 14, currentMonth: true },
    { day: 15, currentMonth: true, hasEvent: true },
    { day: 16, currentMonth: true },
    { day: 17, currentMonth: true },
    { day: 18, currentMonth: true },
    { day: 19, currentMonth: true },
    { day: 20, currentMonth: true },
    { day: 21, currentMonth: true },
    { day: 22, currentMonth: true },
    { day: 23, currentMonth: true },
    { day: 24, currentMonth: true },
    { day: 25, currentMonth: true },
    { day: 26, currentMonth: true },
    { day: 27, currentMonth: true },
    { day: 28, currentMonth: true },
    { day: 29, currentMonth: true },
    { day: 30, currentMonth: true },
    { day: 1, currentMonth: false },
    { day: 2, currentMonth: false },
    { day: 3, currentMonth: false },
  ];

  const octDays = [
    { day: 27, currentMonth: false },
    { day: 28, currentMonth: false },
    { day: 29, currentMonth: false },
    { day: 30, currentMonth: false },
    { day: 1, currentMonth: true },
    { day: 2, currentMonth: true },
    { day: 3, currentMonth: true },
    { day: 4, currentMonth: true },
    { day: 5, currentMonth: true },
    { day: 6, currentMonth: true },
    { day: 7, currentMonth: true },
    { day: 8, currentMonth: true },
    { day: 9, currentMonth: true },
    { day: 10, currentMonth: true },
    { day: 11, currentMonth: true },
    { day: 12, currentMonth: true },
    { day: 13, currentMonth: true },
    { day: 14, currentMonth: true },
    { day: 15, currentMonth: true },
    { day: 16, currentMonth: true },
    { day: 17, currentMonth: true },
    { day: 18, currentMonth: true },
    { day: 19, currentMonth: true },
    { day: 20, currentMonth: true },
    { day: 21, currentMonth: true },
    { day: 22, currentMonth: true },
    { day: 23, currentMonth: true },
    { day: 24, currentMonth: true },
    { day: 25, currentMonth: true },
    { day: 26, currentMonth: true },
    { day: 27, currentMonth: true, hasEvent: true },
    { day: 28, currentMonth: true, hasEvent: true },
    { day: 29, currentMonth: true, hasEvent: true },
    { day: 30, currentMonth: true },
    { day: 31, currentMonth: true, hasEvent: true },
  ];

  const monthNames = ['September 2026', 'October 2026'];
  const calendarDays = currentMonthIndex === 0 ? septDays : octDays;

  const handleDayClick = (item) => {
    if (!item.currentMonth) return;
    setActiveDate(item.day);
    toast.info(`Selected ${monthNames[currentMonthIndex].split(' ')[0]} ${item.day}`);
    if (onDateSelect) onDateSelect(item);
  };

  const handleLookaheadClick = (taskObj) => {
    if (onTaskSelect) {
      onTaskSelect(taskObj);
    } else {
      toast.info(`Event: ${taskObj.title}`);
    }
  };

  return (
    <aside className="workspace-right-rail">
      {/* 1. Mini Calendar */}
      <div className="rail-widget">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span className="rail-widget-title" style={{ margin: 0 }}>{monthNames[currentMonthIndex]}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span
              style={{ fontSize: '0.74rem', color: '#6B7280', cursor: 'pointer', padding: '0 4px', userSelect: 'none' }}
              onClick={() => setCurrentMonthIndex((prev) => (prev === 0 ? 1 : 0))}
              title="Previous Month"
            >
              &lt;
            </span>
            <span
              style={{ fontSize: '0.74rem', color: '#6B7280', cursor: 'pointer', padding: '0 4px', userSelect: 'none' }}
              onClick={() => setCurrentMonthIndex((prev) => (prev === 0 ? 1 : 0))}
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
            const isSelected = activeDate === item.day && item.currentMonth;
            return (
              <div
                key={idx}
                className={`mini-cal-day ${isSelected ? 'active' : ''} ${item.hasEvent ? 'has-event' : ''}`}
                style={{
                  opacity: item.currentMonth ? 1 : 0.35,
                  color: item.isToday && !isSelected ? '#1B3B2E' : undefined,
                  fontWeight: item.isToday ? 800 : undefined,
                  cursor: item.currentMonth ? 'pointer' : 'default',
                }}
                onClick={() => handleDayClick(item)}
              >
                {item.day}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Next 48 Hours */}
      <div className="rail-widget">
        <span className="rail-widget-title">⚡ Next 48 Hours</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            className="lookahead-item"
            onClick={() =>
              handleLookaheadClick({
                id: 991,
                title: 'CS101 Term Paper Final',
                task: 'CS101 Term Paper Final',
                category: 'CS101',
                subject: 'CS101',
                urgency: 'high',
                priority_score: 92,
                deadline: 'Today, 5:00 PM',
                weightage: '35%',
                description: 'Final submission of literature survey, system model diagrams, and methodology comparison for CS101 grading.',
              })
            }
            style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}
            title="Click to inspect task"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="lookahead-title">CS101 Term Paper Final</span>
              <span className="pill-eyebrow coral">Due 5 PM</span>
            </div>
            <div className="lookahead-time">Today, 5:00 PM • 35% Weightage</div>
          </div>

          <div
            className="lookahead-item"
            onClick={() =>
              handleLookaheadClick({
                id: 992,
                title: 'Math 204 Midterm Prep',
                task: 'Math 204 Midterm Prep',
                category: 'Math 204',
                subject: 'Math 204',
                urgency: 'medium',
                priority_score: 65,
                deadline: 'Tomorrow, 10:00 AM',
                weightage: '20%',
                description: 'Spaced repetition problem set review: eigenvalues, linear transformations, and matrix rank theorems.',
              })
            }
            style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}
            title="Click to inspect task"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="lookahead-title">Math 204 Midterm Prep</span>
              <span className="pill-eyebrow green">Study Session</span>
            </div>
            <div className="lookahead-time">Tomorrow, 10:00 AM • Spaced Repetition</div>
          </div>

          <div
            className="lookahead-item"
            onClick={() =>
              handleLookaheadClick({
                id: 993,
                title: 'Product Strategy Sync',
                task: 'Product Strategy Sync',
                category: 'Design Pod',
                subject: 'Design Pod',
                urgency: 'medium',
                priority_score: 55,
                deadline: 'Tomorrow, 2:30 PM',
                weightage: 'Team',
                description: 'Cross-functional sync with 4 team members on sprint objectives, user testing results, and design milestones.',
              })
            }
            style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}
            title="Click to inspect task"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="lookahead-title">Product Strategy Sync</span>
              <span className="pill-eyebrow amber">Meeting</span>
            </div>
            <div className="lookahead-time">Tomorrow, 2:30 PM • 4 Attendees</div>
          </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="source-dot" style={{ background: '#2563EB' }} />
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Google Workspace</div>
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
