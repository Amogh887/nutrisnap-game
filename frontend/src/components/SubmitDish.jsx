import { useState, useEffect } from 'react';
import { requestApi } from '../apiClient';

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
      <div
        className="sidebar-overlay open"
        onClick={onClose}
        style={{ backdropFilter: 'blur(8px)', zIndex: 1000 }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '100%', maxWidth: '440px', zIndex: 1001, padding: '1rem'
      }}>
        <div className="premium-card fade-in" style={{ padding: '2rem', position: 'relative', maxHeight: '88vh', overflowY: 'auto' }}>
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

          {isScored ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem' }}>🎉</div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0.4rem 0' }}>{result.points} points!</h2>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>{recipeName}</p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <span style={{ padding: '5px 12px', background: 'rgba(10, 132, 255, 0.15)', color: 'var(--blue)', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>
                  difficulty {result.difficulty}
                </span>
                <span style={{ padding: '5px 12px', background: 'rgba(48, 209, 88, 0.15)', color: 'var(--green)', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>
                  stretch {result.stretch}
                </span>
              </div>
              {result.feedback && (
                <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>{result.feedback}</p>
              )}
              <button className="rounded-btn primary" onClick={onClose} style={{ width: '100%', padding: '0.9rem' }}>
                Done
              </button>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.3rem 0', letterSpacing: '-0.5px' }}>
                Submit your dish
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                {recipeName}
              </p>

              {isRejected && (
                <div style={{ padding: '14px', background: 'rgba(255, 69, 58, 0.1)', borderRadius: '12px', border: '1px solid rgba(255, 69, 58, 0.2)', marginBottom: '1.5rem' }}>
                  <div style={{ color: 'var(--red)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>Not verified — try another photo</div>
                  {result.feedback && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 0.5rem 0', lineHeight: 1.4 }}>{result.feedback}</p>
                  )}
                  {result.reasons?.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                      {result.reasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {error && (
                <div style={{ padding: '12px', background: 'rgba(255, 69, 58, 0.1)', color: 'var(--red)', borderRadius: '12px', fontSize: '0.9rem', marginBottom: '1.5rem', border: '1px solid rgba(255, 69, 58, 0.2)' }}>
                  {error}
                </div>
              )}

              <label
                style={{
                  display: 'block', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '16px',
                  padding: preview ? '0.5rem' : '2rem 1rem', textAlign: 'center', cursor: 'pointer',
                  marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)'
                }}
              >
                {preview ? (
                  <img src={preview} alt="Dish preview" style={{ width: '100%', maxHeight: '260px', objectFit: 'cover', borderRadius: '12px' }} />
                ) : (
                  <div style={{ color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📷</div>
                    <div style={{ fontSize: '0.9rem' }}>Tap to take or choose a photo</div>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </label>

              <button
                className="rounded-btn primary"
                onClick={handleSubmit}
                disabled={!file || submitting}
                style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', fontWeight: 600 }}
              >
                {submitting ? 'Judging your dish…' : 'Submit dish'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
