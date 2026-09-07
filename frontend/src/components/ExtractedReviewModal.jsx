import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { analyzeDocument, commitExtractedItems } from '../api';

export default function ExtractedReviewModal({ isOpen, onClose, uploadId, rawText }) {
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // overview | deliverables | roadmap | schedule | holidays
  const [selectedAssignments, setSelectedAssignments] = useState([]);
  const [selectedExams, setSelectedExams] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [selectedHolidays, setSelectedHolidays] = useState([]);
  const { addToast } = useToast();

  useEffect(() => {
    if (!isOpen) return;

    const fetchAnalysis = async () => {
      setLoading(true);
      try {
        const result = await analyzeDocument({ uploadId, text: rawText });
        setData(result);
        
        // Initialize selection indices
        if (result.assignments) {
          setSelectedAssignments(result.assignments.map((_, i) => i));
        }
        if (result.exams) {
          setSelectedExams(result.exams.map((_, i) => i));
        }
        if (result.schedule) {
          setSelectedEvents(result.schedule.map((_, i) => i));
        }
        if (result.holidays) {
          setSelectedHolidays(result.holidays.map((_, i) => i));
        }
      } catch (err) {
        console.error("Document analysis error:", err);
        addToast("Failed to load AI document intelligence", "alert");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [isOpen, uploadId, rawText, addToast]);

  if (!isOpen) return null;

  const handleCommit = async () => {
    if (!data) return;
    setCommitting(true);
    try {
      const chosenAssignments = (data.assignments || []).filter((_, i) => selectedAssignments.includes(i));
      const chosenExams = (data.exams || []).filter((_, i) => selectedExams.includes(i));
      const chosenEvents = (data.schedule || []).filter((_, i) => selectedEvents.includes(i));
      const chosenHolidays = (data.holidays || []).filter((_, i) => selectedHolidays.includes(i));

      const result = await commitExtractedItems({
        assignments: chosenAssignments,
        exams: chosenExams,
        events: chosenEvents,
        holidays: chosenHolidays,
      });

      addToast(result.message || `Successfully committed items to LifeSync!`, "success");
      window.dispatchEvent(new CustomEvent('lifesync:refresh'));
      onClose();
    } catch (err) {
      console.error("Commit error:", err);
      addToast(`Error committing items: ${err.message}`, "alert");
    } finally {
      setCommitting(false);
    }
  };

  const toggleAssignment = (idx) => {
    setSelectedAssignments((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const toggleExam = (idx) => {
    setSelectedExams((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const toggleEvent = (idx) => {
    setSelectedEvents((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const toggleHoliday = (idx) => {
    setSelectedHolidays((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const courseInfo = data?.course_info || {};
  const workload = data?.workload_analysis || {};
  const grading = data?.grading_breakdown || [];
  const roadmap = data?.syllabus_roadmap || [];
  const assignments = data?.assignments || [];
  const exams = data?.exams || [];
  const schedule = data?.schedule || [];
  const holidays = data?.holidays || [];
  const recommendations = data?.recommendations || [];

  const totalCommitted = selectedAssignments.length + selectedExams.length + selectedEvents.length + selectedHolidays.length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 30, 23, 0.72)',
        backdropFilter: 'blur(6px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '88vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 65px rgba(0,0,0,0.35)',
          border: '1px solid #E2E8F0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1B3B2E 0%, #152E24 100%)',
            color: '#FFFFFF',
            padding: '22px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span
                style={{
                  backgroundColor: 'rgba(52, 211, 153, 0.2)',
                  color: '#6EE7B7',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  padding: '2px 9px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {data?.source ? `Engine: ${data.source}` : 'AI Document Intelligence'}
              </span>
              {courseInfo.term && (
                <span
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    color: '#F1F5F9',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  {courseInfo.term}
                </span>
              )}
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
              {courseInfo.course_code ? `${courseInfo.course_code}: ` : ''}
              {courseInfo.course_title || 'Document Intelligence Studio'}
            </h2>
            {courseInfo.instructor && (
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#A7F3D0' }}>
                👨‍🏫 Instructor: {courseInfo.instructor}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#FFFFFF',
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              fontSize: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
          >
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        {!loading && (
          <div
            style={{
              display: 'flex',
              gap: '6px',
              padding: '10px 24px 0 24px',
              borderBottom: '1px solid #E2E8F0',
              backgroundColor: '#F8FAFC',
            }}
          >
            {[
              { id: 'overview', label: '📊 Intelligence & Workload', badge: `${workload.intensity_level || 'Active'}` },
              { id: 'deliverables', label: `🎯 Tasks & Exams`, count: assignments.length + exams.length },
              { id: 'roadmap', label: `🗺️ Syllabus Roadmap`, count: roadmap.length },
              { id: 'schedule', label: `📅 Lecture Times`, count: schedule.length },
              { id: 'holidays', label: `🏖️ Holidays & Breaks`, count: holidays.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '10px 16px',
                  background: activeTab === tab.id ? '#FFFFFF' : 'transparent',
                  border: '1px solid',
                  borderColor: activeTab === tab.id ? '#E2E8F0' : 'transparent',
                  borderBottomColor: activeTab === tab.id ? '#FFFFFF' : 'transparent',
                  borderRadius: '8px 8px 0 0',
                  fontSize: '13px',
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  color: activeTab === tab.id ? '#1B3B2E' : '#64748B',
                  cursor: 'pointer',
                  marginBottom: '-1px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s',
                }}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    style={{
                      background: activeTab === tab.id ? '#1B3B2E' : '#E2E8F0',
                      color: activeTab === tab.id ? '#FFFFFF' : '#475569',
                      fontSize: '11px',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      fontWeight: 700,
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Modal Body */}
        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1, backgroundColor: '#F8FAFC' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
              <div style={{ fontSize: '36px', marginBottom: '16px', animation: 'spin 1.5s infinite linear' }}>
                ⚡
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1B3B2E', marginBottom: '8px' }}>
                Analyzing Academic Document with Groq AI...
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '440px', margin: '0 auto' }}>
                Extracting course roadmaps, grading distributions, estimated weekly workload, and milestone deadlines using <code>openai/gpt-oss-120b</code>.
              </p>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW & INTELLIGENCE */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Workload Banner Card */}
                  <div
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '14px',
                      padding: '20px',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                        Estimated Academic Demand
                      </h4>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span
                          style={{
                            backgroundColor:
                              workload.intensity_level === 'Extreme'
                                ? '#FEE2E2'
                                : workload.intensity_level === 'Intense'
                                ? '#FEF3C7'
                                : '#ECFDF5',
                            color:
                              workload.intensity_level === 'Extreme'
                                ? '#991B1B'
                                : workload.intensity_level === 'Intense'
                                ? '#92400E'
                                : '#065F46',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 700,
                          }}
                        >
                          Intensity: {workload.intensity_level || 'Moderate'}
                        </span>
                        <span
                          style={{
                            background: '#F1F5F9',
                            color: '#334155',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 700,
                          }}
                        >
                          ⏱️ ~{workload.estimated_weekly_hours || 8.0} hrs/week
                        </span>
                      </div>
                    </div>

                    <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: '0 0 14px 0' }}>
                      {workload.workload_summary || 'Rigorous academic curriculum with balanced practical assignments and comprehensive examinations.'}
                    </p>

                    {/* Crunch Periods Warning */}
                    {workload.crunch_periods && workload.crunch_periods.length > 0 && (
                      <div
                        style={{
                          background: '#FFFBEB',
                          border: '1px solid #FDE68A',
                          borderRadius: '10px',
                          padding: '12px 14px',
                        }}
                      >
                        <strong style={{ fontSize: '12px', color: '#B45309', display: 'block', marginBottom: '4px' }}>
                          ⚠️ Identified Academic Crunch Periods:
                        </strong>
                        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#92400E' }}>
                          {workload.crunch_periods.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Grading Breakdown Card */}
                  <div
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '14px',
                      padding: '20px',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    }}
                  >
                    <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '14px' }}>
                      Grading & Assessment Weights ({grading.reduce((sum, g) => sum + (Number(g.percentage) || 0), 0)}% Accounted)
                    </h4>

                    {grading.length === 0 ? (
                      <div style={{ fontSize: '13px', color: '#94A3B8' }}>No explicit weight breakdown found.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {grading.map((g, idx) => (
                          <div key={idx}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                              <span style={{ fontWeight: 600, color: '#1E293B' }}>{g.component}</span>
                              <span style={{ fontWeight: 700, color: '#1F5C3D' }}>{g.percentage}%</span>
                            </div>
                            <div style={{ height: '8px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.min(100, Math.max(5, g.percentage))}%`,
                                  background: idx % 2 === 0 ? '#1F5C3D' : '#3B82F6',
                                  borderRadius: '4px',
                                }}
                              />
                            </div>
                            {g.description && (
                              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '3px' }}>
                                {g.description}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recommendations */}
                  {recommendations.length > 0 && (
                    <div
                      style={{
                        background: '#EFF6FF',
                        border: '1px solid #BFDBFE',
                        borderRadius: '14px',
                        padding: '16px 20px',
                      }}
                    >
                      <strong style={{ fontSize: '13px', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        💡 Groq AI Study Recommendations:
                      </strong>
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#1E3A8A' }}>
                        {recommendations.map((rec, i) => (
                          <li key={i} style={{ marginBottom: '4px' }}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Holidays & Recesses Overview Callout */}
                  {holidays.length > 0 && (
                    <div
                      style={{
                        background: '#F0FDF4',
                        border: '1px solid #BBF7D0',
                        borderRadius: '14px',
                        padding: '16px 20px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <strong style={{ fontSize: '13px', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          🏖️ Identified University Holidays & Recesses ({holidays.length}):
                        </strong>
                        <button
                          onClick={() => setActiveTab('holidays')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#15803D',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          Review & Ingest Holidays →
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {holidays.map((h, i) => (
                          <span
                            key={i}
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid #86EFAC',
                              color: '#14532D',
                              fontSize: '12px',
                              fontWeight: 600,
                              padding: '4px 10px',
                              borderRadius: '8px',
                            }}
                          >
                            🎉 {h.name} {h.start_date ? `(${h.start_date}${h.end_date && h.end_date !== h.start_date ? ` to ${h.end_date}` : ''})` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: DELIVERABLES (ASSIGNMENTS & EXAMS) */}
              {activeTab === 'deliverables' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Assignments Section */}
                  <div
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '14px',
                      padding: '20px',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                        Assignments & Projects ({assignments.length})
                      </h4>
                      <button
                        onClick={() =>
                          setSelectedAssignments(
                            selectedAssignments.length === assignments.length ? [] : assignments.map((_, i) => i)
                          )
                        }
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#1F5C3D',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {selectedAssignments.length === assignments.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    {assignments.length === 0 ? (
                      <div style={{ fontSize: '13px', color: '#94A3B8' }}>No assignments detected in document.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {assignments.map((item, idx) => {
                          const isSelected = selectedAssignments.includes(idx);
                          return (
                            <div
                              key={idx}
                              onClick={() => toggleAssignment(idx)}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '12px',
                                padding: '12px 16px',
                                borderRadius: '10px',
                                border: isSelected ? '1px solid #6EE7B7' : '1px solid #E2E8F0',
                                background: isSelected ? '#F0FDF4' : '#FFFFFF',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                style={{ marginTop: '3px', cursor: 'pointer' }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                                    {item.title}
                                  </span>
                                  <span
                                    style={{
                                      background: '#DCFCE7',
                                      color: '#15803D',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                    }}
                                  >
                                    {item.weightage || '15%'}
                                  </span>
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                  <span>📅 Due: {item.deadline ? new Date(item.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Flexible'}</span>
                                  {item.estimated_hours && <span>⏱️ ~{item.estimated_hours} hrs</span>}
                                  <span style={{ textTransform: 'capitalize' }}>🔥 Urgency: {item.urgency || 'medium'}</span>
                                </div>
                                {item.description && (
                                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                                    {item.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Exams Section */}
                  {exams.length > 0 && (
                    <div
                      style={{
                        background: '#FFFFFF',
                        borderRadius: '14px',
                        padding: '20px',
                        border: '1px solid #FCA5A5',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#991B1B', margin: 0 }}>
                          Major Exams & Midterms ({exams.length})
                        </h4>
                        <button
                          onClick={() =>
                            setSelectedExams(selectedExams.length === exams.length ? [] : exams.map((_, i) => i))
                          }
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#B91C1C',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {selectedExams.length === exams.length ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {exams.map((exam, idx) => {
                          const isSelected = selectedExams.includes(idx);
                          return (
                            <div
                              key={idx}
                              onClick={() => toggleExam(idx)}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '12px',
                                padding: '12px 16px',
                                borderRadius: '10px',
                                border: isSelected ? '1px solid #F87171' : '1px solid #FEE2E2',
                                background: isSelected ? '#FEF2F2' : '#FFFFFF',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                style={{ marginTop: '3px', cursor: 'pointer' }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#991B1B' }}>
                                    {exam.title}
                                  </span>
                                  <span
                                    style={{
                                      background: '#991B1B',
                                      color: '#FFFFFF',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                    }}
                                  >
                                    {exam.weightage || '30%'}
                                  </span>
                                </div>
                                <div style={{ fontSize: '12px', color: '#7F1D1D', display: 'flex', gap: '12px' }}>
                                  <span>📅 Exam Date: {exam.date ? new Date(exam.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'TBA'}</span>
                                  {exam.preparation_days_needed && <span>📖 Prep Window: {exam.preparation_days_needed} days</span>}
                                </div>
                                {exam.description && (
                                  <div style={{ fontSize: '12px', color: '#450A0A', marginTop: '4px' }}>
                                    {exam.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: SYLLABUS ROADMAP */}
              {activeTab === 'roadmap' && (
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '14px',
                    padding: '20px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '14px' }}>
                    Syllabus Milestones & Course Progression
                  </h4>

                  {roadmap.length === 0 ? (
                    <div style={{ fontSize: '13px', color: '#94A3B8' }}>No phased roadmap extracted.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {roadmap.map((phase, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '14px 18px',
                            background: '#F8FAFC',
                            borderRadius: '10px',
                            border: '1px solid #E2E8F0',
                            borderLeft: '4px solid #1B3B2E',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#1F5C3D', textTransform: 'uppercase' }}>
                              {phase.week_or_phase || `Phase ${idx + 1}`}
                            </span>
                            {phase.weightage && (
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', background: '#E2E8F0', padding: '2px 8px', borderRadius: '6px' }}>
                                {phase.weightage}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
                            {phase.topic}
                          </div>
                          {phase.deliverables && phase.deliverables.length > 0 && (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                              {phase.deliverables.map((del, dIdx) => (
                                <span
                                  key={dIdx}
                                  style={{
                                    fontSize: '11px',
                                    background: '#FFFFFF',
                                    border: '1px solid #CBD5E1',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    color: '#334155',
                                  }}
                                >
                                  🎯 {del}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: SCHEDULE & LECTURES */}
              {activeTab === 'schedule' && (
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '14px',
                    padding: '20px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                      Weekly Class & Lab Sessions ({schedule.length})
                    </h4>
                    <button
                      onClick={() =>
                        setSelectedEvents(
                          selectedEvents.length === schedule.length ? [] : schedule.map((_, i) => i)
                        )
                      }
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#1F5C3D',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {selectedEvents.length === schedule.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  {schedule.length === 0 ? (
                    <div style={{ fontSize: '13px', color: '#94A3B8' }}>No lecture slots detected in document.</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                      {schedule.map((slot, idx) => {
                        const isSelected = selectedEvents.includes(idx);
                        return (
                          <div
                            key={idx}
                            onClick={() => toggleEvent(idx)}
                            style={{
                              padding: '12px 14px',
                              borderRadius: '8px',
                              border: isSelected ? '1px solid #6EE7B7' : '1px solid #E2E8F0',
                              background: isSelected ? '#F0FDF4' : '#FFFFFF',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ cursor: 'pointer' }}
                            />
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>
                                {slot.day}: {slot.start_time} - {slot.end_time}
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748B' }}>
                                {slot.title || 'Lecture'} {slot.location ? `• ${slot.location}` : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: HOLIDAYS & UNIVERSITY BREAKS */}
              {activeTab === 'holidays' && (
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '14px',
                    padding: '20px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                        Academic Holidays, Recesses & Campus Closures ({holidays.length})
                      </h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                        🛡️ LifeSync registers these dates in your calendar. The AI Conflict Resolver will automatically avoid scheduling study sessions on these days and prevent deadline clashes.
                      </p>
                    </div>
                    {holidays.length > 0 && (
                      <button
                        onClick={() =>
                          setSelectedHolidays(
                            selectedHolidays.length === holidays.length ? [] : holidays.map((_, i) => i)
                          )
                        }
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#15803D',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          marginLeft: '12px',
                          padding: '4px 8px',
                        }}
                      >
                        {selectedHolidays.length === holidays.length ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>

                  {holidays.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '48px 20px',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '10px',
                        border: '1px dashed #CBD5E1',
                      }}
                    >
                      <div style={{ fontSize: '32px', marginBottom: '10px' }}>🏖️</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                        No university holidays or campus breaks detected in document.
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', maxWidth: '420px', margin: '0 auto' }}>
                        When a syllabus, circular, or academic calendar mentions university breaks, reading days, or recesses, LifeSync will automatically extract and list them here for 1-click calendar sync.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {holidays.map((hol, idx) => {
                        const isSelected = selectedHolidays.includes(idx);
                        const formatDateStr = (dStr) => {
                          if (!dStr) return '';
                          try {
                            return new Date(dStr).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            });
                          } catch {
                            return dStr;
                          }
                        };
                        const dateDisplay = hol.start_date
                          ? (hol.end_date && hol.end_date !== hol.start_date
                              ? `${formatDateStr(hol.start_date)} – ${formatDateStr(hol.end_date)}`
                              : formatDateStr(hol.start_date))
                          : 'Date to be confirmed';

                        return (
                          <div
                            key={idx}
                            onClick={() => toggleHoliday(idx)}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '12px',
                              padding: '14px 16px',
                              borderRadius: '10px',
                              border: isSelected ? '1px solid #86EFAC' : '1px solid #E2E8F0',
                              background: isSelected ? '#F0FDF4' : '#FFFFFF',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ marginTop: '3px', cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#166534' }}>
                                  🎉 {hol.name}
                                </span>
                                <span
                                  style={{
                                    background: '#DCFCE7',
                                    color: '#15803D',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    textTransform: 'capitalize',
                                  }}
                                >
                                  {hol.type || 'University Holiday'}
                                </span>
                              </div>
                              <div style={{ fontSize: '12px', color: '#15803D', display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: hol.description ? '4px' : '0' }}>
                                <span>📅 {dateDisplay}</span>
                                <span>🛡️ Study Free / Recess Period</span>
                              </div>
                              {hol.description && (
                                <div style={{ fontSize: '12px', color: '#475569' }}>
                                  {hol.description}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer with Bulk Ingestion Action */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FFFFFF',
          }}
        >
          <div style={{ fontSize: '13px', color: '#64748B' }}>
            {!loading && (
              <span>
                Selected for ingestion: <strong>{totalCommitted} item(s)</strong>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '9px 18px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>

            <button
              onClick={handleCommit}
              disabled={committing || loading || totalCommitted === 0}
              style={{
                padding: '9px 24px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #1B3B2E 0%, #15803D 100%)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 700,
                cursor: committing || loading || totalCommitted === 0 ? 'not-allowed' : 'pointer',
                opacity: committing || loading || totalCommitted === 0 ? 0.6 : 1,
                boxShadow: '0 3px 10px rgba(27,59,46,0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {committing ? (
                <>⏳ Ingesting into LifeSync...</>
              ) : (
                <>📥 Ingest {totalCommitted} Items to Tasks & Calendar</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
