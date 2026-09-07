import { useState } from 'react';

export default function WeekStrip({ onSelectDate }) {
  const [selectedDay, setSelectedDay] = useState(28);

  const days = [
    { name: 'Sun', num: 25, hasEvent: false },
    { name: 'Mon', num: 26, hasEvent: true },
    { name: 'Tue', num: 27, hasEvent: false },
    { name: 'Wed', num: 28, hasEvent: true, isToday: true },
    { name: 'Thu', num: 29, hasEvent: true },
    { name: 'Fri', num: 30, hasEvent: false },
    { name: 'Sat', num: 31, hasEvent: true },
  ];

  return (
    <div className="week-strip-card">
      <div className="week-strip-header">
        <span className="week-strip-title">Weekly Schedule</span>
        <span style={{ fontSize: '0.74rem', color: '#6B7280' }}>October 25 – October 31, 2026</span>
      </div>

      <div className="week-strip-days">
        {days.map((day) => {
          const isSelected = selectedDay === day.num;
          return (
            <div
              key={day.num}
              className={`week-day-pill ${day.isToday ? 'today' : ''}`}
              style={{
                border: isSelected && !day.isToday ? '1.5px solid #1B3B2E' : undefined,
                background: isSelected && !day.isToday ? '#E7F0EA' : undefined,
              }}
              onClick={() => {
                setSelectedDay(day.num);
                if (onSelectDate) onSelectDate(day);
              }}
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
