import { useState, useEffect, useRef, useCallback } from 'react';
import {
  uploadDocument,
  getUploadStatus,
  getTasks,
  getEvents,
  getHealth,
  getGoogleStatus,
  connectGoogle,
  disconnectGoogle,
  importGoogleCalendar,
} from '../api';
import RightRail from '../components/RightRail';
import ExtractedReviewModal from '../components/ExtractedReviewModal';

const UPLOAD_TYPES = [
  { id: 'timetable', label: 'Class Timetable', description: 'Extracts weekly courses, lecture slots, and labs' },
  { id: 'syllabus', label: 'Course Syllabus', description: 'Extracts units, topics, and exam weightages' },
  { id: 'assignments', label: 'Assignment Rubrics', description: 'Extracts project deadlines, tasks, and point values' },
  { id: 'holiday_calendar', label: 'Academic Holidays', description: 'Extracts university breaks, recesses, and closures' },
  { id: 'fest_schedule', label: 'Campus Fest Schedule', description: 'Extracts university event schedules and competitions' },
  { id: 'club_calendar', label: 'Club Calendar', description: 'Extracts extracurricular meetings and club commitments' },
];

const SAMPLE_DOCUMENTS = {
  cs450: `CS450: Distributed Operating Systems (Fall 2026)
Instructor: Prof. Sarah Jenkins
Lectures: Monday and Wednesday 10:00 - 11:30 AM (Auditorium Hall B)
Lab Sessions: Friday 14:00 - 16:00 (Systems Lab 204)

Grading Distribution:
- Programming Labs (4 Major Labs): 30%
- Midterm Examination: 30%
- Final Distributed Project & Demos: 40%

Key Deadlines & Milestones:
- Lab 1: Multithreaded RPC Framework due Sep 28, 2026 at 23:59
- Lab 2: Raft Consensus State Machine due Oct 18, 2026 at 23:59
- Midterm Exam on Oct 21, 2026 at 10:00 AM
- Final Project Submission & Code Review due Dec 02, 2026 at 23:59`,

  math201: `MATH201: Advanced Linear Algebra & Matrix Applications
Instructor: Dr. Alan Turing
Lectures: Tuesday and Thursday 09:00 - 10:30 AM (Science Hall 301)

Assessment Weights:
- Weekly Problem Sets: 25%
- Midterm Exam: 35%
- Comprehensive Final Assessment: 40%

Schedule:
- Problem Set 1: Vector Subspaces due Oct 05, 2026 at 17:00
- Midterm Exam on Oct 29, 2026 at 09:00 AM
- Problem Set 2: SVD and Principal Components due Nov 19, 2026 at 17:00
- Comprehensive Final on Dec 10, 2026 at 09:00 AM`,

  fest: `TechFest 2026 Campus Circular & Schedule
Venue: Campus Innovation Center & Main Grounds
Dates: Oct 24, 2026 to Oct 26, 2026

Schedule of Events:
- 24-Hour AI Hackathon Kickoff on Oct 24, 2026 at 10:00 AM
- Robotics Arena Finals on Oct 25, 2026 at 14:00
- Project Expo & Keynote on Oct 26, 2026 at 16:00 in Main Auditorium`
};

export default function Upload() {
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadType, setUploadType] = useState('timetable');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [pipelineStage, setPipelineStage] = useState('idle'); // idle | pending | parsed | extracted | normalized | done | failed
  const [stageMessage, setStageMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [backendOnline, setBackendOnline] = useState(false);
  const [summaryData, setSummaryData] = useState({ taskCount: 0, eventCount: 0 });
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [currentUploadId, setCurrentUploadId] = useState(null);
  const [inputMode, setInputMode] = useState('file'); // 'file' | 'text'
  const [pasteText, setPasteText] = useState(SAMPLE_DOCUMENTS.cs450);
  const [reviewRawText, setReviewRawText] = useState('');

  // Google Calendar Integration State
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googlePreview, setGooglePreview] = useState(null);
  const [googleCommitSuccess, setGoogleCommitSuccess] = useState(null);
  const [googleError, setGoogleError] = useState('');

  const pollTimerRef = useRef(null);

  // Clear polling timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const refreshCurrentData = useCallback(async () => {
    try {
      const [tasks, events] = await Promise.all([getTasks(), getEvents()]);
      setSummaryData({
        taskCount: Array.isArray(tasks) ? tasks.length : 0,
        eventCount: Array.isArray(events) ? events.length : 0,
      });
    } catch {
      // Backend offline or error
    }
  }, []);

  const checkGoogleStatus = useCallback(async () => {
    try {
      const data = await getGoogleStatus();
      if (data && data.connected) {
        setGoogleConnected(true);
        setGoogleEmail(data.email || 'Connected Account');
      } else {
        setGoogleConnected(false);
        setGoogleEmail('');
      }
    } catch {
      setGoogleConnected(false);
    }
  }, []);

  // Check backend health, current summary data & Google status on mount
  useEffect(() => {
    let mounted = true;
    getHealth()
      .then(() => {
        if (mounted) setBackendOnline(true);
      })
      .catch(() => {
        if (mounted) setBackendOnline(false);
      });

    refreshCurrentData();
    checkGoogleStatus();

    // Check query params for auth redirects
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === 'true') {
      setGoogleConnected(true);
      checkGoogleStatus();
    } else if (params.get('google_error')) {
      setGoogleError(decodeURIComponent(params.get('google_error')));
    }

    return () => {
      mounted = false;
    };
  }, [checkGoogleStatus, refreshCurrentData]);

  // Handle Google Calendar Connect/Disconnect
  const handleConnectGoogle = () => {
    connectGoogle();
  };

  const handleDisconnectGoogle = async () => {
    setGoogleLoading(true);
    setGoogleError('');
    try {
      await disconnectGoogle();
      setGoogleConnected(false);
      setGoogleEmail('');
      setGooglePreview(null);
      setGoogleCommitSuccess(null);
    } catch (err) {
      setGoogleError(`Failed to disconnect: ${err.message}`);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleImportPreview = async () => {
    setGoogleLoading(true);
    setGoogleError('');
    setGoogleCommitSuccess(null);
    try {
      const result = await importGoogleCalendar({ commit: false });
      setGooglePreview(result);
    } catch (err) {
      setGoogleError(`Google Calendar import failed: ${err.message}`);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleImportCommit = async () => {
    setGoogleLoading(true);
    setGoogleError('');
    try {
      const result = await importGoogleCalendar({ commit: true });
      setGoogleCommitSuccess(result);
      setGooglePreview(null);
      await refreshCurrentData();
    } catch (err) {
      setGoogleError(`Failed to commit Google events: ${err.message}`);
    } finally {
      setGoogleLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Real Upload Pipeline & Stage Polling
  // -------------------------------------------------------------
  const pollUploadStatus = useCallback(
    (uploadId) => {
      const maxPolls = 60;
      let polls = 0;
      const intervalMs = 1200;

      const poll = async () => {
        polls++;
        try {
          const statusData = await getUploadStatus(uploadId);
          const currentStage = statusData?.status || 'pending';
          setPipelineStage(currentStage);

          if (statusData?.message) {
            setStageMessage(statusData.message);
          }

          if (currentStage === 'done') {
            setIsProcessing(false);
            setUploadSuccess(true);
            setStageMessage('Ingestion complete! Tasks and schedules extracted.');
            await refreshCurrentData();
          } else if (currentStage === 'failed') {
            setIsProcessing(false);
            setPipelineStage('failed');
            setErrorMessage(
              statusData?.error_message || 'Document extraction encountered an error on the server.'
            );
          } else if (polls < maxPolls) {
            pollTimerRef.current = setTimeout(poll, intervalMs);
          } else {
            setIsProcessing(false);
            setPipelineStage('failed');
            setErrorMessage('Processing timed out. Please check backend server logs.');
          }
        } catch (err) {
          setIsProcessing(false);
          setPipelineStage('failed');
          setErrorMessage(`Failed to check upload status: ${err.message}`);
        }
      };

      poll();
    },
    [refreshCurrentData]
  );

  const processFile = async (file) => {
    if (!file) return;
    setUploadedFile(file);
    setIsProcessing(true);
    setUploadSuccess(false);
    setErrorMessage('');
    setStageMessage('Uploading file to LifeSync backend...');
    setPipelineStage('pending');

    try {
      const response = await uploadDocument(file, uploadType);
      if (response && response.id) {
        setCurrentUploadId(response.id);
        setStageMessage(`File received (${response.filename}). Starting extraction pipeline...`);
        pollUploadStatus(response.id);
      } else {
        throw new Error('Server did not return a valid upload record.');
      }
    } catch (err) {
      console.warn('Document upload error:', err);
      setIsProcessing(false);
      setPipelineStage('failed');
      setErrorMessage(err.message || 'Failed to upload document to backend.');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const resetUpload = () => {
    setUploadedFile(null);
    setIsProcessing(false);
    setUploadSuccess(false);
    setPipelineStage('idle');
    setStageMessage('');
    setErrorMessage('');
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
  };

  return (
    <div className="workspace-body">
      <div className="workspace-primary-col">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Schedule & Document Ingestion</h1>
            <p style={{ fontSize: '0.84rem', color: '#6B7280' }}>
              Import commitments from Google Calendar or upload academic documents (timetables, syllabi, rubrics).
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className={`pill-eyebrow ${backendOnline ? 'green' : 'coral'}`}>
              {backendOnline ? '● Backend API Connected' : '● Backend Disconnected'}
            </span>
          </div>
        </div>

        {/* =========================================================================
            SECTION 1: GOOGLE CALENDAR ONE-WAY INTEGRATION
           ========================================================================= */}
        <div className="collab-card" style={{ border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.4rem' }}>📅</span>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Google Calendar One-Way Sync</h3>
                <p style={{ fontSize: '0.76rem', color: '#6B7280' }}>
                  Import Google Calendar events into LifeSync tasks with automatic conflict detection.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`pill-eyebrow ${googleConnected ? 'green' : 'neutral'}`}>
                {googleConnected ? `● Connected: ${googleEmail}` : '○ Not Connected'}
              </span>

              {googleConnected ? (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleDisconnectGoogle}
                  disabled={googleLoading}
                  style={{ color: '#B23A3A', borderColor: '#FCA5A5' }}
                >
                  Disconnect
                </button>
              ) : (
                <button
                  className="btn btn-forest btn-sm"
                  onClick={handleConnectGoogle}
                  disabled={googleLoading}
                >
                  🔗 Connect Google Calendar
                </button>
              )}
            </div>
          </div>

          {/* Connected Actions */}
          {googleConnected && (
            <div style={{ marginTop: '12px', padding: '14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <strong style={{ fontSize: '0.84rem' }}>Import Google Events</strong>
                  <div style={{ fontSize: '0.74rem', color: '#6B7280' }}>
                    Sync calendar events for the active semester into your LifeSync database.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleGoogleImportPreview}
                    disabled={googleLoading}
                  >
                    {googleLoading ? 'Checking...' : '🔍 Preview Events'}
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleGoogleImportCommit}
                    disabled={googleLoading}
                  >
                    {googleLoading ? 'Importing...' : '📥 Import to LifeSync'}
                  </button>
                </div>
              </div>

              {/* Preview Feedback */}
              {googlePreview && (
                <div style={{ marginTop: '12px', background: '#FFFFFF', padding: '12px', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1B3B2E', marginBottom: '6px' }}>
                    Found {googlePreview.total_found || 0} events from Google Calendar:
                  </div>
                  <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {(googlePreview.events || []).map((ev, idx) => (
                      <div key={idx} style={{ fontSize: '0.74rem', padding: '4px 8px', background: '#F1F5F9', borderRadius: '4px' }}>
                        📅 <strong>{ev.task || ev.title}</strong> • {ev.scheduledSlot || ev.start_datetime}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Commit Success */}
              {googleCommitSuccess && (
                <div style={{ marginTop: '12px', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '10px 14px', borderRadius: '6px', color: '#065F46', fontSize: '0.82rem' }}>
                  🎉 <strong>Successfully synced!</strong> {googleCommitSuccess.importedCount || googleCommitSuccess.totalProcessed || 0} tasks imported.
                </div>
              )}
            </div>
          )}

          {googleError && (
            <div style={{ marginTop: '10px', background: '#FEE2E2', color: '#991B1B', padding: '10px 14px', borderRadius: '6px', fontSize: '0.8rem' }}>
              ⚠️ {googleError}
            </div>
          )}
        </div>

        {/* =========================================================================
            SECTION 2: DOCUMENT INTELLIGENCE & INGESTION PIPELINE
           ========================================================================= */}
        <div className="collab-card" style={{ border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
          {/* Mode Switcher Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '6px', background: '#F1F5F9', padding: '4px', borderRadius: '10px' }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setInputMode('file')}
                style={{
                  background: inputMode === 'file' ? '#FFFFFF' : 'transparent',
                  color: inputMode === 'file' ? '#1B3B2E' : '#64748B',
                  fontWeight: inputMode === 'file' ? 700 : 500,
                  boxShadow: inputMode === 'file' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  border: 'none',
                  borderRadius: '7px',
                  padding: '6px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>📁 Upload File</span>
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setInputMode('text')}
                style={{
                  background: inputMode === 'text' ? '#FFFFFF' : 'transparent',
                  color: inputMode === 'text' ? '#1B3B2E' : '#64748B',
                  fontWeight: inputMode === 'text' ? 700 : 500,
                  boxShadow: inputMode === 'text' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  border: 'none',
                  borderRadius: '7px',
                  padding: '6px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>📝 Paste Syllabus / Circular</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  background: '#ECFDF5',
                  color: '#065F46',
                  border: '1px solid #A7F3D0',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span>⚡ Groq AI:</span>
                <code>openai/gpt-oss-120b</code>
              </span>
            </div>
          </div>

          {/* MODE 1: FILE DROPZONE */}
          {inputMode === 'file' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: '#6B7280' }}>
                  Document Category / Type
                </label>

                {/* Document Type Dropdown Selector */}
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.84rem',
                    backgroundColor: '#FFFFFF',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {UPLOAD_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Buttons for Document Type */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {UPLOAD_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    className={`btn btn-sm ${uploadType === type.id ? 'btn-forest' : 'btn-secondary'}`}
                    onClick={() => setUploadType(type.id)}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: '0.76rem', color: '#64748B', marginBottom: '12px' }}>
                ℹ️ {UPLOAD_TYPES.find((t) => t.id === uploadType)?.description}
              </div>

              {/* Dropzone */}
              <div
                className="metric-card"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{
                  border: dragOver ? '2px dashed #1B3B2E' : '2px dashed #CBD5E1',
                  background: dragOver ? '#E7F0EA' : '#FFFFFF',
                  textAlign: 'center',
                  padding: '36px 24px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.json,.ics"
                  onChange={handleFileInput}
                  style={{ display: 'none' }}
                />

                {isProcessing ? (
                  <div>
                    <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⏳</div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px' }}>
                      {stageMessage || 'Processing document...'}
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: '#6B7280', marginBottom: '14px' }}>
                      Pipeline Stage: <strong style={{ color: '#1B3B2E' }}>{pipelineStage.toUpperCase()}</strong>
                    </p>

                    {/* Pipeline Stage Tracker */}
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#475569', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: pipelineStage === 'pending' || pipelineStage === 'parsed' ? 700 : 400, color: pipelineStage === 'pending' ? '#B45309' : '#1F5C3D' }}>
                        1. Upload & Parse {pipelineStage !== 'pending' ? '✓' : ''}
                      </span>
                      <span>→</span>
                      <span style={{ fontWeight: pipelineStage === 'extracted' ? 700 : 400, color: pipelineStage === 'extracted' ? '#B45309' : '#1F5C3D' }}>
                        2. Extract Entities {pipelineStage === 'normalized' || pipelineStage === 'done' ? '✓' : ''}
                      </span>
                      <span>→</span>
                      <span style={{ fontWeight: pipelineStage === 'normalized' ? 700 : 400, color: pipelineStage === 'normalized' ? '#B45309' : '#1F5C3D' }}>
                        3. Normalize & Deduplicate {pipelineStage === 'done' ? '✓' : ''}
                      </span>
                      <span>→</span>
                      <span style={{ fontWeight: pipelineStage === 'done' ? 700 : 400, color: '#1F5C3D' }}>
                        4. Complete
                      </span>
                    </div>
                  </div>
                ) : uploadSuccess ? (
                  <div>
                    <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>🎉</div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#15803D', marginBottom: '6px' }}>
                      Document Ingestion Complete!
                    </h3>
                    <p style={{ fontSize: '0.84rem', color: '#475569', marginBottom: '14px' }}>
                      {uploadedFile ? uploadedFile.name : 'File'} successfully processed. Tasks and events have been saved to your database.
                    </p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-forest btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReviewRawText('');
                          setIsReviewOpen(true);
                        }}
                      >
                        ✨ Open Document Intelligence Studio
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          resetUpload();
                        }}
                      >
                        Upload Another Document
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '2.4rem', marginBottom: '10px' }}>📄</div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>
                      Drag & Drop Academic Document Here
                    </h3>
                    <p style={{ fontSize: '0.84rem', color: '#6B7280', marginBottom: '14px' }}>
                      Supports PDF timetables, syllabi, exam rubrics, holiday lists (.pdf, .png, .jpg, .csv, .json, .ics)
                    </p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-forest btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          document.getElementById('file-input')?.click();
                        }}
                      >
                        Browse Computer Files
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInputMode('text');
                        }}
                      >
                        ✍️ Paste Syllabus Text Instead
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MODE 2: DIRECT SYLLABUS & TEXT PASTE */}
          {inputMode === 'text' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: '#6B7280' }}>
                  Paste Syllabus, Timetable, or Circular Text
                </label>

                {/* Quick Sample Selector */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', color: '#64748B' }}>Quick Samples:</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                    onClick={() => setPasteText(SAMPLE_DOCUMENTS.cs450)}
                  >
                    CS450 Distributed
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                    onClick={() => setPasteText(SAMPLE_DOCUMENTS.math201)}
                  >
                    MATH201 Linear Alg
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                    onClick={() => setPasteText(SAMPLE_DOCUMENTS.fest)}
                  >
                    TechFest Circular
                  </button>
                </div>
              </div>

              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={9}
                placeholder="Paste course syllabus, grading breakdown, exam schedules, or lecture times here..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.84rem',
                  fontFamily: 'monospace',
                  backgroundColor: '#F8FAFC',
                  color: '#0F172A',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  lineHeight: 1.45,
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ fontSize: '0.76rem', color: '#64748B' }}>
                  {pasteText.length} characters • Powered by Groq <code>openai/gpt-oss-120b</code>
                </span>

                <button
                  type="button"
                  className="btn btn-forest"
                  style={{
                    padding: '8px 20px',
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(27,59,46,0.25)'
                  }}
                  disabled={!pasteText.trim()}
                  onClick={() => {
                    setReviewRawText(pasteText);
                    setCurrentUploadId(null);
                    setIsReviewOpen(true);
                  }}
                >
                  🚀 Analyze in Document Studio
                </button>
              </div>
            </div>
          )}

          {/* Failure Error Feedback */}
          {errorMessage && (
            <div
              style={{
                marginTop: '14px',
                padding: '12px 16px',
                borderRadius: '8px',
                background: '#FEE2E2',
                color: '#991B1B',
                fontSize: '0.84rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>⚠️ {errorMessage}</div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={resetUpload}
                style={{ background: '#991B1B', color: '#FFF', border: 'none' }}
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Current Database Summary Section */}
        <div className="collab-card" style={{ background: '#FAFDFB', border: '1px solid #D1FAE5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ fontSize: '0.88rem', color: '#065F46' }}>Current Data Store</strong>
              <p style={{ fontSize: '0.76rem', color: '#047857', margin: 0 }}>
                Live counts from your connected LifeSync database.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <span className="pill-eyebrow green" style={{ padding: '4px 10px' }}>
                Tasks: {summaryData.taskCount}
              </span>
              <span className="pill-eyebrow forest" style={{ padding: '4px 10px' }}>
                Events: {summaryData.eventCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      <RightRail />
      <ExtractedReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        uploadId={currentUploadId}
        rawText={reviewRawText}
      />
    </div>
  );
}
