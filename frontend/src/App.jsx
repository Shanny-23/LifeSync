import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Calendar from './pages/Calendar';
import Tasks from './pages/Tasks';
import Upload from './pages/Upload';
import StreakDeepDive from './pages/StreakDeepDive';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import AuthModal from './components/AuthModal';
import AICopilotDrawer from './components/AICopilotDrawer';
import './App.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F8FAFC' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🔄</div>
          <div style={{ fontWeight: 600, color: '#14382A', fontSize: '1.1rem' }}>Checking LifeSync Session...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/landing" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Authentication routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signin" element={<Login />} />
      <Route path="/auth" element={<Login />} />

      {/* Public Landing route */}
      <Route element={<Layout />}>
        <Route path="/landing" element={<Landing />} />
      </Route>

      {/* Protected App routes */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/streak-details" element={<StreakDeepDive />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <WorkspaceProvider>
          <BrowserRouter>
            <AuthModal />
            <AICopilotDrawer />
            <AppRoutes />
          </BrowserRouter>
        </WorkspaceProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
