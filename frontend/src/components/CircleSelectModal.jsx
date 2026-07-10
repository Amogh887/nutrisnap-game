import { useState, useEffect, useCallback } from 'react';
import { requestApi } from '../apiClient';

const PENDING_COOK_KEY = 'nutrisnap_pending_cook';

export default function CircleSelectModal({ user, recipe, detectedIngredients, onClose, onRequireAuth, onPendingCookChange }) {
  const [circles, setCircles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  const fetchCircles = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await requestApi({
        path: 'circles',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setCircles(await res.json());
      } else {
        setError('Failed to load your circles.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error while loading circles.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchCircles();
    else setIsLoading(false);
  }, [user, fetchCircles]);

  const handlePick = (circle) => {
    const payload = {
      circle_id: circle.id,
      circle_name: circle.name,
      recipe,
      detected_ingredients: detectedIngredients || [],
      started_at: Date.now()
    };
    localStorage.setItem(PENDING_COOK_KEY, JSON.stringify(payload));
    if (onPendingCookChange) onPendingCookChange();
    setConfirmation(circle.name);
  };

  return (
    <>
      <div
        className="sidebar-overlay open"
        onClick={onClose}
        style={{ backdropFilter: 'blur(8px)', zIndex: 1000 }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '100%', maxWidth: '420px', zIndex: 1001, padding: '1rem'
      }}>
        <div className="premium-card fade-in" style={{ padding: '2rem', position: 'relative', maxHeight: '85vh', overflowY: 'auto' }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: '1.2rem', right: '1.2rem',
              background: 'rgba(255,255,255,0.05)', border: 'none',
              color: 'var(--text-secondary)', cursor: 'pointer',
              width: '32px', height: '32px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem'
            }}
          >
            ✕
          </button>

          {confirmation ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem' }}>🔒</div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0.6rem 0' }}>Locked in</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                Cook it, then submit a photo in {confirmation}.
              </p>
              <button className="rounded-btn primary" onClick={onClose} style={{ width: '100%', padding: '0.9rem' }}>
                Got it
              </button>
            </div>
          ) : !user ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>Sign in to compete</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Sign in to cook this dish for one of your circles.
              </p>
              <button
                className="rounded-btn primary"
                onClick={() => { onClose(); onRequireAuth(); }}
                style={{ width: '100%', padding: '0.9rem' }}
              >
                Sign In
              </button>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.3rem 0', letterSpacing: '-0.5px' }}>
                Cook for a circle
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                {recipe?.name}
              </p>

              {isLoading ? (
                <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1.5rem 0' }}>Loading circles...</div>
              ) : error ? (
                <div style={{ color: 'var(--red)', textAlign: 'center', padding: '1rem 0' }}>{error}</div>
              ) : circles.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '1rem 0', lineHeight: 1.5 }}>
                  You are not in any circles yet. Head to the Circles tab to create or join one.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {circles.map((circle) => (
                    <button
                      key={circle.id}
                      onClick={() => handlePick(circle)}
                      style={{
                        width: '100%', padding: '1rem', borderRadius: '14px',
                        background: 'var(--bg-tertiary)', border: '1px solid rgba(255,255,255,0.05)',
                        color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem'
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{circle.name}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {circle.member_count} {circle.member_count === 1 ? 'member' : 'members'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
