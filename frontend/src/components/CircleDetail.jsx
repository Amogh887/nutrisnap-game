import { useState, useEffect, useCallback } from 'react';
import { requestApi, resolveApiUrl } from '../apiClient';
import RevealPodium from './RevealPodium';
import SubmitDish from './SubmitDish';

function isoWeekToMonday(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1) + (week - 1) * 7);
  return monday;
}

function dateToIsoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function shiftWeek(weekKey, delta) {
  const [y, w] = weekKey.split('-W').map(Number);
  const monday = isoWeekToMonday(y, w);
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4 + delta * 7);
  return dateToIsoWeek(friday);
}

function formatCountdown(cutoffUtc) {
  const diff = new Date(cutoffUtc).getTime() - Date.now();
  if (diff <= 0) return 'Week ended';
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${hours}h ${minutes}m`;
}

function DishCard({ dish }) {
  const rejected = dish.status && dish.status !== 'scored';
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-small)',
      padding: '0.8rem', opacity: rejected ? 0.55 : 1,
      border: '1px solid rgba(255,255,255,0.04)'
    }}>
      {dish.photo_url && (
        <img
          src={resolveApiUrl(dish.photo_url)}
          alt={dish.recipe_name}
          style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '10px', marginBottom: '0.6rem' }}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{dish.recipe_name}</span>
        {rejected ? (
          <span style={{ fontSize: '0.72rem', color: 'var(--red)', textTransform: 'capitalize' }}>{dish.status}</span>
        ) : (
          <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: '0.9rem' }}>{dish.points} pts</span>
        )}
      </div>
      {!rejected && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ padding: '3px 9px', background: 'rgba(10, 132, 255, 0.12)', color: 'var(--blue)', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 600 }}>
            difficulty {dish.difficulty}
          </span>
          <span style={{ padding: '3px 9px', background: 'rgba(48, 209, 88, 0.12)', color: 'var(--green)', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 600 }}>
            stretch {dish.stretch}
          </span>
        </div>
      )}
      {dish.feedback && (
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{dish.feedback}</p>
      )}
    </div>
  );
}

export default function CircleDetail({ user, circleId, onBack, pendingCook, onPendingCookChange }) {
  const [circle, setCircle] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [weekParam, setWeekParam] = useState(null);
  const [liveWeekKey, setLiveWeekKey] = useState(null);
  const [loadingLb, setLoadingLb] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [copied, setCopied] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [, setTick] = useState(0);

  const fetchCircle = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await requestApi({
        path: `circles/${circleId}`,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setCircle(await res.json());
      else setError('Failed to load circle.');
    } catch (err) {
      console.error(err);
      setError('Network error while loading circle.');
    }
  }, [user, circleId]);

  const fetchLeaderboard = useCallback(async (week) => {
    if (!user) return;
    setLoadingLb(true);
    try {
      const token = await user.getIdToken();
      const path = week
        ? `circles/${circleId}/leaderboard?week=${week}`
        : `circles/${circleId}/leaderboard`;
      const res = await requestApi({
        path,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
        if (!week) setLiveWeekKey(data.week_key);
      } else {
        setError('Failed to load leaderboard.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error while loading leaderboard.');
    } finally {
      setLoadingLb(false);
    }
  }, [user, circleId]);

  useEffect(() => {
    fetchCircle();
  }, [fetchCircle]);

  useEffect(() => {
    fetchLeaderboard(weekParam);
  }, [fetchLeaderboard, weekParam]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const handleSubmitted = () => {
    fetchCircle();
    if (weekParam) setWeekParam(null);
    else fetchLeaderboard(null);
  };

  const copyText = async (text, kind) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(''), 1500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm(`Leave ${circle?.name || 'this circle'}?`)) return;
    setLeaving(true);
    try {
      const token = await user.getIdToken();
      await requestApi({
        path: `circles/${circleId}/leave`,
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      onBack();
    } catch (err) {
      console.error(err);
      setLeaving(false);
    }
  };

  const toggleRow = (uid) => {
    setExpandedRows((prev) => ({ ...prev, [uid]: !prev[uid] }));
  };

  if (!user) {
    return (
      <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--text-secondary)' }}>
        <h2>Sign in to view this circle</h2>
      </div>
    );
  }

  const displayedWeek = leaderboard?.week_key;
  const isCurrentWeek = weekParam === null;
  const standings = [...(leaderboard?.standings || [])].sort((a, b) => b.total_points - a.total_points);
  const showPodium = leaderboard?.is_finalized && leaderboard?.results;
  const inviteCode = circle?.invite_code || '';
  const shareLink = inviteCode ? `${window.location.origin}/?join=${inviteCode}` : '';
  const hasPendingHere = pendingCook && pendingCook.circle_id === circleId;

  const goPrev = () => {
    if (!displayedWeek) return;
    setWeekParam(shiftWeek(displayedWeek, -1));
  };
  const goNext = () => {
    if (!displayedWeek || isCurrentWeek) return;
    const next = shiftWeek(displayedWeek, 1);
    if (liveWeekKey && next === liveWeekKey) setWeekParam(null);
    else setWeekParam(next);
  };

  const chipBtn = {
    background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-primary)',
    padding: '6px 12px', borderRadius: '12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600
  };

  return (
    <div className="fade-in" style={{ width: '100%', maxWidth: '820px', margin: '0 auto' }}>
      <button className="rounded-btn" onClick={onBack} style={{ marginBottom: '1.5rem', padding: '0.6rem 1.2rem' }}>
        ← Circles
      </button>

      <div className="premium-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0 0 0.3rem 0', letterSpacing: '-0.5px' }}>
              {circle?.name || 'Circle'}
            </h2>
            {circle?.cutoff_utc && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                ⏳ {formatCountdown(circle.cutoff_utc)}
              </div>
            )}
          </div>
          <button
            onClick={handleLeave}
            disabled={leaving}
            style={{
              background: 'rgba(255, 69, 58, 0.1)', border: 'none', color: 'var(--red)',
              padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem'
            }}
          >
            {leaving ? 'Leaving...' : 'Leave'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '1.2rem', flexWrap: 'wrap' }}>
          <button onClick={() => copyText(inviteCode, 'invite')} style={chipBtn}>
            {copied === 'invite' ? 'Copied!' : `Code: ${inviteCode}`}
          </button>
          <button onClick={() => copyText(shareLink, 'share')} style={chipBtn}>
            {copied === 'share' ? 'Copied!' : '🔗 Share link'}
          </button>
        </div>

        {circle && (
          <div style={{ marginTop: '1.2rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {circle.my_scored_today}/3 dishes scored · {circle.my_attempts_today}/10 attempts today
          </div>
        )}
      </div>

      {hasPendingHere && (
        <div className="premium-card" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', border: '1px solid rgba(48, 209, 88, 0.3)' }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>Ready to submit?</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              You are cooking {pendingCook.recipe?.name} for this circle.
            </div>
          </div>
          <button
            className="rounded-btn primary"
            onClick={() => setShowSubmit(true)}
            style={{ padding: '0.7rem 1.3rem' }}
          >
            Submit your {pendingCook.recipe?.name}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '1.2rem' }}>
        <button onClick={goPrev} style={{ ...chipBtn, padding: '6px 14px' }}>←</button>
        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
          {displayedWeek || '—'}{isCurrentWeek ? ' · Live' : ''}
        </span>
        <button
          onClick={goNext}
          disabled={isCurrentWeek}
          style={{ ...chipBtn, padding: '6px 14px', opacity: isCurrentWeek ? 0.4 : 1, cursor: isCurrentWeek ? 'default' : 'pointer' }}
        >
          →
        </button>
      </div>

      {showPodium && <RevealPodium results={leaderboard.results} />}

      {error ? (
        <div style={{ color: 'var(--red)', textAlign: 'center', marginTop: '1rem' }}>{error}</div>
      ) : loadingLb && !leaderboard ? (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '1rem' }}>Loading leaderboard...</div>
      ) : standings.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-secondary)' }}>
          <p>No dishes submitted this week yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {standings.map((row, idx) => {
            const isExpanded = expandedRows[row.uid];
            return (
              <div key={row.uid} className="premium-card" style={{ padding: '1.2rem' }}>
                <div
                  onClick={() => toggleRow(row.uid)}
                  style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}
                >
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: idx < 3 ? 'var(--green)' : 'var(--bg-tertiary)',
                    color: idx < 3 ? '#000' : 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem'
                  }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.display_name}{row.left_circle ? ' (left)' : ''}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {row.submission_count} {row.submission_count === 1 ? 'dish' : 'dishes'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{row.total_points}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>points</div>
                  </div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {isExpanded && (
                  <div className="fade-in" style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.8rem' }}>
                    {(row.submissions || []).length === 0 ? (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No dishes yet.</div>
                    ) : (
                      row.submissions.map((dish) => <DishCard key={dish.id} dish={dish} />)
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showSubmit && (
        <SubmitDish
          user={user}
          circleId={circleId}
          pendingCook={pendingCook}
          onClose={() => setShowSubmit(false)}
          onSubmitted={handleSubmitted}
          onPendingCookChange={onPendingCookChange}
        />
      )}
    </div>
  );
}
