import { useState, useEffect } from 'react';
import { requestApi } from '../apiClient';
import Mascot from './Mascot';
import { ClockIcon, UtensilsIcon } from './icons';

export default function History({ user }) {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      fetchHistory();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await requestApi({
        path: 'food-history',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      } else {
        setError("Failed to load history.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error occurred while fetching history.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="gate">
        <Mascot pose="happy" size={132} animate />
        <h2>Your snap history</h2>
        <p>Sign in to keep track of every meal you have analyzed.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="empty-state"><span className="spinner" /><p>Loading history...</p></div>;
  }

  if (error) {
    return <div className="banner banner--error"><div className="banner__body">{error}</div></div>;
  }

  if (history.length === 0) {
    return (
      <div className="empty-state">
        <Mascot pose="happy" size={132} />
        <h2>No history yet</h2>
        <p>Snap a food photo and your analyses will show up here.</p>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1 className="screen-title">Snap history</h1>
      <div className="stack">
        {history.map((entry, idx) => {
          let dateStr = "Unknown date";
          if (entry.analyzed_at) {
            if (entry.analyzed_at._seconds) {
              dateStr = new Date(entry.analyzed_at._seconds * 1000).toLocaleString();
            } else {
              dateStr = new Date(entry.analyzed_at).toLocaleString();
            }
          }
          const ingredients = entry.detected_ingredients || [];
          const recipes = entry.recipes_generated || [];
          return (
            <div key={entry.id || idx} className="clay-card stack">
              <h3 style={{ fontSize: 'var(--text-lg)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <ClockIcon size={18} /> {dateStr}
              </h3>

              <div className="stack" style={{ gap: '8px' }}>
                <span className="section-label">Detected ingredients</span>
                {ingredients.length ? (
                  <div className="row-wrap">
                    {ingredients.map((ing, i) => <span key={i} className="ingredient-chip">{ing}</span>)}
                  </div>
                ) : <span className="muted" style={{ fontWeight: 600 }}>None available</span>}
              </div>

              <div className="stack" style={{ gap: '8px' }}>
                <span className="section-label">Recipes generated</span>
                {recipes.length ? (
                  <div className="row-wrap">
                    {recipes.map((r, i) => (
                      <span key={i} className="pill pill--blue"><UtensilsIcon size={15} /> {r}</span>
                    ))}
                  </div>
                ) : <span className="muted" style={{ fontWeight: 600 }}>None available</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
