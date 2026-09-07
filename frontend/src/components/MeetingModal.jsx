import { useState } from 'react';
import { useToast } from '../context/ToastContext';

export default function MeetingModal({
  isOpen,
  onClose,
  meetingTitle = "CS101 Term Paper Sync • Methodology Alignment",
  meetingTime = "Today, 1:00 PM – 1:45 PM",
  meetUrl = "https://meet.google.com/abc-xyz-lifesync",
  attendees = [
    { name: "Totok Michael", role: "Organizer & Student", avatar: "TM", status: "online" },
    { name: "Alex Lin", role: "Design Pod Lead", avatar: "AL", status: "online" },
    { name: "Edwin Vance", role: "Research Peer", avatar: "EV", status: "busy" },
    { name: "Sarah Rose", role: "Draft Reviewer", avatar: "SR", status: "away" },
  ],
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(meetUrl);
    setCopied(true);
    toast.success("Meeting link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = () => {
    toast.info("Connecting to Google Meet room...");
    window.open(meetUrl, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-card" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="pill-eyebrow forest">TEAM SYNC</span>
            <h2 className="modal-title" style={{ fontSize: '1.2rem' }}>Meeting Details</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>
              {meetingTitle}
            </h3>
            <div style={{ fontSize: '0.84rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🕒</span>
              <span>{meetingTime}</span>
              <span>•</span>
              <span className="pill-eyebrow green">Google Meet Synced</span>
            </div>
          </div>

          {/* Agenda summary */}
          <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.82rem' }}>
            <strong style={{ color: '#1B3B2E' }}>Agenda:</strong>
            <ul style={{ paddingLeft: '18px', marginTop: '4px', color: '#475569', lineHeight: '1.5' }}>
              <li>Review Claude AI extraction accuracy on CS101 assignment rubrics</li>
              <li>Finalize methodology citations before 5:00 PM deadline</li>
              <li>Delegate bibliography formatting and LaTeX compilation</li>
            </ul>
          </div>

          {/* Attendees */}
          <div>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', color: '#6B7280', marginBottom: '8px' }}>
              Attendees ({attendees.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {attendees.map((att, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#1B3B2E',
                      color: '#FFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.78rem',
                      fontWeight: 700
                    }}>
                      {att.avatar}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1E293B' }}>{att.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{att.role}</div>
                    </div>
                  </div>
                  <span className={`pill-eyebrow ${att.status === 'online' ? 'green' : att.status === 'busy' ? 'amber' : 'neutral'}`} style={{ fontSize: '0.65rem' }}>
                    ● {att.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Link box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F1F5F9', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: '#334155', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
              {meetUrl}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={handleCopyLink}
            >
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ flex: 1 }}
              onClick={onClose}
            >
              Dismiss
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ flex: 2, background: '#2563EB' }}
              onClick={handleJoin}
            >
              📹 Join Google Meet Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
