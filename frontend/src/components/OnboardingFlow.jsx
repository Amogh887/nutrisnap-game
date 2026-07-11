import { useState } from 'react';
import { requestApi } from '../apiClient';
import Mascot from './Mascot';
import PreferencesSurvey from './PreferencesSurvey';
import { AlertIcon } from './icons';

export default function OnboardingFlow({ user, onComplete }) {
  const [step, setStep] = useState('name');
  const [name, setName] = useState(user?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const res = await requestApi({
        path: 'profile',
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ profile: { display_name: trimmed } })
      });
      if (res.ok) {
        setStep('prefs');
      } else {
        setError('Could not save your name. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (step === 'prefs') {
    return (
      <PreferencesSurvey
        variant="page"
        user={user}
        onSaved={onComplete}
        onBack={() => setStep('name')}
        stepIndex={1}
        stepCount={2}
      />
    );
  }

  return (
    <div className="onboarding">
      <div className="onboarding__inner fade-in">
        <div className="onboarding__progress" aria-hidden="true">
          <span className="onboarding__dot is-active" />
          <span className="onboarding__dot" />
        </div>

        <div className="onboarding__head">
          <Mascot pose="happy" size={96} title="NutriSnap chef mascot" />
          <h1>What should we call you?</h1>
          <p>This is the name your circles will see on the leaderboard.</p>
        </div>

        <div>
          <label className="field-label" htmlFor="onboard-name">Display name</label>
          <input
            id="onboard-name"
            type="text"
            className="clay-input"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
            autoFocus
          />
          {error && (
            <div className="banner banner--error" style={{ marginTop: '12px' }}>
              <div className="banner__body" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <AlertIcon size={18} /> {error}
              </div>
            </div>
          )}
        </div>

        <div className="onboarding__actions">
          <button
            onClick={handleContinue}
            disabled={saving || !name.trim()}
            className="clay-btn clay-btn--primary"
            style={{ width: '100%' }}
          >
            {saving ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
