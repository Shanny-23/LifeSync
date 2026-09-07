import { useState, useMemo } from 'react';
import { startOfWeek, addDays, format, isSameDay } from 'date-fns';

export default function WeekStrip({ onSelectDate, selectedDayNum }) {
  const today = useMemo(() => new Date(), []);
  const start = useMemo(() => startOfWeek(today, { weekStartsOn: 0 }), [today]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      const isToday = isSameDay(d, today);
      return {
        date: d,
        name: format(d, 'EEE'),
        num: d.getDate(),
        fullDate: format(d, 'yyyy-MM-dd'),
        label: format(d, 'MMM d'),
        isToday,
        hasEvent: [1, 3, 4, 6].includes(i),
      };
    });
  }, [start, today]);

  const [selectedDay, setSelectedDay] = useState(() => {
    return selectedDayNum !== undefined ? selectedDayNum : today.getDate();
  });

  const weekRangeLabel = useMemo(() => {
    const end = addDays(start, 6);
    return `${format(start, 'MMMM d')} – ${format(end, 'MMMM d, yyyy')}`;
  }, [start]);

  const handleDayClick = (day) => {
    setSelectedDay(day.num);
    if (onSelectDate) onSelectDate(day);
  };

  return (
    <div className="week-strip-card">
      <div className="week-strip-header">
        <span className="week-strip-title">Weekly Schedule</span>
        <span style={{ fontSize: '0.74rem', color: '#6B7280' }}>{weekRangeLabel}</span>
      </div>

      <div className="week-strip-days">
        {days.map((day) => {
          const isSelected = selectedDay === day.num;
          return (
            <div
              key={day.fullDate}
              className={`week-day-pill ${isSelected ? 'selected' : ''} ${day.isToday ? 'today' : ''}`}
              onClick={() => handleDayClick(day)}
              title={`${day.name}, ${day.label}`}
              role="button"
              tabIndex={0}
            >
              <span className="day-name">{day.name}</span>
              <span className="day-num">{day.num}</span>
              {day.hasEvent && <span className="day-dot" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
