import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { requestApi } from './apiClient';
import Mascot from './components/Mascot';
import { AlertIcon } from './components/icons';

function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const signedInUser = result.user;
      const token = await signedInUser.getIdToken();
      await requestApi({
        path: 'profile',
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profile: {
            display_name: signedInUser.displayName,
            photo_url: signedInUser.photoURL
          }
        })
      });
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-inner fade-in">
        <div className="auth-hero">
          <Mascot pose="wave" size={104} animate title="NutriSnap chef mascot" />
          <span className="auth-wordmark">NutriSnap</span>
          <p className="auth-tagline">Snap your ingredients, cook with friends, win the week.</p>
        </div>

        {error && (
          <div className="banner banner--error" style={{ width: '100%' }}>
            <div className="banner__body" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <AlertIcon size={18} /> {error}
            </div>
          </div>
        )}

        <div className="auth-actions">
          <button className="google-btn" onClick={handleGoogle} disabled={loading}>
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            Continue with Google
          </button>
        </div>

        <div className="divider" style={{ width: '100%' }}>or use email</div>

        <div className="auth-secondary">
          <div>
            <label className="field-label" htmlFor="auth-email" style={{ textAlign: 'left' }}>Email address</label>
            <input
              id="auth-email"
              type="email"
              className="clay-input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="auth-password" style={{ textAlign: 'left' }}>Password</label>
            <input
              id="auth-password"
              type="password"
              className="clay-input"
              placeholder="Your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <button className="clay-btn clay-btn--ghost" onClick={handleSubmit} disabled={loading} style={{ width: '100%', marginTop: '4px' }}>
            {loading ? 'Please wait...' : isLogin ? 'Sign in with email' : 'Sign up with email'}
          </button>
        </div>

        <p className="auth-toggle">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button className="link-strong" onClick={() => { setIsLogin(!isLogin); setError(''); }}>
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}

export default AuthScreen;
