import { useState, useEffect } from 'react';
import { requestApi } from '../apiClient';
import Mascot from './Mascot';
import { StarIcon, ClockIcon, HeartFilledIcon } from './icons';

export default function SavedRecipes({ user, onUnsave }) {
  const [recipes, setRecipes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      fetchSavedRecipes();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchSavedRecipes = async () => {
    setIsLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await requestApi({
        path: 'saved-recipes',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecipes(data);
      } else {
        setError("Failed to load saved recipes.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error occurred while fetching recipes.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsave = async (recipeId) => {
    try {
      const token = await user.getIdToken();
      await requestApi({
        path: `saved-recipes/${recipeId}`,
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setRecipes(prev => prev.filter(r => r.id !== recipeId));
      if (onUnsave) onUnsave(recipeId);
    } catch (err) {
      console.error("Failed to unsave recipe", err);
    }
  };

  if (!user) {
    return (
      <div className="gate">
        <Mascot pose="happy" size={132} animate />
        <h2>Saved recipes</h2>
        <p>Sign in to keep your favourite recipes in one place.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="empty-state"><span className="spinner" /><p>Loading recipes...</p></div>;
  }

  if (error) {
    return <div className="banner banner--error"><div className="banner__body">{error}</div></div>;
  }

  if (recipes.length === 0) {
    return (
      <div className="empty-state">
        <Mascot pose="cheer" size={132} />
        <h2>No saved recipes yet</h2>
        <p>Tap the heart on any recipe to keep it here for later.</p>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1 className="screen-title">Saved recipes</h1>
      <div className="stack">
        {recipes.map(recipe => (
          <div key={recipe.id} className="clay-card stack">
            <div className="results-head">
              <h3 style={{ fontSize: 'var(--text-xl)' }}>{recipe.name}</h3>
              <button className="chip-action is-active" onClick={() => handleUnsave(recipe.id)}>
                <HeartFilledIcon size={18} /> Unsave
              </button>
            </div>
            <p className="muted" style={{ fontWeight: 600, lineHeight: 1.5 }}>{recipe.description}</p>

            <div className="row-wrap">
              <span className="pill pill--mint"><StarIcon size={15} /> {recipe.health_score}/10</span>
              <span className="pill pill--peach"><ClockIcon size={15} /> {recipe.estimated_time_minutes} min</span>
              {recipe.diet_tags?.map(tag => (
                <span key={tag} className="pill pill--blue" style={{ textTransform: 'capitalize' }}>{tag}</span>
              ))}
            </div>

            {(recipe.ingredients_used?.length || recipe.additional_ingredients?.length) ? (
              <div className="stack" style={{ gap: '8px' }}>
                <span className="section-label">Ingredients</span>
                <div className="row-wrap" style={{ gap: '6px' }}>
                  {recipe.ingredients_used?.map(ing => (
                    <span key={ing} className="muted" style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>• {ing}</span>
                  ))}
                  {recipe.additional_ingredients?.map(ing => (
                    <span key={ing} className="muted" style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>• {ing}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
