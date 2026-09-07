import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';

export default function ExtractedReviewModal({ isOpen, onClose, uploadId, rawText }) {
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [data, setData] = useState(null);
  const { addToast } = useToast();

  useEffect(() => {
    if (!isOpen) return;

    const fetchPreview = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/ai/extract-preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('lifesync_token') || 'demo-token-demo_user_1'}`
          },
          body: JSON.stringify({ upload_id: uploadId, text: rawText })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await res.json();
        setData(result);
      } catch (err) {
        console.error("Preview extraction error:", err);
        addToast("Failed to load AI extraction preview", "alert");
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [isOpen, uploadId, rawText, addToast]);

  if (!isOpen) return null;

  const handleCommit = async () => {
    if (!data) return;
    setCommitting(true);
    try {
      const res = await fetch('/api/ai/commit-extracted', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('lifesync_token') || 'demo-token-demo_user_1'}`
        },
        body: JSON.stringify({
          assignments: data.assignments || [],
          exams: data.exams || [],
          events: data.schedule || []
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();

      addToast(result.message || "Successfully committed extracted items!", "success");
      window.dispatchEvent(new CustomEvent('lifesync:refresh'));
      onClose();
    } catch (err) {
      console.error("Commit error:", err);
      addToast(`Error committing items: ${err.message}`, "alert");
    } finally {
      setCommitting(false);
    }
  };

  const assignments = data?.assignments || [];
  const exams = data?.exams || [];
  const schedule = data?.schedule || [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 30, 23, 0.7)',
        backdropFilter: 'blur(5px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '85vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          border: '1px solid #E5E7EB'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: '#1B3B2E',
            color: '#FFFFFF',
            padding: '22px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span
                style={{
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  padding: '3px 8px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                {data?.source ? `Engine: ${data.source}` : 'AI Document Intelligence'}
              </span>
            </div>
            <h2 style={{ fontSize: '19px', fontWeight: 700, margin: 0 }}>
              Review Extracted Syllabus & Deadlines
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '22px',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7280' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>✨</div>
              <div style={{ fontWeight: 600 }}>Extracting Academic Schedule with Groq AI (Llama 3.3)...</div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>Identifying assignments, exam weightages, and lecture times</div>
            </div>
          ) : (
            <>
              {/* Course Info Banner */}
              {data?.course_info && (
                <div
                  style={{
                    backgroundColor: '#F2F8F4',
                    border: '1px solid #D2E4D8',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#1F5C3D', textTransform: 'uppercase' }}>
                      Identified Course
                    </span>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
                      {data.course_info.course_code || 'CS450'} — {data.course_info.course_title || 'Academic Course'}
                    </div>
                  </div>
                  <span
                    style={{
                      backgroundColor: '#1F5C3D',
                      color: '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: '12px'
                    }}
                  >
                    High Confidence
                  </span>
                </div>
              )}

              {/* Assignments Section */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#374151', margin: '0 0 10px 0' }}>
                  Assignments & Deadlines ({assignments.length})
                </h4>
                {assignments.length === 0 ? (
                  <div style={{ fontSize: '13px', color: '#9CA3AF' }}>No assignments detected.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {assignments.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          backgroundColor: '#FFFFFF'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6B7280' }}>
                            Due: {item.deadline ? new Date(item.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Flexible'}
                          </div>
                        </div>
                        <span
                          style={{
                            backgroundColor: '#E7F0EA',
                            color: '#1F5C3D',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600
                          }}
                        >
                          {item.weightage || '15%'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Exams Section */}
              {exams.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#B23A3A', margin: '0 0 10px 0' }}>
                    Major Exams & Tests ({exams.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {exams.map((exam, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          border: '1px solid #F6D9D3',
                          backgroundColor: '#FDF7F6',
                          borderRadius: '8px'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#B23A3A' }}>
                            {exam.title}
                          </div>
                          <div style={{ fontSize: '12px', color: '#7F1D1D' }}>
                            Exam Date: {exam.date ? new Date(exam.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'TBA'}
                          </div>
                        </div>
                        <span
                          style={{
                            backgroundColor: '#B23A3A',
                            color: '#FFFFFF',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600
                          }}
                        >
                          {exam.weightage || '30%'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            backgroundColor: '#F9FAFB'
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              border: '1px solid #D1D5DB',
              backgroundColor: '#FFFFFF',
              color: '#374151',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCommit}
            disabled={committing || loading}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#1F5C3D',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 600,
              cursor: committing || loading ? 'not-allowed' : 'pointer',
              opacity: committing || loading ? 0.6 : 1,
              boxShadow: '0 2px 6px rgba(31,92,61,0.25)'
            }}
          >
            {committing ? "Saving to LifeSync..." : "Commit All to Tasks & Calendar"}
          </button>
        </div>
      </div>
    </div>
  );
}
