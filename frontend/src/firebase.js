import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBV7V78tNmw4XtqPFp9oOou1rlsYj0fW3Q",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "nutrisnap-488820.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "nutrisnap-488820",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "nutrisnap-488820.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "35949888118",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:35949888118:web:24f530ef712773fb77d557"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export default app;
