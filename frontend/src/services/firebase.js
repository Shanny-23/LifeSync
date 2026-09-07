// LifeSync Firebase Authentication & Multi-Tenant Identity Provider

// Read configuration from Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

let authInstance = null;
let googleProvider = null;
let isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Dynamic initialization of Firebase SDK if config is provided
export async function getFirebaseAuth() {
  if (!isFirebaseConfigured) {
    return null;
  }
  if (!authInstance) {
    try {
      const { initializeApp } = await import('firebase/app');
      const { getAuth, GoogleAuthProvider } = await import('firebase/auth');
      const app = initializeApp(firebaseConfig);
      authInstance = getAuth(app);
      googleProvider = new GoogleAuthProvider();
    } catch (err) {
      console.warn("Failed to initialize Firebase client SDK:", err);
      return null;
    }
  }
  return { auth: authInstance, provider: googleProvider };
}

export function isFirebaseLive() {
  return isFirebaseConfigured;
}

// Student demo personas for testing and presentation
export const DEMO_PROFILES = [
  {
    uid: "demo_user_1",
    name: "Alex Morgan",
    email: "alex.morgan@university.edu",
    major: "Computer Science & AI",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    role: "student",
    streak_days: 12,
    completion_rate: 88,
    token: "demo-token-demo_user_1"
  },
  {
    uid: "demo_user_2",
    name: "Sarah Chen",
    email: "sarah.chen@university.edu",
    major: "Biomedical Engineering",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    role: "student",
    streak_days: 19,
    completion_rate: 94,
    token: "demo-token-demo_user_2"
  }
];

export const DEFAULT_DEMO_USER = DEMO_PROFILES[0];
