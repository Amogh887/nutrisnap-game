import { useState, useEffect, useCallback } from 'react';
import { requestApi } from '../apiClient';

const inputStyle = {
  width: '100%', padding: '13px 16px', borderRadius: '14px',
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
  color: 'var(--text-primary)', fontSize: '1rem', outline: 'none',
  transition: 'border-color 0.2s', boxSizing: 'border-box'
};

const roleColors = {
  owner: { bg: 'rgba(255, 214, 10, 0.15)', color: '#ffd60a' },
  admin: { bg: 'rgba(10, 132, 255, 0.15)', color: 'var(--blue)' },
  member: { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }
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
      <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--text-secondary)' }}>
        <h2>Sign in to join Circles</h2>
        <p>Compete with friends in weekly cooking challenges.</p>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem', letterSpacing: '-0.5px' }}>
        Circles
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="premium-card">
          <h3 style={{ fontSize: '1.1rem', margin: '0 0 1rem 0' }}>Create a circle</h3>
          <input
            type="text"
            placeholder="Circle name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            style={{ ...inputStyle, marginBottom: '1rem' }}
            onFocus={(e) => e.target.style.borderColor = 'var(--blue)'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
          <button
            className="rounded-btn primary"
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            style={{ width: '100%', padding: '0.8rem' }}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
          {createError && (
            <div style={{ color: 'var(--red)', fontSize: '0.85rem', marginTop: '0.8rem' }}>{createError}</div>
          )}
        </div>

        <div className="premium-card">
          <h3 style={{ fontSize: '1.1rem', margin: '0 0 1rem 0' }}>Join a circle</h3>
          <input
            type="text"
            placeholder="Invite code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            style={{ ...inputStyle, marginBottom: '1rem', letterSpacing: '2px', textTransform: 'uppercase' }}
            onFocus={(e) => e.target.style.borderColor = 'var(--blue)'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
          <button
            className="rounded-btn"
            onClick={handleJoin}
            disabled={joining || !inviteCode.trim()}
            style={{ width: '100%', padding: '0.8rem' }}
          >
            {joining ? 'Joining...' : 'Join'}
          </button>
          {joinError && (
            <div style={{ color: 'var(--red)', fontSize: '0.85rem', marginTop: '0.8rem' }}>{joinError}</div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem' }}>Loading circles...</div>
      ) : error ? (
        <div style={{ color: 'var(--red)', textAlign: 'center', marginTop: '2rem' }}>{error}</div>
      ) : circles.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-secondary)' }}>
          <p>You are not in any circles yet. Create one or join with an invite code.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {circles.map((circle) => {
            const role = roleColors[circle.role] || roleColors.member;
            return (
              <div
                key={circle.id}
                onClick={() => onOpenCircle(circle.id)}
                className="premium-card"
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}
              >
                <div>
                  <h3 style={{ fontSize: '1.3rem', margin: '0 0 0.4rem 0' }}>{circle.name}</h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {circle.member_count} {circle.member_count === 1 ? 'member' : 'members'}
                  </div>
                </div>
                <span style={{
                  padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                  textTransform: 'capitalize', background: role.bg, color: role.color
                }}>
                  {circle.role}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
