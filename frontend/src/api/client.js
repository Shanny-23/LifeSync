/**
 * LifeSync API Client
 * Configurable base URL with automated error handling and REST methods.
 */

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000';

/**
 * Custom request helper with timeout and clear error messaging.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('lifesync_token') : null;
  const config = {
    ...options,
    credentials: 'include',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      let errorDetail = response.statusText;
      try {
        const errorJson = await response.json();
        errorDetail = errorJson.detail || errorJson.message || JSON.stringify(errorJson);
      } catch {
        // use statusText fallback
      }
      const error = new Error(errorDetail || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }

    return await response.json();
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      const networkError = new Error(
        `Backend unreachable at ${API_BASE_URL}. Please ensure the server is running.`
      );
      networkError.isNetworkError = true;
      throw networkError;
    }
    throw err;
  }
}

// -------------------------------------------------------------
// Auth API
// -------------------------------------------------------------
export async function getMe() {
  return request('/api/auth/me');
}

export async function logout() {
  return request('/api/auth/logout', { method: 'POST' });
}

export function loginWithGoogle() {
  window.location.href = `${API_BASE_URL}/api/auth/google/login`;
}

export async function loginWithEmail(email, password = '') {
  return request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function registerUser({ email, name, password = '', major = 'Computer Science & AI' }) {
  return request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, password, major }),
  });
}

export async function loginWithDemoApi(persona = 'demo_user_1') {
  return request('/api/auth/demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona }),
  });
}

// -------------------------------------------------------------
// Tasks API
// -------------------------------------------------------------
export async function getTasks(params = {}) {
  const query = new URLSearchParams();
  if (params.status && params.status !== 'all') query.append('status', params.status);
  if (params.type && params.type !== 'all') query.append('type', params.type);
  if (params.category && params.category !== 'all') query.append('category', params.category);
  if (params.urgency && params.urgency !== 'all') query.append('urgency', params.urgency);
  if (params.search && params.search.trim()) query.append('search', params.search.trim());

  const queryString = query.toString() ? `?${query.toString()}` : '';
  return request(`/api/tasks${queryString}`);
}

export async function getTaskById(taskId) {
  return request(`/api/tasks/${taskId}`);
}

export async function recalculatePriorities() {
  return request('/api/tasks/recalculate-priority', { method: 'POST' });
}

export async function createTask(taskData) {
  return request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData),
  });
}

export async function updateTask(taskId, updates) {
  return request(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export async function deleteTask(taskId) {
  return request(`/api/tasks/${taskId}`, {
    method: 'DELETE',
  });
}

// -------------------------------------------------------------
// Schedule API
// -------------------------------------------------------------
export async function getSchedule(params = {}) {
  const query = new URLSearchParams();
  if (params.from) query.append('from', params.from);
  if (params.to) query.append('to', params.to);
  if (params.status && params.status !== 'all') query.append('status', params.status);
  if (params.slot_type) query.append('slot_type', params.slot_type);

  const queryString = query.toString() ? `?${query.toString()}` : '';
  return request(`/api/schedule${queryString}`);
}

export async function generateSchedule(daysAhead = 7) {
  return request(`/api/schedule/generate?days_ahead=${daysAhead}`, { method: 'POST' });
}

export async function resolveConflicts(daysAhead = 7) {
  return request(`/api/schedule/resolve-conflicts?days_ahead=${daysAhead}`, { method: 'POST' });
}

export async function getConflicts(limit = 50) {
  return request(`/api/schedule/conflicts?limit=${limit}`);
}

// -------------------------------------------------------------
// Events API
// -------------------------------------------------------------
export async function getEvents(params = {}) {
  const query = new URLSearchParams();
  if (params.type && params.type !== 'all') query.append('type', params.type);
  if (params.category && params.category !== 'all') query.append('category', params.category);
  if (params.from) query.append('from', params.from);
  if (params.to) query.append('to', params.to);

  const queryString = query.toString() ? `?${query.toString()}` : '';
  return request(`/api/events${queryString}`);
}

// -------------------------------------------------------------
// Document Uploads & Background Ingestion Pipeline
// -------------------------------------------------------------
export async function uploadDocument(file, type = 'timetable') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);

  return request('/api/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function getUploadStatus(uploadId) {
  return request(`/api/upload/${uploadId}/status`);
}

export async function listUploads() {
  return request('/api/uploads');
}

export async function getUploadById(uploadId) {
  return request(`/api/uploads/${uploadId}`);
}

// -------------------------------------------------------------
// Exam Study Planner API
// -------------------------------------------------------------
export async function generateExamPlan(taskId) {
  return request(`/api/exam-planner/generate/${taskId}`, { method: 'POST' });
}

// -------------------------------------------------------------
// Health Check
// -------------------------------------------------------------
export async function getHealth() {
  return request('/health');
}

// -------------------------------------------------------------
// Google Calendar Integration
// -------------------------------------------------------------
export async function getGoogleStatus() {
  return request('/api/google/status');
}

export function connectGoogle() {
  window.location.href = `${API_BASE_URL}/api/google/auth`;
}

export async function disconnectGoogle() {
  return request('/api/google/disconnect', { method: 'POST' });
}

export async function importGoogleCalendar({ commit = false, timeMin, timeMax } = {}) {
  const params = new URLSearchParams();
  if (commit) params.append('commit', 'true');
  if (timeMin) params.append('timeMin', timeMin);
  if (timeMax) params.append('timeMax', timeMax);
  const queryString = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/google/sync/import${queryString}`, { method: 'POST' });
}

// -------------------------------------------------------------
// AI Document Analysis API
// -------------------------------------------------------------
export async function analyzeDocument({ text, uploadId, groqKey } = {}) {
  return request('/api/ai/analyze-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: text || undefined,
      upload_id: uploadId || undefined,
      groq_key: groqKey || undefined,
    }),
  });
}

export async function commitExtractedItems({ assignments = [], exams = [], events = [], holidays = [] }) {
  return request('/api/ai/commit-extracted', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignments, exams, events, holidays }),
  });
}

// -------------------------------------------------------------
// Focus Sessions API
// -------------------------------------------------------------
export async function getFocusStats() {
  return request('/api/focus/stats');
}

export async function completeFocusSession({
  mode = 'POMODORO',
  duration_seconds = 1500,
  target_name = null,
  task_id = null
} = {}) {
  return request('/api/focus/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode,
      duration_seconds,
      target_name,
      task_id,
      completed: true,
    }),
  });
}

// -------------------------------------------------------------
// Courses & Syllabus Mastery API
// -------------------------------------------------------------
export async function getCourses() {
  return request('/api/courses');
}

export async function createCourse(courseData) {
  return request('/api/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(courseData),
  });
}

export async function updateCourseSyllabus(courseId, syllabusCoveredPct) {
  return request(`/api/courses/${courseId}/syllabus`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ syllabus_covered_pct: syllabusCoveredPct }),
  });
}

export async function planCourseExam(courseId) {
  return request(`/api/courses/${courseId}/plan-exam`, { method: 'POST' });
}

export async function deleteCourse(courseId) {
  return request(`/api/courses/${courseId}`, { method: 'DELETE' });
}

export default {
  API_BASE_URL,
  getHealth,
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  recalculatePriorities,
  getSchedule,
  generateSchedule,
  resolveConflicts,
  getConflicts,
  getEvents,
  uploadDocument,
  getUploadStatus,
  listUploads,
  getUploadById,
  generateExamPlan,
  getGoogleStatus,
  connectGoogle,
  disconnectGoogle,
  importGoogleCalendar,
  getMe,
  logout,
  loginWithGoogle,
  analyzeDocument,
  commitExtractedItems,
  getFocusStats,
  completeFocusSession,
  getCourses,
  createCourse,
  updateCourseSyllabus,
  planCourseExam,
  deleteCourse,
};
