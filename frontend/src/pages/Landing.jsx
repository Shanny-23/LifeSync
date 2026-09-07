import { Link } from 'react-router-dom';
import AtAGlanceMetrics from '../components/AtAGlanceMetrics';
import WeekStrip from '../components/WeekStrip';
import EscalatedDeadlineCard from '../components/EscalatedDeadlineCard';

export default function Landing() {
  return (
    <div>
      {/* 1. Hero Section */}
      <section className="landing-hero">
        <div className="hero-social-proof">
          <span>★★★★★</span>
          <span>4.9/5 Rating from 12,000+ Students & Researchers</span>
        </div>

        <h1 className="hero-headline">
          Synchronize Your <span className="hero-underline-accent">Life</span>,<br />
          Work & Mind
        </h1>

        <p className="hero-subcopy">
          The mindful student & professional planner turning chaotic deadlines, messy voice memos,
          and scattered routines into effortless daily flow. Powered by intelligent Claude AI scheduling.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <Link to="/home" className="btn btn-primary btn-lg" style={{ padding: '14px 36px', fontSize: '1.1rem' }}>
            Start Free Trial →
          </Link>
          <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>
            No credit card required • 14-day free trial • Instant setup
          </span>
        </div>

        {/* Institutional Trust Badges */}
        <div className="trust-logos">
          <span>MIT EECS</span>
          <span>•</span>
          <span>STANFORD</span>
          <span>•</span>
          <span>UC BERKELEY</span>
          <span>•</span>
          <span>ACM CHAPTER</span>
        </div>
      </section>

      {/* 2. Living Product Preview Window */}
      <div className="desktop-preview-frame">
        <div className="preview-window-header">
          <div className="window-control-dot red" />
          <div className="window-control-dot yellow" />
          <div className="window-control-dot green" />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', marginLeft: '12px' }}>
            LifeSync Pro — Daily Workspace
          </span>
        </div>

        <div style={{ padding: '24px', background: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Assistant Chat Prompt */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.1rem' }}>✨</span>
            <span style={{ fontSize: '0.86rem', color: '#475569', fontStyle: 'italic' }}>
              "Claude, arrange my CS101 study sessions before Friday 5 PM around my morning labs..."
            </span>
            <span className="pill-eyebrow green" style={{ marginLeft: 'auto' }}>AI Auto-Schedule Ready</span>
          </div>

          <AtAGlanceMetrics />
          <WeekStrip />
          <EscalatedDeadlineCard />
        </div>
      </div>

      {/* 3. Closing Conversion Band */}
      <section className="landing-cta-band">
        <h2 className="cta-band-title">Ready to Find Your Daily Rhythm?</h2>
        <p className="cta-band-sub">
          Join 12,000+ students and professionals organizing their days with intelligent ease.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <Link to="/home" className="btn btn-primary btn-lg" style={{ background: '#10B981', color: '#0F172A', fontWeight: 700 }}>
            📥 Download for Mac & Windows
          </Link>
          <Link to="/home" className="btn btn-secondary btn-lg" style={{ background: 'transparent', color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.4)' }}>
            Launch Web App →
          </Link>
        </div>

        <div style={{ marginTop: '24px', fontSize: '0.8rem', color: '#9CA3AF' }}>
          ★ 4.9 on Mac App Store • 500,000+ tasks scheduled
        </div>
      </section>
    </div>
  );
}
