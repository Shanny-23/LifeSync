import React from 'react';

export default function ReadinessGauge({
  score = 73,
  title = "Academic Readiness",
  subtitle = "Based on syllabus mastery & deadline proximity",
  stats = [
    { label: "Syllabus", value: "85%" },
    { label: "Review Streak", value: "5 Days" },
    { label: "Conflict Free", value: "94%" }
  ]
}) {
  // Semi-circle SVG coordinates (radius 75, center 90, 85)
  const radius = 70;
  const circumference = Math.PI * radius;
  const progressOffset = circumference - (score / 100) * circumference;

  return (
    <div className="readiness-gauge-card">
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#14382A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title}
        </span>
        <span className="pill-eyebrow green" style={{ fontSize: '0.65rem' }}>
          Optimal Pace
        </span>
      </div>

      {/* SVG Semi-Circle Arch Gauge */}
      <div style={{ position: 'relative', width: '180px', height: '100px', display: 'flex', justifyContent: 'center' }}>
        <svg width="180" height="100" viewBox="0 0 180 100">
          <defs>
            <linearGradient id="readinessGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#D97706" />
              <stop offset="50%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#14382A" />
            </linearGradient>
          </defs>

          {/* Background Track Arch */}
          <path
            d="M 20 90 A 70 70 0 0 1 160 90"
            fill="none"
            stroke="#F1F5F9"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* Dynamic Value Arch */}
          <path
            d="M 20 90 A 70 70 0 0 1 160 90"
            fill="none"
            stroke="url(#readinessGradient)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={progressOffset}
            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
          />
        </svg>

        {/* Center Percentage Display */}
        <div style={{
          position: 'absolute',
          bottom: '2px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#14382A', lineHeight: 1 }}>
            {score}%
          </span>
          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748B', marginTop: '2px' }}>
            ON TRACK
          </span>
        </div>
      </div>

      <p style={{ fontSize: '0.74rem', color: '#64748B', textAlign: 'center', marginTop: '8px', maxWidth: '240px' }}>
        {subtitle}
      </p>

      {/* Sub-metrics from Screen 3 in Figma */}
      <div className="readiness-substats-row">
        {stats.map((item, idx) => (
          <div key={idx} className="readiness-substat-item">
            <span className="readiness-substat-val">{item.value}</span>
            <span className="readiness-substat-lbl">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
