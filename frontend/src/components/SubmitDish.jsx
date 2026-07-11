import { useState, useEffect } from 'react';
import { requestApi } from '../apiClient';
import Confetti from './Confetti';
import CountUp from './CountUp';
import { CameraIcon, CloseIcon, AlertIcon } from './icons';

const PENDING_COOK_KEY = 'nutrisnap_pending_cook';

export default function SubmitDish({ user, circleId, pendingCook, onClose, onSubmitted, onPendingCookChange }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [recipeName] = useState(pendingCook?.recipe?.name || 'your dish');

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError('');
      setResult(null);
    }
  };

  const handleSubmit = async () => {
    if (!file || submitting || !pendingCook) return;
    setSubmitting(true);
    setError('');
    setResult(null);
    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append('image', file);
      formData.append('recipe', JSON.stringify(pendingCook.recipe));
      formData.append('detected_ingredients', JSON.stringify(pendingCook.detected_ingredients || []));

      const res = await requestApi({
        path: `circles/${circleId}/submissions`,
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        if (data.status === 'scored') {
          localStorage.removeItem(PENDING_COOK_KEY);
          if (onPendingCookChange) onPendingCookChange();
          if (onSubmitted) onSubmitted();
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || `Submission failed (${res.status}).`);
      }
    } catch (err) {
      console.error(err);
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isScored = result?.status === 'scored';
  const isRejected = result?.status === 'rejected';

  return (
    <>
      <Confetti active={isScored} />
      <div className="overlay is-open" onClick={onClose} />
      <div className="modal-shell">
        <div className="clay-card modal-card fade-in">
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">
            <CloseIcon size={20} />
          </button>

          {isScored ? (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              <span className="pill pill--points" style={{ fontSize: 'var(--text-2xl)', padding: '12px 24px' }}>
                <CountUp value={result.points} /> pts
              </span>
              <h2>Dish verified</h2>
              <p className="muted" style={{ fontWeight: 600 }}>{recipeName}</p>
              <div className="row-wrap" style={{ justifyContent: 'center' }}>
                <span className="pill pill--blue">difficulty {result.difficulty}</span>
                <span className="pill pill--mint">stretch {result.stretch}</span>
              </div>
              {result.feedback && <p style={{ fontWeight: 600, lineHeight: 1.5 }}>{result.feedback}</p>}
              <button className="clay-btn clay-btn--primary" onClick={onClose} style={{ width: '100%' }}>Done</button>
            </div>
          ) : (
            <>
              <h2>Submit your dish</h2>
              <p className="muted" style={{ fontWeight: 600, marginBottom: '16px' }}>{recipeName}</p>

              {isRejected && (
                <div className="banner banner--error" style={{ flexDirection: 'column', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div className="banner__body" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <AlertIcon size={18} /> Not verified — try another photo
                  </div>
                  {result.feedback && <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)', lineHeight: 1.4 }}>{result.feedback}</p>}
                  {result.reasons?.length > 0 && (
                    <ul className="recipe-list" style={{ fontSize: 'var(--text-sm)' }}>
                      {result.reasons.map((reason, idx) => <li key={idx}>{reason}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {error && (
                <div className="banner banner--error" style={{ marginBottom: '16px' }}>
                  <div className="banner__body">{error}</div>
                </div>
              )}

              <label className="upload-dropzone" style={{ marginBottom: '16px', minHeight: preview ? 'auto' : '180px', padding: preview ? '8px' : 'var(--space-lg)' }}>
                {preview ? (
                  <img src={preview} alt="Dish preview" style={{ width: '100%', maxHeight: '260px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                ) : (
                  <>
                    <span className="upload-dropzone__icon"><CameraIcon size={28} /></span>
                    <span>Tap to take or choose a photo</span>
                  </>
                )}
                <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} style={{ display: 'none' }} />
              </label>

              <button className="clay-btn clay-btn--primary" onClick={handleSubmit} disabled={!file || submitting} style={{ width: '100%' }}>
                {submitting ? 'Judging your dish…' : 'Submit dish'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
