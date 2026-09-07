import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../context/ToastContext';
import { getCourses, planCourseExam, updateCourseSyllabus, deleteCourse } from '../api/client';
import gsap, { prefersReducedMotion } from '../lib/gsap';

function SyllabusProgressBar({ percent, color }) {
  const barRef = useRef(null);

  useEffect(() => {
    if (!barRef.current || prefersReducedMotion()) {
      if (barRef.current) barRef.current.style.width = `${percent}%`;
      return;
    }
    const ctx = gsap.context(() => {
      gsap.to(barRef.current, {
        width: `${percent}%`,
        duration: 0.35,
        ease: 'power2.out',
      });
    }, barRef);
    return () => ctx.revert();
  }, [percent]);

  return (
    <div className="syllabus-bar-track">
      <div
        ref={barRef}
        className="syllabus-bar-fill"
        style={{
          width: `${percent}%`,
          background: color,
        }}
      />
    </div>
  );
}

export default function SyllabusMasteryCard({ onPlanExamStudy }) {
  const toast = useToast();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [boostingId, setBoostingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchCoursesList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCourses();
      if (Array.isArray(data) && data.length > 0) {
        setCourses(
          data.map((c) => ({
            id: c.id,
            code: c.code,
            name: c.name,
            syllabusCovered: c.syllabus_covered_pct ?? 75,
            credits: c.credits ?? 4,
            nextExam: c.next_exam || 'Upcoming Exam',
            examDate: c.exam_date || '',
            color: c.color || '#2563EB',
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoursesList();
  }, [fetchCoursesList]);

  const handleStudyBoost = async (course) => {
    setBoostingId(course.id);
    toast.info(`Generating Spaced Repetition study plan for ${course.code}...`);
    try {
      const res = await planCourseExam(course.id);
      toast.success(`⚡ Created ${res.generated_tasks_count || 'study'} study blocks for ${course.code}!`);
      window.dispatchEvent(new CustomEvent('lifesync:refresh'));
      if (onPlanExamStudy) {
        onPlanExamStudy(course);
      }
    } catch (err) {
      console.error('Exam boost plan failed:', err);
      toast.error(`Could not generate plan for ${course.code}: ${err.response?.data?.detail || err.message}`);
    } finally {
      setBoostingId(null);
    }
  };

  const handleUpdateProgress = async (course, increment) => {
    const current = course.syllabusCovered;
    const nextVal = Math.min(100, Math.max(0, current + increment));
    if (nextVal === current) return;

    // Optimistic update
    setCourses((prev) =>
      prev.map((c) => (c.id === course.id ? { ...c, syllabusCovered: nextVal } : c))
    );

    try {
      await updateCourseSyllabus(course.id, nextVal);
      toast.success(`${course.code} syllabus updated to ${nextVal}%`);
      window.dispatchEvent(new CustomEvent('lifesync:refresh'));
    } catch (err) {
      console.error('Failed to update syllabus:', err);
      toast.error('Failed to save syllabus progress');
      fetchCoursesList();
    }
  };

  const handleDeleteCourse = async (course) => {
    if (!window.confirm(`Are you sure you want to remove ${course.code} (${course.name})?`)) return;
    setDeletingId(course.id);
    try {
      await deleteCourse(course.id);
      toast.info(`Removed course ${course.code}`);
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
      window.dispatchEvent(new CustomEvent('lifesync:refresh'));
    } catch (err) {
      console.error('Failed to delete course:', err);
      toast.error('Could not remove course');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="syllabus-card">
      <div className="syllabus-header">
        <div>
          <span className="rail-widget-title" style={{ margin: 0 }}>Syllabus & Exam Mastery</span>
          <div style={{ fontSize: '0.74rem', color: '#6B7280', marginTop: '2px' }}>
            Active Semester Courses • Exam Readiness Score
          </div>
        </div>
        <span className="pill-eyebrow forest">Fall 2026</span>
      </div>

      {loading && courses.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#6B7280', fontSize: '0.85rem' }}>
          Loading courses & syllabus...
        </div>
      ) : (
        <div className="syllabus-list">
          {courses.map((c) => (
            <div key={c.id} className="syllabus-item">
              <div className="syllabus-item-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    className="course-badge"
                    style={{ background: `${c.color}15`, color: c.color, border: `1px solid ${c.color}30` }}
                  >
                    {c.code}
                  </span>
                  <div>
                    <div className="course-name">{c.name}</div>
                    <div className="course-subtext">{c.credits} Credits • {c.nextExam}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="syllabus-pct" style={{ color: c.syllabusCovered >= 80 ? '#059669' : '#D97706' }}>
                    {c.syllabusCovered}%
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button
                      type="button"
                      onClick={() => handleUpdateProgress(c, 5)}
                      style={{ border: 'none', background: '#F1F5F9', borderRadius: '3px', cursor: 'pointer', fontSize: '0.65rem', padding: '1px 4px', lineHeight: 1 }}
                      title="Increase syllabus progress (+5%)"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateProgress(c, -5)}
                      style={{ border: 'none', background: '#F1F5F9', borderRadius: '3px', cursor: 'pointer', fontSize: '0.65rem', padding: '1px 4px', lineHeight: 1 }}
                      title="Decrease syllabus progress (-5%)"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress bar with smooth GSAP tween */}
              <SyllabusProgressBar percent={c.syllabusCovered} color={c.color} />

              <div className="syllabus-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={() => handleStudyBoost(c)}
                  disabled={boostingId === c.id || deletingId === c.id}
                >
                  {boostingId === c.id ? 'Planning...' : `⚡ Boost Prep (${(c.nextExam || '').split(' in ')[0]})`}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCourse(c)}
                  disabled={deletingId === c.id}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#9CA3AF',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                  title="Remove course"
                  onMouseEnter={(e) => (e.target.style.color = '#EF4444')}
                  onMouseLeave={(e) => (e.target.style.color = '#9CA3AF')}
                >
                  ✕ Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
