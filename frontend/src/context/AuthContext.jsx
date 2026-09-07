import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe, logout as logoutApi, loginWithGoogle as triggerGoogleLogin } from '../api/client';
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

  // Check URL query params for OAuth errors on callback redirect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('auth_error');
    if (authError) {
      addToast(`Google authentication notice: ${decodeURIComponent(authError)}`, 'error');
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, [addToast]);

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
      } else {
        setUser(null);
        localStorage.removeItem('lifesync_user');
      }
    } catch (err) {
      // 401 or network error when unauthenticated
      if (!localStorage.getItem('lifesync_token')) {
        setUser(null);
        localStorage.removeItem('lifesync_user');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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

  // Switch demo persona instantly
  const loginWithDemo = async (personaUid) => {
    const persona = DEMO_PROFILES.find((p) => p.uid === personaUid) || DEMO_PROFILES[0];
    localStorage.setItem('lifesync_token', persona.token);
    const demoUser = {
      ...persona,
      id: persona.uid,
      google_id: persona.uid,
      picture_url: persona.avatar,
    };
    setUser(demoUser);
    localStorage.setItem('lifesync_user', JSON.stringify(demoUser));
    addToast(`Switched account to ${persona.name}`, 'success');
    closeAuthModal();

    // Verify against backend to seed user record in database
    try {
      await checkAuth();
    } catch (e) {
      console.warn('Demo session check against backend:', e);
    }
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
