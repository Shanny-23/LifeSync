import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getMe,
  logout as logoutApi,
  loginWithGoogle as triggerGoogleLogin,
  loginWithEmail as loginWithEmailApi,
  registerUser as registerUserApi,
  loginWithDemoApi
} from '../api/client';
import { DEMO_PROFILES, getFirebaseAuth, isFirebaseLive } from '../services/firebase';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem('lifesync_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { addToast } = useToast();

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  // Check current session from backend /api/auth/me
  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const userData = await getMe();
      if (userData && (userData.id || userData.email || userData.google_id)) {
        const enrichedUser = {
          ...userData,
          uid: userData.google_id || userData.id?.toString(),
          avatar: userData.picture_url || userData.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          major: userData.major || 'Computer Science & AI',
          streak_days: userData.streak_days ?? 12,
          completion_rate: userData.completion_rate ?? 88,
        };
        setUser(enrichedUser);
        localStorage.setItem('lifesync_user', JSON.stringify(enrichedUser));
        return enrichedUser;
      } else {
        setUser(null);
        localStorage.removeItem('lifesync_user');
        return null;
      }
    } catch (err) {
      if (!localStorage.getItem('lifesync_token')) {
        setUser(null);
        localStorage.removeItem('lifesync_user');
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Check URL query params for session tokens or OAuth errors on callback redirect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('lifesync_token', token);
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      checkAuth().then(() => {
        addToast('Successfully authenticated with LifeSync!', 'success');
      });
      return;
    }
    const authError = params.get('auth_error');
    if (authError) {
      addToast(`Authentication notice: ${decodeURIComponent(authError)}`, 'error');
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, [addToast, checkAuth]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Sign In with Email & Password
  const loginWithEmail = async (email, password = '') => {
    setLoading(true);
    try {
      const res = await loginWithEmailApi(email, password);
      if (res && res.token) {
        localStorage.setItem('lifesync_token', res.token);
      }
      if (res && res.user) {
        const enriched = {
          ...res.user,
          avatar: res.user.picture_url || res.user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          major: res.user.major || 'Computer Science & AI',
          streak_days: res.user.streak_days ?? 12,
          completion_rate: res.user.completion_rate ?? 88,
        };
        setUser(enriched);
        localStorage.setItem('lifesync_user', JSON.stringify(enriched));
      }
      closeAuthModal();
      addToast(`Welcome back, ${res?.user?.name || 'Student'}!`, 'success');
      return true;
    } catch (err) {
      console.error('Email login error:', err);
      addToast(err.message || 'Failed to sign in. Please verify your credentials.', 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Register New Account
  const register = async ({ email, name, password = '', major = 'Computer Science & AI' }) => {
    setLoading(true);
    try {
      const res = await registerUserApi({ email, name, password, major });
      if (res && res.token) {
        localStorage.setItem('lifesync_token', res.token);
      }
      if (res && res.user) {
        const enriched = {
          ...res.user,
          avatar: res.user.picture_url || res.user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          major: major,
          streak_days: 1,
          completion_rate: 100,
        };
        setUser(enriched);
        localStorage.setItem('lifesync_user', JSON.stringify(enriched));
      }
      closeAuthModal();
      addToast(`Account created! Welcome, ${name}!`, 'success');
      return true;
    } catch (err) {
      console.error('Register error:', err);
      addToast(err.message || 'Failed to register account. Please check the fields.', 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-In: Firebase popup if live, otherwise redirect to backend OAuth2 flow
  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      if (isFirebaseLive()) {
        const fb = await getFirebaseAuth();
        if (fb && fb.auth && fb.provider) {
          const { signInWithPopup } = await import('firebase/auth');
          const result = await signInWithPopup(fb.auth, fb.provider);
          const idToken = await result.user.getIdToken();
          localStorage.setItem('lifesync_token', idToken);
          addToast(`Welcome back, ${result.user.displayName || 'Student'}!`, 'success');
          closeAuthModal();
          await checkAuth();
          return;
        }
      }
    } catch (err) {
      console.warn('Firebase popup sign-in encountered error, falling back to backend redirect:', err);
    } finally {
      setLoading(false);
    }

    // Direct redirect to backend OAuth2 endpoint
    triggerGoogleLogin();
  };

  // Switch demo persona instantly with robust backend session sync
  const loginWithDemo = async (personaUid) => {
    setLoading(true);
    const persona = DEMO_PROFILES.find((p) => p.uid === personaUid) || DEMO_PROFILES[0];
    try {
      const res = await loginWithDemoApi(persona.uid);
      if (res && res.token) {
        localStorage.setItem('lifesync_token', res.token);
      }
      if (res && res.user) {
        const enriched = {
          ...res.user,
          avatar: res.user.avatar || res.user.picture_url || persona.avatar,
          major: res.user.major || persona.major,
          streak_days: res.user.streak_days || persona.streak_days,
          completion_rate: res.user.completion_rate || persona.completion_rate,
        };
        setUser(enriched);
        localStorage.setItem('lifesync_user', JSON.stringify(enriched));
      }
    } catch (backendErr) {
      console.warn('Demo session check fallback to local credentials:', backendErr);
      localStorage.setItem('lifesync_token', persona.token);
      const demoUser = {
        ...persona,
        id: persona.uid,
        google_id: persona.uid,
        picture_url: persona.avatar,
      };
      setUser(demoUser);
      localStorage.setItem('lifesync_user', JSON.stringify(demoUser));
    } finally {
      setLoading(false);
    }

    addToast(`Switched account to ${persona.name}`, 'success');
    closeAuthModal();
    return true;
  };

  // Logout session
  const logout = async () => {
    try {
      await logoutApi();
    } catch (e) {
      console.warn('Logout API error:', e);
    }
    setUser(null);
    localStorage.removeItem('lifesync_user');
    localStorage.removeItem('lifesync_token');
    addToast('Signed out of session.', 'info');
    window.location.href = '/landing';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        loginWithEmail,
        register,
        loginWithGoogle,
        loginWithDemo,
        availableProfiles: DEMO_PROFILES,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

