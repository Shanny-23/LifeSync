import React, { useState, useEffect } from 'react';
import ReadinessGauge from './ReadinessGauge';
import WeeklyStudyChart from './WeeklyStudyChart';
import StickyFocusPlayer from './StickyFocusPlayer';
import { useToast } from '../context/ToastContext';

export default function FigmaAppShell({
  initialScreen = 1,
  onOpenUpload,
  onOpenTaskModal,
}) {
  const toast = useToast();
  const [activeScreen, setActiveScreen] = useState(initialScreen);
  const [selectedDayNum, setSelectedDayNum] = useState(28); // Wednesday 28th
  const [currentTime, setCurrentTime] = useState('9:41');
  const [habitChecked, setHabitChecked] = useState(false);
  const [collisionResolved, setCollisionResolved] = useState(false);

  // Update status bar time
  useEffect(() => {
    const updateClock = () => {
      const d = new Date();
      const h = d.getHours();
      const m = d.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${h}:${m}`);
    };
    updateClock();
    const timer = setInterval(updateClock, 30000);
    return () => clearInterval(timer);
  }, []);

  const weekDays = [
    { name: 'Sun', num: 25, hasDot: false },
    { name: 'Mon', num: 26, hasDot: true },
    { name: 'Tue', num: 27, hasDot: false },
    { name: 'Wed', num: 28, hasDot: true, isToday: true },
    { name: 'Thu', num: 29, hasDot: true },
    { name: 'Fri', num: 30, hasDot: false },
    { name: 'Sat', num: 31, hasDot: true },
  ];

  const handleRescheduleCollision = () => {
    setCollisionResolved(true);
    toast.success('⚡ AI Auto-Scheduler moved CAT-2 prep to Thursday 11:00 AM (Free Slot)!');
  };

  return (
    <div className="figma-device-viewport">
      {/* Screen Mode Switcher */}
      <div className="figma-screen-switcher">
        <button
          type="button"
          className={`figma-screen-tab ${activeScreen === 1 ? 'active' : ''}`}
          onClick={() => setActiveScreen(1)}
        >
          📅 1. Day Timeline
        </button>
        <button
          type="button"
          className={`figma-screen-tab ${activeScreen === 2 ? 'active' : ''}`}
          onClick={() => setActiveScreen(2)}
        >
          ⚡ 2. Task Grid
        </button>
        <button
          type="button"
          className={`figma-screen-tab ${activeScreen === 3 ? 'active' : ''}`}
          onClick={() => setActiveScreen(3)}
        >
          📊 3. Readiness & Chart
        </button>
        <button
          type="button"
          className={`figma-screen-tab ${activeScreen === 4 ? 'active' : ''}`}
          onClick={() => setActiveScreen(4)}
        >
          ✨ 4. Showcase / Landing
        </button>
        <button
          type="button"
          className={`figma-screen-tab ${activeScreen === 5 ? 'active' : ''}`}
          onClick={() => setActiveScreen(5)}
        >
          🌿 5. Today's Hero Focus
        </button>
      </div>

      {/* Realistic Mobile Device Mockup Frame */}
      <div className="figma-mobile-frame">
        {/* iOS Phone Status Bar */}
        <div className="figma-phone-status-bar">
          <span>{currentTime}</span>
          <div className="figma-phone-notch">
            <div className="figma-notch-speaker" />
            <div className="figma-notch-camera" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem' }}>
            <span>5G</span>
            <span>📶</span>
            <span>🔋</span>
          </div>
        </div>

        {/* Scrollable Mobile Body */}
        <div className="figma-mobile-body">
          {/* Top Header Bar for Screens 1, 2, 3, 5 */}
          {activeScreen !== 4 && (
            <div className="figma-app-header-bar">
              <div className="figma-user-greeting-box">
                <div className="figma-user-avatar">
                  <span>TM</span>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>Good morning,</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#14382A' }}>Totok Michael 👋</div>
                </div>
              </div>

              <div className="figma-header-actions">
                <button
                  type="button"
                  className="figma-icon-btn"
                  onClick={() => toast.info('🔍 Search tasks, exams, and syllabi...')}
                  title="Search"
                >
                  🔍
                </button>
                <button
                  type="button"
                  className="figma-icon-btn"
                  onClick={() => toast.info('🔔 2 notifications: Rivierafest holiday clash resolved!')}
                  title="Notifications"
                >
                  🔔
                  <span className="figma-icon-badge" />
                </button>
              </div>
            </div>
          )}

          {/* ===============================================================
              SCREEN 1: DAY PLANNER & SCHEDULE TIMELINE
              =============================================================== */}
          {activeScreen === 1 && (
            <>
              {/* Horizontal Date Picker Strip */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
                {weekDays.map((d) => {
                  const isSelected = selectedDayNum === d.num;
                  return (
                    <div
                      key={d.num}
                      onClick={() => {
                        setSelectedDayNum(d.num);
                        toast.info(`Switched to ${d.name} ${d.num}`);
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '42px',
                        height: '62px',
                        borderRadius: '20px',
                        background: isSelected ? '#14382A' : '#F8FAFC',
                        color: isSelected ? '#FFFFFF' : '#475569',
                        cursor: 'pointer',
                        transition: 'all 0.18s ease',
                        border: isSelected ? 'none' : '1px solid #E2E8F0',
                      }}
                    >
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, opacity: isSelected ? 0.85 : 0.7 }}>
                        {d.name}
                      </span>
                      <span style={{ fontSize: '0.92rem', fontWeight: 800, marginTop: '2px' }}>
                        {d.num}
                      </span>
                      {d.hasDot && (
                        <span
                          style={{
                            width: '4px',
                            height: '4px',
                            borderRadius: '50%',
                            background: isSelected ? '#A7F3D0' : '#14382A',
                            marginTop: '3px',
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Quick KPI Row */}
              <div className="figma-kpi-row">
                <div className="figma-kpi-card forest">
                  <span className="figma-kpi-label">Active Tasks</span>
                  <span className="figma-kpi-num">4</span>
                </div>
                <div className="figma-kpi-card pale">
                  <span className="figma-kpi-label">Readiness</span>
                  <span className="figma-kpi-num" style={{ color: '#14382A' }}>73%</span>
                </div>
                <div className="figma-kpi-card amber">
                  <span className="figma-kpi-label">Streak</span>
                  <span className="figma-kpi-num">5d 🔥</span>
                </div>
              </div>

              {/* Schedule Section Heading */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#14382A' }}>
                  Today's Timeline
                </span>
                <span className="pill-eyebrow green">Auto-Sync On</span>
              </div>

              {/* Vertical Schedule Timeline */}
              <div className="figma-timeline-container">
                <div className="figma-timeline-axis" />

                {/* Event 1: Lecture */}
                <div className="figma-timeline-item">
                  <span className="figma-time-tag">09:00</span>
                  <div className="figma-timeline-node green" />
                  <div
                    style={{
                      background: '#E8F5E9',
                      border: '1px solid #C8E6D2',
                      borderRadius: '16px',
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="pill-eyebrow green" style={{ fontSize: '0.62rem' }}>Lecture</span>
                      <span style={{ fontSize: '0.68rem', color: '#14382A', fontWeight: 600 }}>09:00 – 10:15 AM</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#14382A', marginTop: '4px' }}>
                      CSE3002 • Compiler Design
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#2D6A4F', marginTop: '2px' }}>
                      Hall 302 • Dr. S. Ramanujan
                    </div>
                  </div>
                </div>

                {/* Event 2: Urgent Exam Collision (Coral Card from Figma) */}
                <div className="figma-timeline-item">
                  <span className="figma-time-tag">10:30</span>
                  <div className="figma-timeline-node coral" />
                  <div
                    className="figma-card-coral"
                    style={{
                      border: collisionResolved ? '1px solid #A7F3D0' : '1px solid var(--color-coral-border)',
                      background: collisionResolved ? '#ECFDF5' : 'var(--color-coral-bg)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="pill-eyebrow coral" style={{ fontSize: '0.62rem' }}>
                        {collisionResolved ? 'Resolved ✓' : 'URGENT • COLLISION'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#B23A3A', fontWeight: 700 }}>
                        {collisionResolved ? 'Shifted to Thu' : 'Clash with RivieraFest'}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#14382A' }}>
                        CAT-2 Prep: Neural Networks
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '3px' }}>
                        Exam on Friday • Weightage 30% • 3 Spaced Blocks
                      </div>
                    </div>
                    {!collisionResolved ? (
                      <button
                        type="button"
                        className="btn btn-coral btn-xs"
                        style={{ alignSelf: 'flex-start', borderRadius: '20px' }}
                        onClick={handleRescheduleCollision}
                      >
                        ⚡ AI Auto-Reschedule Slot
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: '#065F46', fontWeight: 700 }}>
                        ✓ Replaced with safe free study window
                      </span>
                    )}
                  </div>
                </div>

                {/* Event 3: Spaced Revision Block (Amber Card from Figma) */}
                <div className="figma-timeline-item">
                  <span className="figma-time-tag">02:00</span>
                  <div className="figma-timeline-node amber" />
                  <div className="figma-card-amber">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="pill-eyebrow amber" style={{ fontSize: '0.62rem' }}>Spaced Review</span>
                      <span style={{ fontSize: '0.68rem', color: '#92400E', fontWeight: 600 }}>02:00 – 03:30 PM</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#14382A' }}>
                        Math 204: Probability & Markov Chains
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#92400E', marginTop: '2px' }}>
                        Review Slot 2 of 4 • Retention Goal 85%
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        background: '#D97706',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '20px',
                        alignSelf: 'flex-start',
                      }}
                      onClick={() => toast.info('Starting Math 204 review session!')}
                    >
                      ▶ Start Review Session
                    </button>
                  </div>
                </div>

                {/* Event 4: Practical Lab */}
                <div className="figma-timeline-item">
                  <span className="figma-time-tag">04:30</span>
                  <div className="figma-timeline-node green" />
                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '16px',
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="pill-eyebrow neutral" style={{ fontSize: '0.62rem' }}>Lab Practice</span>
                      <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>04:30 – 06:00 PM</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#14382A', marginTop: '4px' }}>
                      CS301L • Operating Systems Kernel Lab
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>
                      Lab 4 • Task: Mutex Deadlock Prevention
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Sticky Focus Audio Pill */}
              <StickyFocusPlayer />
            </>
          )}

          {/* ===============================================================
              SCREEN 2: TASK GRID & SPLIT PRIORITY CARDS
              =============================================================== */}
          {activeScreen === 2 && (
            <>
              {/* Quick KPI Bar */}
              <div className="figma-kpi-row">
                <div className="figma-kpi-card forest">
                  <span className="figma-kpi-label">Study Today</span>
                  <span className="figma-kpi-num">4.5h</span>
                </div>
                <div className="figma-kpi-card pale">
                  <span className="figma-kpi-label">On Track</span>
                  <span className="figma-kpi-num" style={{ color: '#14382A' }}>88%</span>
                </div>
                <div className="figma-kpi-card amber">
                  <span className="figma-kpi-label">Exams Ahead</span>
                  <span className="figma-kpi-num">3</span>
                </div>
              </div>

              {/* Split Cards Grid */}
              <div className="figma-split-grid">
                {/* Left: Urgent Card */}
                <div className="figma-card-coral">
                  <span className="pill-eyebrow coral" style={{ alignSelf: 'flex-start' }}>Urgent</span>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#B23A3A' }}>
                      CAT-1 Review
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '2px' }}>
                      Due in 03h 14m
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-coral btn-xs"
                    onClick={() => toast.info('Focus mode started for CAT-1 Review!')}
                  >
                    Focus Now
                  </button>
                </div>

                {/* Right: Spaced Review Card */}
                <div className="figma-card-amber">
                  <span className="pill-eyebrow amber" style={{ alignSelf: 'flex-start' }}>Spaced Rep</span>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#92400E' }}>
                      Math Formulae
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#92400E', marginTop: '2px' }}>
                      Slot 2 of 4
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-xs"
                    style={{ background: '#D97706', color: '#FFF', border: 'none' }}
                    onClick={() => toast.info('Review flashcards initiated!')}
                  >
                    Review (15m)
                  </button>
                </div>
              </div>

              {/* Task Checklist */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#14382A' }}>
                    Active Checklist (4)
                  </span>
                  <button
                    type="button"
                    className="btn btn-pale btn-xs"
                    onClick={() => toast.info('Open Add Task modal')}
                  >
                    + New
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { id: 1, title: 'Literature Review Citations', course: 'CS101', due: 'Today 5 PM', priority: 'high' },
                    { id: 2, title: 'OS Deadlock Synchronization Lab', course: 'CS301L', due: 'Tomorrow', priority: 'medium' },
                    { id: 3, title: 'Linear Algebra Eigenvalues Revision', course: 'Math 204', due: 'Friday', priority: 'medium' },
                    { id: 4, title: 'Morning Yoga & Mindfulness Breath', course: 'Routine', due: 'Everyday', priority: 'low' },
                  ].map((task) => (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: '14px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="checkbox"
                          style={{ width: '16px', height: '16px', accentColor: '#14382A', cursor: 'pointer' }}
                          onChange={(e) => {
                            if (e.target.checked) toast.success(`Completed "${task.title}"!`);
                          }}
                        />
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#14382A' }}>
                            {task.title}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#64748B' }}>
                            {task.course} • {task.due}
                          </div>
                        </div>
                      </div>
                      <span className={`pill-eyebrow ${task.priority === 'high' ? 'coral' : task.priority === 'medium' ? 'amber' : 'green'}`}>
                        {task.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating Sticky Focus Bar */}
              <StickyFocusPlayer />
            </>
          )}

          {/* ===============================================================
              SCREEN 3: ACADEMIC READINESS & ANALYTICS
              =============================================================== */}
          {activeScreen === 3 && (
            <>
              {/* Semi-Circle SVG Readiness Gauge */}
              <ReadinessGauge score={73} />

              {/* Weekly Study Hours Dual-Bar Chart */}
              <WeeklyStudyChart />

              {/* Notice Banner */}
              <div
                style={{
                  background: 'var(--color-amber-bg)',
                  border: '1px solid var(--color-amber-border)',
                  borderRadius: '16px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400E' }}>
                    Exam Collision Resolved
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#78350F', marginTop: '2px' }}>
                    CAT-2 examination clashes with campus fest. 2 study blocks relocated to avoid burnout.
                  </div>
                </div>
              </div>

              {/* Bottom Sticky Player */}
              <StickyFocusPlayer />
            </>
          )}

          {/* ===============================================================
              SCREEN 4: PRODUCT SHOWCASE & LANDING
              =============================================================== */}
          {activeScreen === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Top Mini Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#14382A' }}>
                  LifeSync
                </span>
                <button
                  type="button"
                  className="btn btn-forest btn-xs"
                  onClick={() => setActiveScreen(1)}
                >
                  Enter App →
                </button>
              </div>

              {/* Hero Section */}
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <span className="pill-eyebrow forest" style={{ marginBottom: '8px' }}>
                  Intelligent Student Assistant
                </span>
                <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#14382A', lineHeight: 1.25 }}>
                  Synchronize Your Life, Work & Mind
                </h2>
                <p style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '8px', lineHeight: 1.5 }}>
                  Automatically ingest circulars, syllabi, and exam dates via AI. Prevent clashes and study with spaced intervals.
                </p>
              </div>

              {/* Features List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#F8FAFC', padding: '12px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                    📄
                  </div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#14382A' }}>
                      AI PDF & OCR Ingestion
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                      Drag and drop syllabi and university exam circulars.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#F8FAFC', padding: '12px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                    ⚡
                  </div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#14382A' }}>
                      Smart Collision Shield
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                      Prevents clashes with festivals, holidays, and deadlines.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#F8FAFC', padding: '12px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#FFEBE8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                    🎯
                  </div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#14382A' }}>
                      Spaced Repetition Review
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                      Splits major exam prep across progressive intervals.
                    </div>
                  </div>
                </div>
              </div>

              {/* Student Quote */}
              <div style={{ background: '#F1F5F9', borderRadius: '16px', padding: '14px', fontStyle: 'italic', fontSize: '0.74rem', color: '#334155' }}>
                "LifeSync took the chaos out of my CAT week. The automated study gaps between lectures boosted my scores by 20%."
                <div style={{ marginTop: '6px', fontWeight: 700, fontStyle: 'normal', color: '#14382A' }}>
                  — Alex K., Computer Science Major
                </div>
              </div>

              {/* Forest Green Bottom CTA Banner */}
              <div style={{ background: '#14382A', borderRadius: '20px', padding: '18px', textAlign: 'center', color: '#FFFFFF' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>Ready to sync your schedule?</div>
                <div style={{ fontSize: '0.72rem', opacity: 0.8, marginTop: '4px' }}>
                  Join thousands of organized students worldwide.
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ background: '#FFFFFF', color: '#14382A', fontWeight: 700, marginTop: '12px', width: '100%', borderRadius: '20px' }}
                  onClick={() => setActiveScreen(1)}
                >
                  Start Syncing Now →
                </button>
              </div>
            </div>
          )}

          {/* ===============================================================
              SCREEN 5: TODAY'S HERO FOCUS & ANNOUNCEMENT
              =============================================================== */}
          {activeScreen === 5 && (
            <>
              {/* Forest Green Hero Announcement Card */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #14382A 0%, #1F5C3D 100%)',
                  borderRadius: '24px',
                  padding: '20px',
                  color: '#FFFFFF',
                  boxShadow: '0 8px 24px -4px rgba(20, 56, 42, 0.3)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="pill-eyebrow" style={{ background: 'rgba(255,255,255,0.2)', color: '#FFFFFF', fontSize: '0.64rem' }}>
                    DAILY WORKSPACE
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#A7F3D0', fontWeight: 600 }}>
                    ● Live Backend
                  </span>
                </div>

                <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '10px' }}>
                  Welcome back, Totok Michael 👋
                </div>
                <div style={{ fontSize: '0.76rem', color: '#E7F0EA', marginTop: '6px', lineHeight: 1.4 }}>
                  CAT-2 Exams begin in <strong>5 Days</strong>. You have <strong>3 Review Blocks</strong> and <strong>1 urgent task</strong> pending today.
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                  <span
                    className="status-pill"
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#FFFFFF', fontSize: '0.72rem', padding: '4px 10px', borderRadius: '20px' }}
                  >
                    📌 3 Deadlines
                  </span>
                  <span
                    className="status-pill"
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#FFFFFF', fontSize: '0.72rem', padding: '4px 10px', borderRadius: '20px' }}
                  >
                    🔥 5-Day Streak
                  </span>
                </div>
              </div>

              {/* Date Strip */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
                {weekDays.map((d) => {
                  const isSelected = selectedDayNum === d.num;
                  return (
                    <div
                      key={d.num}
                      onClick={() => setSelectedDayNum(d.num)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '42px',
                        height: '62px',
                        borderRadius: '20px',
                        background: isSelected ? '#14382A' : '#F8FAFC',
                        color: isSelected ? '#FFFFFF' : '#475569',
                        cursor: 'pointer',
                        border: isSelected ? 'none' : '1px solid #E2E8F0',
                      }}
                    >
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, opacity: isSelected ? 0.85 : 0.7 }}>
                        {d.name}
                      </span>
                      <span style={{ fontSize: '0.92rem', fontWeight: 800, marginTop: '2px' }}>
                        {d.num}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Routine Habit Row */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '18px',
                  padding: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.3rem' }}>{habitChecked ? '✅' : '🧘'}</span>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#14382A', textDecoration: habitChecked ? 'line-through' : 'none' }}>
                      Morning Yoga & Breathwork
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                      08:00 AM • 30m • High Energy Habit
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className={`btn ${habitChecked ? 'btn-pale' : 'btn-primary'} btn-xs`}
                  style={{ borderRadius: '20px' }}
                  onClick={() => {
                    const n = !habitChecked;
                    setHabitChecked(n);
                    if (n) toast.success('Morning Yoga logged! Streak maintained.');
                  }}
                >
                  {habitChecked ? 'Done ✓' : 'Log Habit'}
                </button>
              </div>

              {/* Split Cards */}
              <div className="figma-split-grid">
                <div className="figma-card-coral">
                  <span className="pill-eyebrow coral">Due Today</span>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#B23A3A' }}>
                    CS101 Paper
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#64748B' }}>
                    03h 14m Left
                  </div>
                </div>

                <div className="figma-card-amber">
                  <span className="pill-eyebrow amber">Spaced Review</span>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#92400E' }}>
                    Math 204
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#92400E' }}>
                    Slot 2 of 4
                  </div>
                </div>
              </div>

              {/* Floating Sticky Focus Player */}
              <StickyFocusPlayer />
            </>
          )}
        </div>

        {/* Floating Bottom Navigation Bar matching Figma */}
        <div className="figma-phone-bottom-nav">
          <button
            type="button"
            className={`figma-nav-item ${activeScreen === 5 ? 'active' : ''}`}
            onClick={() => setActiveScreen(5)}
            title="Overview"
          >
            <span className="icon">🏠</span>
            <span>Home</span>
          </button>
          <button
            type="button"
            className={`figma-nav-item ${activeScreen === 1 ? 'active' : ''}`}
            onClick={() => setActiveScreen(1)}
            title="Schedule"
          >
            <span className="icon">📅</span>
            <span>Timeline</span>
          </button>
          <button
            type="button"
            className={`figma-nav-item ${activeScreen === 2 ? 'active' : ''}`}
            onClick={() => setActiveScreen(2)}
            title="Tasks"
          >
            <span className="icon">✅</span>
            <span>Tasks</span>
          </button>
          <button
            type="button"
            className={`figma-nav-item ${activeScreen === 3 ? 'active' : ''}`}
            onClick={() => setActiveScreen(3)}
            title="Analytics"
          >
            <span className="icon">📊</span>
            <span>Mastery</span>
          </button>
        </div>
      </div>
    </div>
  );
}
