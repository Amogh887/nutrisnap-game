import { useState, useEffect } from 'react';
import { requestApi } from '../apiClient';
import Mascot from './Mascot';
import { CheckIcon, AlertIcon } from './icons';

export default function Profile({ user }) {
  const [profile, setProfile] = useState({
    full_name: '',
    age: '',
    city: '',
    notes: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchProfile = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await requestApi({
        path: 'profile',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
        }
      } else {
        setError("Failed to load profile.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error occurred while fetching profile.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setSuccessMsg('');
    setError(null);

    try {
      const token = await user.getIdToken();
      const res = await requestApi({
        path: 'profile',
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ profile })
      });
      if (res.ok) {
        setSuccessMsg("Profile saved");
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setError("Failed to save profile.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error occurred while saving profile.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="gate">
        <Mascot pose="wave" size={132} animate />
        <h2>Your profile</h2>
        <p>Sign in to personalize your recipes and track your cooking.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="empty-state"><span className="spinner" /><p>Loading profile...</p></div>;
  }

  return (
    <>
      <h1 className="screen-title">Your account</h1>

      <div className="clay-card">
        {error && (
          <div className="banner banner--error" style={{ marginBottom: '16px' }}>
            <div className="banner__body" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><AlertIcon size={18} /> {error}</div>
          </div>
        )}
        {successMsg && (
          <div className="banner banner--info" style={{ marginBottom: '16px' }}>
            <div className="banner__body" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><CheckIcon size={18} /> {successMsg}</div>
          </div>
        )}

        <form onSubmit={handleSave} className="form-grid">
          <div>
            <label className="field-label" htmlFor="pf-name">Full name</label>
            <input
              id="pf-name"
              type="text"
              className="clay-input"
              placeholder="Your name"
              value={profile.full_name || ''}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
            />
          </div>

          <div className="form-row">
            <div>
              <label className="field-label" htmlFor="pf-age">Age</label>
              <input
                id="pf-age"
                type="number"
                className="clay-input"
                placeholder="Age"
                value={profile.age || ''}
                onChange={(e) => setProfile({ ...profile, age: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="pf-city">City</label>
              <input
                id="pf-city"
                type="text"
                className="clay-input"
                placeholder="City"
                value={profile.city || ''}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="pf-notes">Notes</label>
            <textarea
              id="pf-notes"
              rows="4"
              className="clay-input"
              placeholder="Anything we should consider for your meal planning?"
              value={profile.notes || ''}
              onChange={(e) => setProfile({ ...profile, notes: e.target.value })}
              style={{ resize: 'vertical' }}
            />
          </div>

          <button type="submit" disabled={isSaving} className="clay-btn clay-btn--primary" style={{ width: '100%' }}>
            {isSaving ? 'Saving...' : 'Save profile'}
          </button>
        </form>
      </div>
    </>
  );
}
