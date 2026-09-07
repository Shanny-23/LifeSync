import { useState } from 'react';
import { useToast } from '../context/ToastContext';

const INITIAL_COURSES = [
  {
    id: 'cs101',
    code: 'CS101',
    name: 'Data Structures & Algorithms',
    syllabusCovered: 82,
    credits: 4,
    nextExam: 'CAT-1 in 4 days',
    examDate: '2026-09-11',
    color: '#2563EB',
  },
  {
    id: 'math204',
    code: 'MATH204',
    name: 'Linear Algebra & Calculus',
    syllabusCovered: 64,
    credits: 4,
    nextExam: 'Midterm in 8 days',
    examDate: '2026-09-15',
    color: '#7C3AED',
  },
  {
    id: 'phy102',
    code: 'PHY102',
    name: 'Engineering Physics & Labs',
    syllabusCovered: 90,
    credits: 3,
    nextExam: 'Lab FAT in 14 days',
    examDate: '2026-09-21',
    color: '#059669',
  },
];

export default function SyllabusMasteryCard({ onPlanExamStudy }) {
  const toast = useToast();
  const [courses, setCourses] = useState(INITIAL_COURSES);

  const handleStudyBoost = (course) => {
    toast.info(`Generating Spaced Repetition study plan for ${course.code}...`);
    if (onPlanExamStudy) {
      onPlanExamStudy(course);
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
              <div style={{ textAlign: 'right' }}>
                <span className="syllabus-pct" style={{ color: c.syllabusCovered >= 80 ? '#059669' : '#D97706' }}>
                  {c.syllabusCovered}%
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="syllabus-bar-track">
              <div
                className="syllabus-bar-fill"
                style={{
                  width: `${c.syllabusCovered}%`,
                  background: c.color,
                }}
              />
            </div>

            <div className="syllabus-actions">
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => handleStudyBoost(c)}
              >
                ⚡ Boost Prep ({c.nextExam.split(' in ')[0]})
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
