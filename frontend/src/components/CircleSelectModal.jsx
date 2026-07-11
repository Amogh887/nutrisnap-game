import { useState, useEffect, useCallback } from 'react';
import { requestApi } from '../apiClient';
import { CloseIcon, LockIcon, CirclesIcon } from './icons';

const PENDING_COOK_KEY = 'nutrisnap_pending_cook';

export default function CircleSelectModal({ user, recipe, detectedIngredients, onClose, onRequireAuth, onPendingCookChange, onSubmitNow, onCookFirst }) {
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
      <div className="overlay is-open" onClick={onClose} />
      <div className="modal-shell">
        <div className="clay-card modal-card fade-in">
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">
            <CloseIcon size={20} />
          </button>

          {confirmation ? (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              <span className="winner-crest__icon">
                <LockIcon size={28} />
              </span>
              <h2>Locked in</h2>
              <p className="muted" style={{ fontWeight: 600 }}>Cook it, then submit a photo in {confirmation}.</p>
              <button className="clay-btn clay-btn--primary" onClick={onSubmitNow} style={{ width: '100%' }}>Submit photo now</button>
              <button className="clay-btn clay-btn--ghost" onClick={onCookFirst} style={{ width: '100%' }}>I&apos;ll cook it first</button>
            </div>
          ) : !user ? (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              <h2>Sign in to compete</h2>
              <p className="muted" style={{ fontWeight: 600 }}>Sign in to cook this dish for one of your circles.</p>
              <button className="clay-btn clay-btn--primary" onClick={() => { onClose(); onRequireAuth(); }} style={{ width: '100%' }}>Sign in</button>
            </div>
          ) : (
            <>
              <h2>Cook for a circle</h2>
              <p className="muted" style={{ fontWeight: 600, marginBottom: '16px' }}>{recipe?.name}</p>

              {isLoading ? (
                <div className="empty-state"><span className="spinner" /><p>Loading circles...</p></div>
              ) : error ? (
                <div className="banner banner--error"><div className="banner__body">{error}</div></div>
              ) : circles.length === 0 ? (
                <p className="muted" style={{ fontWeight: 600, textAlign: 'center', lineHeight: 1.5 }}>
                  You are not in any circles yet. Head to the Circles tab to create or join one.
                </p>
              ) : (
                <div className="stack" style={{ gap: '10px' }}>
                  {circles.map((circle) => (
                    <button key={circle.id} className="circle-pick" onClick={() => handlePick(circle)}>
                      <span>{circle.name}</span>
                      <span className="muted" style={{ fontWeight: 600, fontSize: 'var(--text-sm)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <CirclesIcon size={15} /> {circle.member_count}
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
