import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAtkcQhcRRHggZHqlewdMt3c4_8CmICHnk",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "claude-hacka.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "claude-hacka",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "claude-hacka.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "375573010504",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:375573010504:web:8a1d96e3896508eacaa07d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export default app;
