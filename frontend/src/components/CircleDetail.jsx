import { useState, useEffect, useCallback } from 'react';
import { requestApi, resolveApiUrl } from '../apiClient';
import RevealPodium from './RevealPodium';
import SubmitDish from './SubmitDish';
import CountUp from './CountUp';
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  ShareIcon,
  FlameIcon,
  MedalIcon,
  CheckIcon,
  CameraIcon,
  SparklesIcon,
} from './icons';

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

function weekProgressPct(cutoffUtc) {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const diff = new Date(cutoffUtc).getTime() - Date.now();
  if (diff <= 0) return 100;
  const pct = (1 - diff / weekMs) * 100;
  return Math.max(4, Math.min(100, pct));
}

const rankClasses = ['rank-badge--gold', 'rank-badge--silver', 'rank-badge--bronze'];

function DishCard({ dish }) {
  const rejected = dish.status && dish.status !== 'scored';
  return (
    <div className={`dish-card ${rejected ? 'is-rejected' : ''}`}>
      {dish.photo_url && (
        <img src={resolveApiUrl(dish.photo_url)} alt={dish.recipe_name} className="dish-card__photo" />
      )}
      <div className="dish-card__row">
        <span className="dish-card__name">{dish.recipe_name}</span>
        {rejected ? (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary)', fontWeight: 700, textTransform: 'capitalize' }}>{dish.status}</span>
        ) : (
          <span className="pill pill--points" style={{ padding: '5px 11px', fontSize: 'var(--text-sm)' }}>{dish.points} pts</span>
        )}
      </div>
      {!rejected && (
        <div className="row-wrap" style={{ gap: '6px' }}>
          <span className="pill pill--blue" style={{ fontSize: 'var(--text-xs)', padding: '4px 10px' }}>difficulty {dish.difficulty}</span>
          <span className="pill pill--mint" style={{ fontSize: 'var(--text-xs)', padding: '4px 10px' }}>stretch {dish.stretch}</span>
        </div>
      )}
      {dish.feedback && (
        <p className="muted" style={{ fontWeight: 600, fontSize: 'var(--text-sm)', lineHeight: 1.4 }}>{dish.feedback}</p>
      )}
    </div>
  );
}

export default function CircleDetail({ user, circleId, onBack, pendingCook, onPendingCookChange, onOpenScan, autoOpenSubmit, onAutoSubmitHandled }) {
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

  useEffect(() => {
    if (autoOpenSubmit) {
      setShowSubmit(true);
      if (onAutoSubmitHandled) onAutoSubmitHandled();
    }
  }, [autoOpenSubmit, onAutoSubmitHandled]);

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
      <div className="gate">
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

  const cookCtaButtons = (
    <div className="cook-cta__actions">
      <button className="clay-btn clay-btn--primary" onClick={() => onOpenScan && onOpenScan('photo')}>
        <CameraIcon size={18} />
        Snap ingredients
      </button>
      <button className="clay-btn clay-btn--ghost" onClick={() => onOpenScan && onOpenScan('custom')}>
        <SparklesIcon size={18} />
        Name your own dish
      </button>
    </div>
  );

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

  return (
    <div className="screen">
      <button className="clay-btn clay-btn--ghost" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        <ArrowLeftIcon size={20} />
        Circles
      </button>

      <div className="clay-card">
        <div className="cd-header">
          <h2>{circle?.name || 'Circle'}</h2>
          <button className="clay-btn clay-btn--soft" onClick={handleLeave} disabled={leaving} style={{ minHeight: '44px', padding: '10px 18px' }}>
            {leaving ? 'Leaving...' : 'Leave'}
          </button>
        </div>

        {circle?.cutoff_utc && (
          <div className="progress-block">
            <div className="progress-meta">
              <span>Reveal countdown</span>
              <span className="flame"><FlameIcon size={16} /> {formatCountdown(circle.cutoff_utc)}</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${weekProgressPct(circle.cutoff_utc)}%` }} />
            </div>
          </div>
        )}

        <div className="stat-row">
          <button className="clay-btn clay-btn--soft" onClick={() => copyText(inviteCode, 'invite')} style={{ minHeight: '44px', padding: '10px 16px' }}>
            {copied === 'invite' ? <><CheckIcon size={18} /> Copied</> : <><CopyIcon size={18} /> {inviteCode}</>}
          </button>
          <button className="clay-btn clay-btn--soft" onClick={() => copyText(shareLink, 'share')} style={{ minHeight: '44px', padding: '10px 16px' }}>
            {copied === 'share' ? <><CheckIcon size={18} /> Copied</> : <><ShareIcon size={18} /> Share link</>}
          </button>
        </div>

        {circle && (
          <div className="stat-row">
            <span className="pill pill--mint"><FlameIcon size={16} /> {circle.my_scored_today}/3 scored today</span>
            <span className="pill pill--blue">{circle.my_attempts_today}/10 attempts</span>
          </div>
        )}

        {!hasPendingHere && (
          <div className="cook-cta">
            <div className="cook-cta__title">Cook a dish for this circle</div>
            {cookCtaButtons}
          </div>
        )}
      </div>

      {hasPendingHere && (
        <div className="clay-card" style={{ borderColor: 'var(--color-cta)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--color-heading)' }}>Ready to submit?</div>
            <div className="muted" style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>You are cooking {pendingCook.recipe?.name} for this circle.</div>
          </div>
          <button className="clay-btn clay-btn--cta" onClick={() => setShowSubmit(true)}>
            Submit dish
          </button>
        </div>
      )}

      <div className="week-nav">
        <button className="icon-btn" onClick={goPrev} aria-label="Previous week"><ChevronLeftIcon size={22} /></button>
        <span className="week-nav__label">{displayedWeek || '—'}{isCurrentWeek ? ' · Live' : ''}</span>
        <button className="icon-btn" onClick={goNext} disabled={isCurrentWeek} aria-label="Next week"><ChevronRightIcon size={22} /></button>
      </div>

      {showPodium && <RevealPodium results={leaderboard.results} />}

      {error ? (
        <div className="banner banner--error"><div className="banner__body">{error}</div></div>
      ) : loadingLb && !leaderboard ? (
        <div className="empty-state"><span className="spinner" /><p>Loading leaderboard...</p></div>
      ) : standings.length === 0 ? (
        <div className="empty-state">
          <h2>No dishes yet</h2>
          <p>Be the first to cook and submit a dish this week.</p>
          {!hasPendingHere && cookCtaButtons}
        </div>
      ) : (
        <div className="stack" style={{ gap: '10px' }}>
          {standings.map((row, idx) => {
            const isExpanded = expandedRows[row.uid];
            const rankClass = idx < 3 ? rankClasses[idx] : 'rank-badge--plain';
            return (
              <div key={row.uid} className="clay-card standing-row">
                <div className="standing-row__head" onClick={() => toggleRow(row.uid)} role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') toggleRow(row.uid); }}>
                  <div className={`rank-badge ${rankClass}`}>
                    {idx < 3 ? <MedalIcon size={20} /> : idx + 1}
                  </div>
                  <div className="standing-name">
                    <strong>{row.display_name}{row.left_circle ? ' (left)' : ''}</strong>
                    <div className="muted" style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                      {row.submission_count} {row.submission_count === 1 ? 'dish' : 'dishes'}
                    </div>
                  </div>
                  <div className="standing-points">
                    <b><CountUp value={row.total_points} /></b>
                    <div className="muted" style={{ fontWeight: 600, fontSize: 'var(--text-xs)' }}>points</div>
                  </div>
                  <span className="muted">{isExpanded ? <ChevronUpIcon size={20} /> : <ChevronDownIcon size={20} />}</span>
                </div>

                {isExpanded && (
                  <div className="dish-grid fade-in">
                    {(row.submissions || []).length === 0 ? (
                      <div className="muted" style={{ fontWeight: 600 }}>No dishes yet.</div>
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
