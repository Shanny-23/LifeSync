import { useState, useMemo, useRef, useEffect } from 'react';
import { startOfWeek, addDays, format, isSameDay } from 'date-fns';
import gsap, { prefersReducedMotion } from '../lib/gsap';

export default function WeekStrip({ onSelectDate, selectedDayNum }) {
  const today = useMemo(() => new Date(), []);
  const start = useMemo(() => startOfWeek(today, { weekStartsOn: 0 }), [today]);
  const containerRef = useRef(null);
  const indicatorRef = useRef(null);
  const dayRefs = useRef({});

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

  // Animate sliding indicator between days
  useEffect(() => {
    const activeEl = dayRefs.current[selectedDay];
    if (!activeEl || !indicatorRef.current || !containerRef.current) return;

    if (prefersReducedMotion()) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      indicatorRef.current.style.transform = `translateX(${activeRect.left - containerRect.left}px)`;
      indicatorRef.current.style.width = `${activeRect.width}px`;
      return;
    }

    const ctx = gsap.context(() => {
      const containerRect = containerRef.current.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const targetX = activeRect.left - containerRect.left;

      gsap.to(indicatorRef.current, {
        x: targetX,
        width: activeRect.width,
        duration: 0.24,
        ease: 'power2.out',
      });
    }, containerRef);

    return () => ctx.revert();
  }, [selectedDay]);

  return (
    <div className="week-strip-card">
      <div className="week-strip-header">
        <span className="week-strip-title">Weekly Schedule</span>
        <span style={{ fontSize: '0.74rem', color: '#6B7280' }}>{weekRangeLabel}</span>
      </div>

      <div className="week-strip-days" ref={containerRef} style={{ position: 'relative' }}>
        {/* Animated sliding indicator */}
        <div
          ref={indicatorRef}
          style={{
            position: 'absolute',
            top: '0',
            bottom: '0',
            left: 0,
            width: '40px',
            background: 'rgba(27, 59, 46, 0.08)',
            border: '1.5px solid #1B3B2E',
            borderRadius: '8px',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {days.map((day) => {
          return (
            <div
              key={day.fullDate}
              ref={(el) => (dayRefs.current[day.num] = el)}
              className={`week-day-pill ${day.isToday ? 'today' : ''}`}
              style={{
                position: 'relative',
                zIndex: 1,
                cursor: 'pointer',
                background: 'transparent',
              }}
              onClick={() => handleDayClick(day)}
              title={`${day.name}, ${day.label}`}
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
