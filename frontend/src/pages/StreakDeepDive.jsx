import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

export default function StreakDeepDive() {
  const navigate = useNavigate();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('month'); // 'month' | 'all'
  const [selectedDay, setSelectedDay] = useState(null);

  // 14-day history data matching Image 3
  const historyLogs = [
    {
      date: 'Today — Sep 8',
      dayOfWeek: 'Tuesday',
      isToday: true,
      focusHours: '3h 45m',
      habitsCompleted: '5/5',
      habitRatio: 1.0,
      milestones: ['CS101 Literature Review', 'Morning Yoga'],
      status: 'Active',
      statusType: 'active',
      statusIcon: '🔥',
    },
    {
      date: 'Yesterday — Sep 7',
      dayOfWeek: 'Monday',
      focusHours: '4h 10m',
      habitsCompleted: '5/5',
      habitRatio: 1.0,
      milestones: ['Math 204 Problem Set', '10k Steps'],
      status: 'Active',
      statusType: 'active',
      statusIcon: '🔥',
    },
    {
      date: 'Sep 6',
      dayOfWeek: 'Sunday',
      focusHours: '1h 15m',
      habitsCompleted: '3/5',
      habitRatio: 0.6,
      milestones: ['Family Rest & Mobility'],
      status: 'Rest Day',
      statusType: 'rest',
      statusIcon: '🍃',
    },
    {
      date: 'Sep 5',
      dayOfWeek: 'Saturday',
      focusHours: '3h 45m',
      habitsCompleted: '5/5',
      habitRatio: 1.0,
      milestones: ['Algorithm Mock Interview', 'Deep Reading'],
      status: 'Active',
      statusType: 'active',
      statusIcon: '🔥',
    },
    {
      date: 'Sep 4',
      dayOfWeek: 'Friday',
      focusHours: '5h 05m',
      habitsCompleted: '5/5',
      habitRatio: 1.0,
      milestones: ['Weekly Review Summit', '5-Hour Focus Block'],
      status: 'Milestone',
      statusType: 'milestone',
      statusIcon: '✨',
    },
    {
      date: 'Sep 3',
      dayOfWeek: 'Thursday',
      focusHours: '2h 30m',
      habitsCompleted: '4/5',
      habitRatio: 0.8,
      milestones: ['Database Schema Review'],
      status: 'Active',
      statusType: 'active',
      statusIcon: '🔥',
    },
    {
      date: 'Sep 2',
      dayOfWeek: 'Wednesday',
      focusHours: '4h 15m',
      habitsCompleted: '5/5',
      habitRatio: 1.0,
      milestones: ['Linear Algebra Quiz', 'Yoga Routine'],
      status: 'Active',
      statusType: 'active',
      statusIcon: '🔥',
    },
    {
      date: 'Sep 1',
      dayOfWeek: 'Tuesday',
      focusHours: '3h 20m',
      habitsCompleted: '5/5',
      habitRatio: 1.0,
      milestones: ['Monthly Goal Plan'],
      status: 'Active',
      statusType: 'active',
      statusIcon: '🔥',
    },
    {
      date: 'Aug 31',
      dayOfWeek: 'Monday',
      focusHours: '4h 45m',
      habitsCompleted: '5/5',
      habitRatio: 1.0,
      milestones: ['Research Paper Final Draft'],
      status: 'Milestone',
      statusType: 'milestone',
      statusIcon: '✨',
    },
    {
      date: 'Aug 30',
      dayOfWeek: 'Sunday',
      focusHours: '4h 20m',
      habitsCompleted: '5/5',
      habitRatio: 1.0,
      milestones: ['Literature Review Intro'],
      status: 'Active',
      statusType: 'active',
      statusIcon: '🔥',
    },
    {
      date: 'Aug 29',
      dayOfWeek: 'Saturday',
      focusHours: '3h 50m',
      habitsCompleted: '5/5',
      habitRatio: 1.0,
      milestones: ['Morning Run & Meditate'],
      status: 'Active',
      statusType: 'active',
      statusIcon: '🔥',
    },
    {
      date: 'Aug 28',
      dayOfWeek: 'Friday',
      focusHours: '5h 10m',
      habitsCompleted: '5/5',
      habitRatio: 1.0,
      milestones: ['Full Hackathon Sprint'],
      status: 'Active',
      statusType: 'active',
      statusIcon: '🔥',
    },
    {
      date: 'Aug 27',
      dayOfWeek: 'Thursday',
      focusHours: '4h 30m',
      habitsCompleted: '5/5',
      habitRatio: 1.0,
      milestones: ['System Design Chapter 4'],
      status: 'Active',
      statusType: 'active',
      statusIcon: '🔥',
    },
    {
      date: 'Aug 26',
      dayOfWeek: 'Wednesday',
      focusHours: '4h 00m',
      habitsCompleted: '5/5',
      habitRatio: 1.0,
      milestones: ['Reading 45 Pages'],
      status: 'Active',
      statusType: 'active',
      statusIcon: '🔥',
    },
  ];

  // Calendar Heatmap Days for September 2026
  const heatmapDays = [
    // Week 1
    { day: 30, month: 'Aug', label: 'Rest', type: 'rest', hours: '0h', text: 'Rest' },
    { day: 31, month: 'Aug', label: '4h 45m', type: 'high', hours: '4h 45m', text: '4h 45m' },
    { day: 1, month: 'Sep', label: '3h 20m', type: 'med', hours: '3h 20m', text: '3h 20m' },
    { day: 2, month: 'Sep', label: '4h 16m', type: 'high', hours: '4h 16m', text: '4h 16m' },
    { day: 3, month: 'Sep', label: '1h 50m', type: 'low', hours: '1h 50m', text: '1h 50m' },
    { day: 4, month: 'Sep', label: '5h 05m', type: 'high', hours: '5h 05m', text: '5h 05m' },
    { day: 5, month: 'Sep', label: '3h 45m', type: 'med', hours: '3h 45m', text: '3h 45m' },

    // Week 2
    { day: 6, month: 'Sep', label: '🛡 Shield', type: 'shield', hours: '1h 15m', text: '🛡 Shield' },
    { day: 7, month: 'Sep', label: '4h 10m', type: 'high', hours: '4h 10m', text: '4h 10m' },
    { day: 8, month: 'Sep', label: '3h 45m 🔥', type: 'today', hours: '3h 45m', text: '3h 45m 🔥', isToday: true },
    { day: 9, month: 'Sep', label: '—', type: 'future', text: '—' },
    { day: 10, month: 'Sep', label: '—', type: 'future', text: '—' },
    { day: 11, month: 'Sep', label: '—', type: 'future', text: '—' },
    { day: 12, month: 'Sep', label: '—', type: 'future', text: '—' },

    // Week 3
    { day: 13, month: 'Sep', label: '—', type: 'future', text: '—' },
    { day: 14, month: 'Sep', label: '—', type: 'future', text: '—' },
    { day: 15, month: 'Sep', label: '—', type: 'future', text: '—' },
    { day: 16, month: 'Sep', label: '—', type: 'future', text: '—' },
    { day: 17, month: 'Sep', label: '—', type: 'future', text: '—' },
    { day: 18, month: 'Sep', label: '—', type: 'future', text: '—' },
    { day: 19, month: 'Sep', label: '—', type: 'future', text: '—' },

    // Week 4
    { day: 20, month: 'Sep', label: '—', type: 'future', text: '—' },
    { day: 21, month: 'Sep', label: '—', type: 'future', text: '—' },
    { day: 22, month: 'Sep', label: '—', type: 'future', text: '—' },
    { day: 23, month: 'Sep', label: '—', type: 'future', text: '—' },
    { day: 24, month: 'Sep', label: '—', type: 'future', text: '—' },
    { day: 25, month: 'Sep', label: '—', type: 'future', text: '—' },
    { day: 26, month: 'Sep', label: '—', type: 'future', text: '—' },

    // Week 5
    { day: 27, month: 'Sep', label: '—', type: 'future', text: '—' },
    { day: 28, month: 'Sep', label: '—', type: 'future', text: '—' },
    { day: 29, month: 'Sep', label: '—', type: 'future', text: '—' },
    { day: 30, month: 'Sep', label: '—', type: 'future', text: '—' },
  ];

  const handleExport = () => {
    const headers = ['Date', 'Day', 'Focus_Hours', 'Habits_Completed', 'Milestones', 'Status'];
    const rows = historyLogs.map(log => [
      `"${log.date}"`,
      `"${log.dayOfWeek}"`,
      `"${log.focusHours}"`,
      `"${log.habitsCompleted}"`,
      `"${log.milestones.join('; ')}"`,
      `"${log.status}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'lifesync_streak_log_sep2026.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Streak Log exported successfully as CSV!');
  };

  return (
    <div className="deepdive-container">
      {/* Top Breadcrumb and Header Row */}
      <div className="deepdive-header-row streak-seq-1">
        <div>
          <div className="deepdive-breadcrumbs">
            <Link to="/dashboard" className="deepdive-crumb-link">
              Dashboard
            </Link>
            <span className="deepdive-crumb-sep">/</span>
            <span className="deepdive-crumb-active">Streak Details & History</span>
          </div>
          <div className="deepdive-title-wrap">
            <h1 className="deepdive-title">Study & Habit Streak Deep Dive</h1>
            <span className="deepdive-onfire-badge">🔥 ON FIRE</span>
          </div>
        </div>

        <div className="deepdive-actions">
          <div className="deepdive-segmented-control">
            <button
              type="button"
              className={`deepdive-seg-btn ${activeTab === 'month' ? 'active' : ''}`}
              onClick={() => setActiveTab('month')}
            >
              Current Month: Sep 2026
            </button>
            <button
              type="button"
              className={`deepdive-seg-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All Time
            </button>
          </div>

          <button
            type="button"
            className="deepdive-export-btn"
            onClick={handleExport}
          >
            <span>📥</span>
            <span>Export Streak Log</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="deepdive-stats-grid">
        {/* Card 1: Current Streak */}
        <div className="deepdive-stat-card current-streak-card streak-seq-2">
          <div className="deepdive-card-header">
            <span className="deepdive-card-label">CURRENT STREAK</span>
            <span className="deepdive-card-icon-flame">🔥</span>
          </div>
          <div className="deepdive-card-main">
            <span className="deepdive-card-number">5</span>
            <span className="deepdive-card-unit">Days Active</span>
          </div>
          <div className="deepdive-card-footer-row">
            <div className="deepdive-logged-pill">
              <span className="deepdive-dot-yellow">●</span>
              <span>Logged today at 2:45 PM</span>
            </div>
            <span className="deepdive-active-pill">ACTIVE</span>
          </div>
        </div>

        {/* Card 2: Longest Streak Record */}
        <div className="deepdive-stat-card streak-seq-3">
          <div className="deepdive-card-header">
            <span className="deepdive-card-label">LONGEST STREAK RECORD</span>
            <div className="deepdive-trophy-badge">🏆</div>
          </div>
          <div className="deepdive-card-main">
            <span className="deepdive-card-number">21</span>
            <span className="deepdive-card-unit">Days</span>
          </div>
          <div className="deepdive-card-footer-row">
            <span className="deepdive-footer-text">Achieved August 2026</span>
            <span className="deepdive-sub-pill">Personal Best</span>
          </div>
        </div>

        {/* Card 3: Habit Consistency */}
        <div className="deepdive-stat-card streak-seq-4">
          <div className="deepdive-card-header">
            <span className="deepdive-card-label">HABIT CONSISTENCY</span>
            <div className="deepdive-trend-badge">↗</div>
          </div>
          <div className="deepdive-card-main">
            <span className="deepdive-card-number">94.2%</span>
          </div>
          <div className="deepdive-card-footer-row">
            <span className="deepdive-footer-green">↑+3.4% vs. last month</span>
          </div>
        </div>

        {/* Card 4: Habit Shield Status */}
        <div className="deepdive-stat-card streak-seq-5">
          <div className="deepdive-card-header">
            <span className="deepdive-card-label">HABIT SHIELD STATUS</span>
            <div className="deepdive-shield-badge">❄️</div>
          </div>
          <div className="deepdive-card-main">
            <span className="deepdive-card-number">1</span>
            <span className="deepdive-card-unit">Protected</span>
          </div>
          <div className="deepdive-card-footer-row">
            <span className="deepdive-footer-text">Streak Freeze active</span>
            <span className="deepdive-auto-pill">Auto-Equipped</span>
          </div>
        </div>
      </div>

      {/* Daily Momentum Heatmap Panel */}
      <div className="deepdive-heatmap-panel streak-seq-6">
        <div className="deepdive-heatmap-header">
          <div className="deepdive-heatmap-title">
            <span>📅</span>
            <span>Daily Momentum Heatmap — September 2026</span>
          </div>

          <div className="deepdive-heatmap-legend">
            <span className="legend-label">Focus Intensity:</span>
            <div className="legend-item">
              <span className="legend-chip rest"></span>
              <span>Rest</span>
            </div>
            <div className="legend-item">
              <span className="legend-chip low"></span>
              <span>&lt;2h</span>
            </div>
            <div className="legend-item">
              <span className="legend-chip med"></span>
              <span>2-4h</span>
            </div>
            <div className="legend-item">
              <span className="legend-chip high"></span>
              <span>&gt;4h</span>
            </div>
            <div className="legend-item">
              <span className="legend-chip shield"></span>
              <span>Shield</span>
            </div>
          </div>
        </div>

        {/* Calendar Heatmap Grid */}
        <div className="heatmap-grid">
          {/* Day column headers */}
          <div className="heatmap-header-cell">SUN</div>
          <div className="heatmap-header-cell">MON</div>
          <div className="heatmap-header-cell">TUE</div>
          <div className="heatmap-header-cell">WED</div>
          <div className="heatmap-header-cell">THU</div>
          <div className="heatmap-header-cell">FRI</div>
          <div className="heatmap-header-cell">SAT</div>

          {/* Calendar day cells */}
          {heatmapDays.map((cell, idx) => (
            <div
              key={idx}
              className={`heatmap-cell ${cell.type} ${cell.isToday ? 'cell-today' : ''} ${selectedDay === cell.day ? 'cell-selected' : ''}`}
              onClick={() => {
                setSelectedDay(cell.day);
                if (cell.hours) {
                  toast.info(`${cell.month} ${cell.day}: Logged ${cell.hours} focus session`);
                }
              }}
              title={`${cell.month || 'Sep'} ${cell.day}: ${cell.text || cell.hours || 'Upcoming'}`}
            >
              <div className="heatmap-cell-day-num">
                {cell.isToday ? '8 TODAY' : cell.day}
              </div>
              <div className="heatmap-cell-content">
                {cell.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 14-Day Log & Habit Performance Table */}
      <div className="deepdive-table-panel streak-seq-7">
        <div className="deepdive-table-header">
          <div>
            <h2 className="deepdive-table-title">14-Day Log & Habit Performance</h2>
            <p className="deepdive-table-sub">
              Granular audit of active focus hours, routine completions, and recorded milestones.
            </p>
          </div>
          <div className="deepdive-table-filter">
            <span>Showing Last 14 Recorded Days</span>
          </div>
        </div>

        <div className="deepdive-table-scroll">
          <table className="deepdive-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>DAILY FOCUS</th>
                <th>HABITS COMPLETED</th>
                <th>KEY MILESTONES LOGGED</th>
                <th>STREAK STATUS</th>
              </tr>
            </thead>
            <tbody>
              {historyLogs.map((row, index) => (
                <tr key={index} className={row.isToday ? 'row-today' : ''}>
                  <td className="col-date">
                    <div className="date-display">
                      {row.isToday && <span className="today-dot">●</span>}
                      <span className="date-title">{row.date}</span>
                    </div>
                    <span className="date-sub">{row.dayOfWeek}</span>
                  </td>
                  <td className="col-focus">
                    <strong>{row.focusHours}</strong>
                  </td>
                  <td className="col-habits">
                    <div className="habit-progress-wrap">
                      <span className="habit-fraction">{row.habitsCompleted}</span>
                      <div className="habit-bar-track">
                        <div
                          className={`habit-bar-fill ${row.habitRatio < 0.8 ? 'warning' : 'success'}`}
                          style={{ width: `${row.habitRatio * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="col-milestones">
                    <div className="milestones-chip-wrap">
                      {row.milestones.map((m, mIdx) => (
                        <span key={mIdx} className="milestone-chip">
                          {m}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="col-status">
                    <span className={`status-pill ${row.statusType}`}>
                      <span>{row.statusIcon}</span>
                      <span>{row.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Week-by-Week Momentum & Focus Distribution Grid */}
      <div className="deepdive-bottom-grid">
        {/* Left: Week-by-Week Momentum */}
        <div className="deepdive-weeks-panel streak-seq-8">
          <div className="deepdive-weeks-header">
            <div>
              <h2 className="deepdive-weeks-title">Week-by-Week Momentum & Consistency</h2>
              <p className="deepdive-weeks-sub">
                Continuous weekly tracking against 25-hour baseline focus target.
              </p>
            </div>
            <span className="q3-trending-badge">Q3 TRENDING</span>
          </div>

          <div className="weeks-card-grid">
            {/* Week 36 (Current) */}
            <div className="week-card active-week">
              <div className="week-card-top">
                <div className="week-card-title-wrap">
                  <span className="week-title">Week 36</span>
                  <span className="week-tag-current">CURRENT</span>
                </div>
                <span className="week-status-badge active">🔥 Active</span>
              </div>
              <div className="week-date-range">Sep 1 — Sep 7, 2026</div>

              <div className="week-stats-row">
                <div className="week-stat-item">
                  <div className="week-stat-val">28.5h</div>
                  <div className="week-stat-label">FOCUS</div>
                </div>
                <div className="week-stat-item">
                  <div className="week-stat-val">5/7</div>
                  <div className="week-stat-label">ACTIVE DAYS</div>
                </div>
                <div className="week-stat-item">
                  <div className="week-stat-val">96%</div>
                  <div className="week-stat-label">ADHERENCE</div>
                </div>
              </div>
              <div className="week-card-bottom">
                <span className="week-maintained-text">Status: Streak Maintained 🔥</span>
              </div>
            </div>

            {/* Week 35 */}
            <div className="week-card">
              <div className="week-card-top">
                <span className="week-title">Week 35</span>
                <span className="week-status-badge perfect">⭐ Perfect</span>
              </div>
              <div className="week-date-range">Aug 25 — Aug 31, 2026</div>

              <div className="week-stats-row">
                <div className="week-stat-item">
                  <div className="week-stat-val">31.0h</div>
                  <div className="week-stat-label">FOCUS</div>
                </div>
                <div className="week-stat-item">
                  <div className="week-stat-val">7/7</div>
                  <div className="week-stat-label">ACTIVE DAYS</div>
                </div>
                <div className="week-stat-item">
                  <div className="week-stat-val">100%</div>
                  <div className="week-stat-label">ADHERENCE</div>
                </div>
              </div>
              <div className="week-card-bottom">
                <span className="week-perfect-text">Status: Perfect Week ⭐</span>
              </div>
            </div>

            {/* Week 34 */}
            <div className="week-card">
              <div className="week-card-top">
                <span className="week-title">Week 34</span>
                <span className="week-status-badge maintained">🛡 Maintained</span>
              </div>
              <div className="week-date-range">Aug 18 — Aug 24, 2026</div>

              <div className="week-stats-row">
                <div className="week-stat-item">
                  <div className="week-stat-val">24.2h</div>
                  <div className="week-stat-label">FOCUS</div>
                </div>
                <div className="week-stat-item">
                  <div className="week-stat-val">6/7</div>
                  <div className="week-stat-label">ACTIVE DAYS</div>
                </div>
                <div className="week-stat-item">
                  <div className="week-stat-val">88%</div>
                  <div className="week-stat-label">ADHERENCE</div>
                </div>
              </div>
              <div className="week-card-bottom">
                <span className="week-maintained-text">Status: Streak Maintained 🔥</span>
              </div>
            </div>

            {/* Week 33 */}
            <div className="week-card">
              <div className="week-card-top">
                <span className="week-title">Week 33</span>
                <span className="week-status-badge freeze">❄️ Freeze</span>
              </div>
              <div className="week-date-range">Aug 11 — Aug 17, 2026</div>

              <div className="week-stats-row">
                <div className="week-stat-item">
                  <div className="week-stat-val">19.5h</div>
                  <div className="week-stat-label">FOCUS</div>
                </div>
                <div className="week-stat-item">
                  <div className="week-stat-val">4/7</div>
                  <div className="week-stat-label">ACTIVE DAYS</div>
                </div>
                <div className="week-stat-item">
                  <div className="week-stat-val">75%</div>
                  <div className="week-stat-label">ADHERENCE</div>
                </div>
              </div>
              <div className="week-card-bottom">
                <span className="week-freeze-text">Status: 1 Freeze Used ❄️</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Weekly Category Split Focus Distribution */}
        <div className="deepdive-distribution-panel streak-seq-9">
          <div className="dist-category-eyebrow">WEEKLY CATEGORY SPLIT</div>
          <h3 className="dist-title">Focus Distribution</h3>
          <div className="dist-total-hours">28.5 Total Recorded Hours this week</div>

          {/* Segmented Bar */}
          <div className="dist-segmented-bar">
            <div className="dist-bar-seg academic" style={{ width: '52%' }} title="Academic Studies: 52%" />
            <div className="dist-bar-seg deepwork" style={{ width: '28%' }} title="Deep Work: 28%" />
            <div className="dist-bar-seg wellness" style={{ width: '20%' }} title="Routine Habits: 20%" />
          </div>

          {/* Legend Details */}
          <div className="dist-items-list">
            <div className="dist-item-row">
              <div className="dist-item-left">
                <span className="dist-dot academic">●</span>
                <span className="dist-item-name">Academic Studies</span>
              </div>
              <div className="dist-item-right">
                <span className="dist-item-hours">14.8 hrs</span>
                <span className="dist-item-pct">(52%)</span>
              </div>
            </div>

            <div className="dist-item-row">
              <div className="dist-item-left">
                <span className="dist-dot deepwork">●</span>
                <span className="dist-item-name">Deep Work Sessions</span>
              </div>
              <div className="dist-item-right">
                <span className="dist-item-hours">8.0 hrs</span>
                <span className="dist-item-pct">(28%)</span>
              </div>
            </div>

            <div className="dist-item-row">
              <div className="dist-item-left">
                <span className="dist-dot wellness">●</span>
                <span className="dist-item-name">Routine Habits & Wellness</span>
              </div>
              <div className="dist-item-right">
                <span className="dist-item-hours">5.7 hrs</span>
                <span className="dist-item-pct">(20%)</span>
              </div>
            </div>
          </div>

          {/* Momentum Insight Callout */}
          <div className="dist-insight-card">
            <div className="dist-insight-icon">💡</div>
            <div>
              <div className="dist-insight-title">Momentum Insight</div>
              <div className="dist-insight-body">
                Morning blocks before 11:00 AM show an <strong>82% higher completion rate</strong> than evening shifts.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Next Target Reward & Achievements Footer */}
      <div className="deepdive-footer-banner streak-seq-10">
        {/* Left: Next Target Reward */}
        <div className="reward-col">
          <div className="reward-eyebrow">
            <span className="reward-dot">●</span>
            <span>NEXT TARGET REWARD</span>
          </div>
          <div className="reward-title-row">
            <h3 className="reward-title">7-Day Consistency Badge</h3>
            <span className="reward-days-away">(2 days away!)</span>
          </div>
          <p className="reward-sub">
            Log at least 3h focused study tomorrow and Thursday to claim.
          </p>
          <div className="reward-progress-wrap">
            <div className="reward-progress-track">
              <div className="reward-progress-fill" style={{ width: '71%' }} />
            </div>
            <div className="reward-progress-label">
              <span>Current Progress: 5 / 7 Days</span>
              <span className="pct-val">71%</span>
            </div>
          </div>
        </div>

        {/* Center: Unlocked Achievements */}
        <div className="achievements-col">
          <div className="achievements-label">UNLOCKED ACHIEVEMENTS</div>
          <div className="achievements-chips">
            <div className="achievement-badge-card">
              <span className="badge-icon">🛡️</span>
              <div>
                <div className="badge-name">First Week Master</div>
                <div className="badge-sub">Aug 2026</div>
              </div>
            </div>

            <div className="achievement-badge-card">
              <span className="badge-icon">🌙</span>
              <div>
                <div className="badge-name">Night Owl Focus</div>
                <div className="badge-sub">&gt;20 Late Sessions</div>
              </div>
            </div>

            <div className="achievement-badge-card">
              <span className="badge-icon">🧘</span>
              <div>
                <div className="badge-name">100% Morning Yoga</div>
                <div className="badge-sub">14d Sequence</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Back to Dashboard button */}
        <div className="back-btn-col">
          <button
            type="button"
            className="btn-back-dashboard"
            onClick={() => navigate('/dashboard')}
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
}
