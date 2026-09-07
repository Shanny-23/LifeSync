import React, { createContext, useContext, useState, useEffect } from 'react';
import { DEMO_PROFILES, DEFAULT_DEMO_USER, getFirebaseAuth, isFirebaseLive } from '../services/firebase';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem('lifesync_user');
      return cached ? JSON.parse(cached) : DEFAULT_DEMO_USER;
    } catch {
      return DEFAULT_DEMO_USER;
    }
  });

  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('lifesync_token') || DEFAULT_DEMO_USER.token;
    } catch {
      return DEFAULT_DEMO_USER.token;
    }
  });

  const [loading, setLoading] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { addToast } = useToast();

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  // Switch demo persona
  const loginWithDemo = (uid) => {
    const target = DEMO_PROFILES.find((p) => p.uid === uid) || DEFAULT_DEMO_USER;
    setUser(target);
    setToken(target.token);
    try {
      localStorage.setItem('lifesync_user', JSON.stringify(target));
      localStorage.setItem('lifesync_token', target.token);
    } catch (e) {
      console.warn("Storage error:", e);
    }
    addToast(`Switched account to ${target.name} (${target.major})`, 'success');
    closeAuthModal();
  };

  // Google Sign-In
  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      if (isFirebaseLive()) {
        const fb = await getFirebaseAuth();
        if (fb) {
          const { signInWithPopup } = await import('firebase/auth');
          const result = await signInWithPopup(fb.auth, fb.provider);
          const fbUser = result.user;
          const idToken = await fbUser.getIdToken();

          const newUser = {
            uid: fbUser.uid,
            name: fbUser.displayName || fbUser.email.split('@')[0],
            email: fbUser.email,
            major: "Student",
            avatar: fbUser.photoURL || DEFAULT_DEMO_USER.avatar,
            role: "student",
            streak_days: 1,
            completion_rate: 100,
            token: idToken
          };
          setUser(newUser);
          setToken(idToken);
          localStorage.setItem('lifesync_user', JSON.stringify(newUser));
          localStorage.setItem('lifesync_token', idToken);
          addToast(`Welcome back, ${newUser.name}!`, 'success');
          closeAuthModal();
          return;
        }
      }

      // Fallback if Firebase keys are not provisioned in client .env
      addToast("Firebase client keys not detected in .env; signed in as demo student persona.", "warning");
      loginWithDemo("demo_user_1");
    } catch (error) {
      console.error("Google sign in error:", error);
      addToast(`Authentication note: ${error.message}`, "alert");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(DEFAULT_DEMO_USER);
    setToken(DEFAULT_DEMO_USER.token);
    localStorage.removeItem('lifesync_user');
    localStorage.removeItem('lifesync_token');
    addToast("Logged out of session. Switched to guest mode.", "info");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        loginWithDemo,
        loginWithGoogle,
        logout,
        availableProfiles: DEMO_PROFILES
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
