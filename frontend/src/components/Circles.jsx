import { useState, useEffect, useCallback } from 'react';
import { requestApi } from '../apiClient';
import Mascot from './Mascot';
import { CirclesIcon } from './icons';

const roleClass = {
  owner: 'role-badge--owner',
  admin: 'role-badge--admin',
  member: 'role-badge--member',
};

export default function Circles({ user, onOpenCircle }) {
  const [circles, setCircles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

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
        setError('Failed to load circles.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error occurred while loading circles.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchCircles();
    else setIsLoading(false);
  }, [user, fetchCircles]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setCreateError('');
    try {
      const token = await user.getIdToken();
      const res = await requestApi({
        path: 'circles',
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });
      if (res.ok) {
        const data = await res.json();
        setName('');
        await fetchCircles();
        onOpenCircle(data.id);
      } else {
        const data = await res.json().catch(() => ({}));
        setCreateError(data.detail || 'Could not create circle.');
      }
    } catch (err) {
      console.error(err);
      setCreateError('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    const code = inviteCode.trim();
    if (!code || joining) return;
    setJoining(true);
    setJoinError('');
    try {
      const token = await user.getIdToken();
      const res = await requestApi({
        path: 'circles/join',
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: code })
      });
      if (res.ok) {
        const data = await res.json();
        setInviteCode('');
        onOpenCircle(data.id);
      } else if (res.status === 404) {
        setJoinError('Invalid invite code');
      } else {
        const data = await res.json().catch(() => ({}));
        setJoinError(data.detail || 'Could not join circle.');
      }
    } catch (err) {
      console.error(err);
      setJoinError('Network error. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  if (!user) {
    return (
      <div className="gate">
        <Mascot pose="wave" size={132} animate />
        <h2>Join a circle</h2>
        <p>Sign in to cook against your friends in weekly challenges.</p>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1 className="screen-title">Circles</h1>

      <div className="circles-actions">
        <div className="clay-card stack" style={{ gap: '12px' }}>
          <h3 style={{ fontSize: 'var(--text-lg)' }}>Create a circle</h3>
          <input
            type="text"
            className="clay-input"
            placeholder="Circle name"
            aria-label="Circle name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <button
            className="clay-btn clay-btn--primary"
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            style={{ width: '100%' }}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
          {createError && <div className="muted" style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>{createError}</div>}
        </div>

        <div className="clay-card stack" style={{ gap: '12px' }}>
          <h3 style={{ fontSize: 'var(--text-lg)' }}>Join a circle</h3>
          <input
            type="text"
            className="clay-input"
            placeholder="Invite code"
            aria-label="Invite code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            style={{ letterSpacing: '2px', textTransform: 'uppercase' }}
          />
          <button
            className="clay-btn clay-btn--cta"
            onClick={handleJoin}
            disabled={joining || !inviteCode.trim()}
            style={{ width: '100%' }}
          >
            {joining ? 'Joining...' : 'Join'}
          </button>
          {joinError && <div className="muted" style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>{joinError}</div>}
        </div>
      </div>

      {isLoading ? (
        <div className="empty-state"><span className="spinner" /><p>Loading circles...</p></div>
      ) : error ? (
        <div className="banner banner--error"><div className="banner__body">{error}</div></div>
      ) : circles.length === 0 ? (
        <div className="empty-state">
          <Mascot pose="happy" size={116} />
          <h2>No circles yet</h2>
          <p>Create one above or join with an invite code from a friend.</p>
        </div>
      ) : (
        <div className="stack">
          {circles.map((circle) => (
            <div key={circle.id} onClick={() => onOpenCircle(circle.id)} className="clay-card circle-card" role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') onOpenCircle(circle.id); }}>
              <div style={{ minWidth: 0 }}>
                <h3 className="circle-card__title">{circle.name}</h3>
                <div className="muted" style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <CirclesIcon size={16} /> {circle.member_count} {circle.member_count === 1 ? 'member' : 'members'}
                </div>
              </div>
              <span className={`role-badge ${roleClass[circle.role] || roleClass.member}`}>{circle.role}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
