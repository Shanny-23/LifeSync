import React, { useState } from 'react';

const WEEK_DATA = [
  { day: 'Mon', studyHours: 3.5, reviewHours: 1.5 },
  { day: 'Tue', studyHours: 4.0, reviewHours: 2.0 },
  { day: 'Wed', studyHours: 5.5, reviewHours: 2.5 },
  { day: 'Thu', studyHours: 3.0, reviewHours: 1.0 },
  { day: 'Fri', studyHours: 6.0, reviewHours: 3.0 },
  { day: 'Sat', studyHours: 4.5, reviewHours: 2.0 },
  { day: 'Sun', studyHours: 2.0, reviewHours: 1.5 },
];

export default function WeeklyStudyChart({ data = WEEK_DATA }) {
  const [activeDay, setActiveDay] = useState(null);

  // Maximum value for chart scaling (e.g. 7 hours)
  const maxHours = 7.0;

  const totalStudy = data.reduce((acc, curr) => acc + curr.studyHours, 0);
  const totalReview = data.reduce((acc, curr) => acc + curr.reviewHours, 0);

  return (
    <div className="weekly-study-chart-card">
      <div className="weekly-chart-header">
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#14382A' }}>
            Weekly Focus Breakdown
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>
            Total: <strong>{(totalStudy + totalReview).toFixed(1)}h</strong> ({(totalStudy).toFixed(1)}h study + {(totalReview).toFixed(1)}h revision)
          </div>
        </div>

        {/* Legend */}
        <div className="weekly-chart-legend">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="legend-dot green" />
            <span style={{ color: '#14382A' }}>Deep Work</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="legend-dot amber" />
            <span style={{ color: '#D97706' }}>Revision</span>
          </div>
        </div>
      </div>

      {/* Dual Bar Chart */}
      <div className="weekly-bars-container">
        {data.map((item, idx) => {
          const studyHeight = Math.min(100, (item.studyHours / maxHours) * 100);
          const reviewHeight = Math.min(100, (item.reviewHours / maxHours) * 100);
          const isSelected = activeDay === item.day;

          return (
            <div
              key={idx}
              className="weekly-bar-group"
              onMouseEnter={() => setActiveDay(item.day)}
              onMouseLeave={() => setActiveDay(null)}
              style={{ cursor: 'pointer' }}
            >
              <div className="weekly-bar-pair">
                {/* Forest Green Bar */}
                <div
                  className="weekly-bar study"
                  style={{
                    height: `${studyHeight}%`,
                    opacity: isSelected ? 1 : 0.88,
                    filter: isSelected ? 'drop-shadow(0 2px 6px rgba(20,56,42,0.4))' : 'none'
                  }}
                  title={`${item.day} Deep Work: ${item.studyHours}h`}
                />
                {/* Amber Review Bar */}
                <div
                  className="weekly-bar review"
                  style={{
                    height: `${reviewHeight}%`,
                    opacity: isSelected ? 1 : 0.88,
                    filter: isSelected ? 'drop-shadow(0 2px 6px rgba(217,119,6,0.4))' : 'none'
                  }}
                  title={`${item.day} Revision: ${item.reviewHours}h`}
                />
              </div>

              <span
                className="weekly-day-label"
                style={{
                  color: isSelected ? '#14382A' : '#64748B',
                  fontWeight: isSelected ? 800 : 600
                }}
              >
                {item.day}
              </span>
            </div>
          );
        })}
      </div>

      {/* Dynamic Hover Tooltip / Detail */}
      <div style={{
        marginTop: '10px',
        fontSize: '0.72rem',
        color: '#475569',
        textAlign: 'center',
        minHeight: '18px'
      }}>
        {activeDay ? (
          (() => {
            const current = data.find((d) => d.day === activeDay);
            return (
              <span>
                <strong>{current.day}</strong>: {current.studyHours}h Deep Focus + {current.reviewHours}h Spaced Review ({current.studyHours + current.reviewHours}h Total)
              </span>
            );
          })()
        ) : (
          <span style={{ color: '#94A3B8' }}>Hover any day to inspect allocated study vs review hours</span>
        )}
      </div>
    </div>
  );
}
