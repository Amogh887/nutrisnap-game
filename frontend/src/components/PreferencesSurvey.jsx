import { useState, useEffect } from 'react';
import { requestApi } from '../apiClient';
import { CloseIcon, CheckIcon, AlertIcon, ArrowLeftIcon } from './icons';

export default function PreferencesSurvey({
  isOpen,
  onClose,
  user,
  variant = 'sheet',
  onSaved,
  onBack,
  stepIndex = 1,
  stepCount = 2,
}) {
  const isPage = variant === 'page';
  const [preferences, setPreferences] = useState({
    health_goal: 'balanced',
    diet_type: 'non-vegetarian',
    allergies: 'none',
    cooking_time: 'moderate',
    cuisine_preferences: 'any',
    calorie_target: 'not specified',
    cost_preference: '$$',
    spice_level: 'Medium',
    ease_of_cooking: 'Intermediate',
    has_onboarded: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    if ((isPage || isOpen) && user) {
      fetchPreferences();
    }
  }, [isOpen, user, isPage]);

  const fetchPreferences = async () => {
    try {
      const token = await user.getIdToken();
      const res = await requestApi({
        path: 'preferences',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPreferences(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error('Failed to fetch preferences', err);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsLoading(true);
    setSaveStatus('saving');
    try {
      const token = await user.getIdToken();
      const res = await requestApi({
        path: 'preferences',
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...preferences, has_onboarded: true })
      });

      if (res.ok) {
        setSaveStatus('saved');
        if (isPage) {
          if (onSaved) onSaved();
        } else {
          setTimeout(() => onClose(), 1000);
        }
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const OptionButton = ({ label, field, value }) => {
    const isSelected = preferences[field] === value;
    return (
      <button
        type="button"
        className={`opt-btn ${isSelected ? 'is-selected' : ''}`}
        aria-pressed={isSelected}
        onClick={() => setPreferences({ ...preferences, [field]: value })}
      >
        {label}
      </button>
    );
  };

  const form = (
    <div className="form-grid" style={{ gap: '18px' }}>
      <div className="pref-group">
        <span className="field-label">Budget per meal</span>
        <div className="row-wrap">
          <OptionButton label="$ Cheap" field="cost_preference" value="$" />
          <OptionButton label="$$ Moderate" field="cost_preference" value="$$" />
          <OptionButton label="$$$ Premium" field="cost_preference" value="$$$" />
        </div>
      </div>

      <div className="pref-group">
        <span className="field-label">Cooking time</span>
        <div className="row-wrap">
          <OptionButton label="Under 15 min" field="cooking_time" value="fast" />
          <OptionButton label="Under 30 min" field="cooking_time" value="moderate" />
          <OptionButton label="Any time" field="cooking_time" value="any" />
        </div>
      </div>

      <div className="pref-group">
        <span className="field-label">Spice level</span>
        <div className="row-wrap">
          <OptionButton label="Mild" field="spice_level" value="Mild" />
          <OptionButton label="Medium" field="spice_level" value="Medium" />
          <OptionButton label="Hot" field="spice_level" value="Hot" />
        </div>
      </div>

      <div className="pref-group">
        <span className="field-label">Diet type</span>
        <div className="row-wrap">
          <OptionButton label="Anything" field="diet_type" value="non-vegetarian" />
          <OptionButton label="Vegetarian" field="diet_type" value="vegetarian" />
          <OptionButton label="Vegan" field="diet_type" value="vegan" />
          <OptionButton label="Keto" field="diet_type" value="keto" />
        </div>
        <input
          type="text"
          className="clay-input"
          placeholder="Or a custom diet (e.g. Paleo, Halal)"
          aria-label="Custom diet type"
          value={['non-vegetarian', 'vegetarian', 'vegan', 'keto'].includes(preferences.diet_type) ? '' : preferences.diet_type}
          onChange={(e) => setPreferences({ ...preferences, diet_type: e.target.value || 'non-vegetarian' })}
        />
      </div>

      <div className="pref-group">
        <span className="field-label">Cuisines and likes (optional)</span>
        <input
          type="text"
          className="clay-input"
          placeholder="e.g. Mexican, extra garlic"
          aria-label="Cuisine preferences"
          value={preferences.cuisine_preferences === 'any' ? '' : preferences.cuisine_preferences}
          onChange={(e) => setPreferences({ ...preferences, cuisine_preferences: e.target.value || 'any' })}
        />
      </div>
    </div>
  );

  if (isPage) {
    return (
      <div className="onboarding">
        <div className="onboarding__inner fade-in">
          <div className="onboarding__progress" aria-hidden="true">
            {Array.from({ length: stepCount }, (_, i) => (
              <span key={i} className={`onboarding__dot ${i <= stepIndex ? 'is-active' : ''}`} />
            ))}
          </div>

          <div className="onboarding__head">
            <h1>How do you like to eat?</h1>
            <p>We tailor every recipe to your taste. You can change this anytime.</p>
          </div>

          {form}

          <div className="onboarding__actions">
            <button onClick={handleSave} disabled={isLoading} className="clay-btn clay-btn--primary" style={{ width: '100%' }}>
              {isLoading ? 'Saving...' : 'Start cooking'}
            </button>
            {onBack && (
              <button onClick={onBack} className="clay-btn clay-btn--ghost" style={{ width: '100%' }}>
                <ArrowLeftIcon size={18} /> Back
              </button>
            )}
            {saveStatus === 'error' && (
              <div style={{ textAlign: 'center' }}>
                <span className="pill pill--peach"><AlertIcon size={15} /> Could not save, try again</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`overlay ${isOpen ? 'is-open' : ''}`} onClick={onClose} />
      <div className={`sheet ${isOpen ? 'is-open' : ''}`} role="dialog" aria-label="Taste preferences" aria-hidden={!isOpen}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <h2 style={{ fontSize: 'var(--text-2xl)' }}>Preferences</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><CloseIcon size={20} /></button>
        </div>

        <p className="muted" style={{ fontWeight: 500, fontSize: 'var(--text-sm)', lineHeight: 1.4, marginBottom: '16px' }}>
          Tell us how you eat and every recipe gets tailored to your taste.
        </p>

        {form}

        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={handleSave} disabled={isLoading} className="clay-btn clay-btn--primary" style={{ width: '100%' }}>
            {isLoading ? 'Saving...' : 'Save preferences'}
          </button>
          <div style={{ textAlign: 'center', minHeight: '20px' }}>
            {saveStatus === 'saved' && <span className="pill pill--mint"><CheckIcon size={15} /> Saved</span>}
            {saveStatus === 'error' && <span className="pill pill--peach"><AlertIcon size={15} /> Error saving</span>}
          </div>
        </div>
      </div>
    </>
  );
}
