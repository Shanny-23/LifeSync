import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FigmaAppShell from '../components/FigmaAppShell';
import { useAuth } from '../context/AuthContext';

export default function Landing() {
  const [showInteractiveMockup, setShowInteractiveMockup] = useState(true);
  const { user, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleLaunchClick = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div style={{ background: '#F8FAFC' }}>
      {/* 1. Hero Section matching Figma Screen 4 */}
      <section className="landing-hero" style={{ padding: '48px 24px 32px 24px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: '#FFFFFF', padding: '6px 18px 6px 8px', borderRadius: '30px', boxShadow: '0 4px 16px rgba(20, 56, 42, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', marginBottom: '18px' }}>
          <img src="/logo.png" alt="LifeSync Logo" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
          <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#14382A', letterSpacing: '-0.01em' }}>LifeSync — Elevate your flow</span>
        </div>

        <div className="hero-social-proof" style={{ marginBottom: '16px' }}>
          <span>★★★★★</span>
          <span>4.9/5 Rating • Built for Top Universities & Students</span>
        </div>

        <h1 className="hero-headline" style={{ fontSize: '2.8rem', color: '#14382A', lineHeight: 1.15 }}>
          Synchronize Your <span className="hero-underline-accent" style={{ color: '#10B981' }}>Life</span>,<br />
          Work & Academic Mind
        </h1>

        <p className="hero-subcopy" style={{ maxWidth: '640px', margin: '16px auto 24px auto', fontSize: '1.05rem', color: '#475569' }}>
          The intelligent schedule optimizer that ingests course circulars, resolves campus event collisions,
          and automatically schedules spaced review blocks before major examinations.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleLaunchClick}
            id="launch-web-app-cta"
            className="btn btn-forest btn-lg"
            style={{
              padding: '14px 40px',
              fontSize: '1.1rem',
              borderRadius: '30px',
              background: '#14382A',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              boxShadow: '0 4px 14px rgba(20, 56, 42, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {user ? 'Open Dashboard →' : 'Launch Web App →'}
          </button>
          <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
            Free for students • Instant local sync • No credit card needed
          </span>
        </div>

        {/* Institutional Trust Badges */}
        <div className="trust-logos" style={{ marginTop: '32px' }}>
          <span>VIT VELLORE</span>
          <span>•</span>
          <span>MIT EECS</span>
          <span>•</span>
          <span>STANFORD</span>
          <span>•</span>
          <span>UC BERKELEY</span>
          <span>•</span>
          <span>ACM CHAPTER</span>
        </div>
      </section>

      {/* 2. Interactive Figma Mockup Showcase */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 20px 48px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span className="pill-eyebrow forest" style={{ fontSize: '0.74rem' }}>
            ✨ Live Figma Design System • Interactive Device Preview
          </span>
          <p style={{ fontSize: '0.86rem', color: '#64748B', marginTop: '6px' }}>
            Try clicking tabs, dates, audio focus player, and AI auto-reschedule below:
          </p>
        </div>

        <FigmaAppShell initialScreen={1} />
      </div>

      {/* 3. Three Core Benefit Cards from Screen 4 */}
      <section style={{ maxWidth: '1040px', margin: '0 auto', padding: '0 24px 64px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1.8rem', color: '#14382A', fontWeight: 800 }}>
            Engineered for Stress-Free Academic Excellence
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#64748B', marginTop: '6px' }}>
            Every feature designed to prevent cramming and academic burnout.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {/* Card 1 */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '22px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: '16px' }}>
              📄
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#14382A', marginBottom: '8px' }}>
              AI Document Ingestion
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#64748B', lineHeight: 1.5 }}>
              Drag and drop complex university exam circulars and course syllabi. LifeSync extracts course codes, dates, and topics automatically with OCR fallback.
            </p>
          </div>

          {/* Card 2 */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '22px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: '16px' }}>
              ⚡
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#14382A', marginBottom: '8px' }}>
              Collision Resolution Shield
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#64748B', lineHeight: 1.5 }}>
              Detects clashes between scheduled study sessions and campus festivals (e.g. Riviera, Gravitas) or holidays. Automatically finds safe free windows.
            </p>
          </div>

          {/* Card 3 */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '22px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#FFEBE8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: '16px' }}>
              🎯
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#14382A', marginBottom: '8px' }}>
              Spaced Repetition Planner
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#64748B', lineHeight: 1.5 }}>
              Calculates decay curves and schedules optimal multi-day review blocks leading up to CAT-1, CAT-2, and FAT examinations so knowledge sticks.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Student Testimonial Quote */}
      <section style={{ maxWidth: '820px', margin: '0 auto 64px auto', padding: '0 24px' }}>
        <div style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '28px', textAlign: 'center' }}>
          <p style={{ fontSize: '1.05rem', fontStyle: 'italic', color: '#334155', lineHeight: 1.6 }}>
            "LifeSync completely reshaped our semester. Instead of all-nighters right before CAT-2, the schedule engine broke our revisions into daily 45-minute focus intervals. My GPA increased by 0.6 points."
          </p>
          <div style={{ marginTop: '14px', fontWeight: 800, color: '#14382A' }}>
            Totok Michael & Computer Science Batch 2026
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
            Active Daily User • 5-Day Study Streak
          </div>
        </div>
      </section>

      {/* 5. Deep Forest Green Conversion Band matching Screen 4 */}
      <section className="landing-cta-band" style={{ background: '#14382A', color: '#FFFFFF', padding: '64px 24px', textAlign: 'center' }}>
        <h2 className="cta-band-title" style={{ fontSize: '2.2rem', color: '#FFFFFF', fontWeight: 800 }}>
          Ready to Find Your Daily Rhythm?
        </h2>
        <p className="cta-band-sub" style={{ color: '#A7F3D0', maxWidth: '580px', margin: '12px auto 28px auto', fontSize: '1rem' }}>
          Join thousands of university students organizing their days with effortless, intelligent ease.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <Link
            to="/home"
            className="btn btn-lg"
            style={{ background: '#FFFFFF', color: '#14382A', fontWeight: 800, padding: '14px 36px', borderRadius: '30px' }}
          >
            Launch LifeSync Workspace →
          </Link>
        </div>

        <div style={{ marginTop: '24px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
          ★ 4.9 on Student Reviews • 500,000+ study blocks scheduled
        </div>
      </section>
    </div>
  );
}
