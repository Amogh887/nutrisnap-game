import { useState } from 'react';
import { requestApi } from '../apiClient';
import CircleSelectModal from './CircleSelectModal';
import {
  HeartIcon,
  HeartFilledIcon,
  TrophyIcon,
  ClockIcon,
  FlameIcon,
  StarIcon,
  PlayIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from './icons';

export default function AnalysisResults({ data, onReset, onSaveRecipe, savedRecipeIds, user, onRequireAuth, onPendingCookChange, onScanSubmitNow, onScanCookFirst }) {
  const [expandedRecipes, setExpandedRecipes] = useState({});
  const [showAllIngredients, setShowAllIngredients] = useState(false);
  const [feedbackState, setFeedbackState] = useState({});
  const [cookRecipe, setCookRecipe] = useState(null);

  const handleFeedback = async (recipeName, type) => {
    setFeedbackState(prev => ({ ...prev, [recipeName]: type }));
    try {
      const auth = await import('../firebase').then(m => m.auth);
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const token = await currentUser.getIdToken();

      await requestApi({
        path: 'feedback',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ recipe_name: recipeName, feedback_type: type })
      });
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  if (!data) return null;

  const toggleExpand = (idx) => {
    setExpandedRecipes(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const ingredients = data.detected_ingredients || [];
  const displayIngredients = showAllIngredients ? ingredients : ingredients.slice(0, 6);
  const hasMoreIngredients = ingredients.length > 6;
  const hasPointsPreview = (data.recipes || []).some((r) => typeof r.points_estimate === 'number');

  return (
    <div className="clay-card stack">
      <div className="results-head">
        <h2>Fresh finds</h2>
        <button className="clay-btn clay-btn--ghost" onClick={onReset}>New snap</button>
      </div>

      {ingredients.length > 0 && (
        <div className="stack" style={{ gap: '10px' }}>
          <span className="section-label">Detected ingredients</span>
          <div className="row-wrap">
            {displayIngredients.map((ing, idx) => (
              <span key={idx} className="ingredient-chip">{ing}</span>
            ))}
            {!showAllIngredients && hasMoreIngredients && (
              <span className="ingredient-chip" style={{ background: 'var(--rose-100)', color: 'var(--color-primary-dark)' }}>
                +{ingredients.length - 6} more
              </span>
            )}
          </div>
          {hasMoreIngredients && (
            <button className="text-toggle" onClick={() => setShowAllIngredients(!showAllIngredients)}>
              {showAllIngredients ? 'Show less' : 'Show all ingredients'}
              {showAllIngredients ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
            </button>
          )}
        </div>
      )}

      <div className="stack">
        <div className="recipes-head">
          <span className="section-label">Recipe suggestions</span>
          {hasPointsPreview && (
            <span className="muted" style={{ fontWeight: 600, fontSize: 'var(--text-xs)', lineHeight: 1.4 }}>
              Points shown are estimates — final points are awarded when your dish photo is verified.
            </span>
          )}
        </div>
        {data.recipes?.map((recipe, idx) => {
          const isExpanded = expandedRecipes[idx];
          const isSaved = !!savedRecipeIds[recipe.name];
          return (
            <div key={idx} className="recipe-item">
              <div className="recipe-item__head">
                <div style={{ minWidth: 0 }}>
                  <h4 className="recipe-item__title">{recipe.name}</h4>
                  <div className="recipe-meta">
                    <span><ClockIcon size={16} /> {recipe.estimated_time_minutes} min</span>
                    <span><FlameIcon size={16} /> {recipe.nutrition?.calories_kcal} kcal</span>
                  </div>
                </div>
                <div className="recipe-item__badges">
                  {typeof recipe.points_estimate === 'number' && (
                    <span className="pill pill--points">~{recipe.points_estimate} pts</span>
                  )}
                  <span className="pill pill--mint">
                    <StarIcon size={16} /> {recipe.health_score}/10
                  </span>
                </div>
              </div>

              {(recipe.difficulty != null || recipe.stretch != null) && (
                <div className="row-wrap" style={{ gap: '6px' }}>
                  {recipe.difficulty != null && (
                    <span className="pill pill--blue" style={{ fontSize: 'var(--text-xs)', padding: '4px 10px' }}>difficulty {recipe.difficulty}</span>
                  )}
                  {recipe.stretch != null && (
                    <span className="pill pill--mint" style={{ fontSize: 'var(--text-xs)', padding: '4px 10px' }}>stretch {recipe.stretch}</span>
                  )}
                </div>
              )}

              <p className="muted" style={{ fontWeight: 600, lineHeight: 1.5 }}>{recipe.description}</p>

              <div className="recipe-actions">
                <button
                  className={`chip-action ${isSaved ? 'is-active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onSaveRecipe(recipe); }}
                >
                  {isSaved ? <HeartFilledIcon size={18} /> : <HeartIcon size={18} />}
                  {isSaved ? 'Saved' : 'Save'}
                </button>
                <button
                  className="chip-action chip-action--cook"
                  onClick={(e) => { e.stopPropagation(); setCookRecipe(recipe); }}
                >
                  <TrophyIcon size={18} />
                  Cook for a circle
                </button>
              </div>

              {isExpanded && (
                <div className="fade-in stack">
                  {recipe.servings && (
                    <div className="muted" style={{ fontWeight: 600 }}>
                      <strong style={{ color: 'var(--color-heading)' }}>Servings:</strong> {recipe.servings}
                    </div>
                  )}
                  <div className="recipe-body">
                    <div className="stack" style={{ gap: '16px' }}>
                      <div>
                        <span className="section-label">Ingredients</span>
                        <ul className="recipe-list" style={{ marginTop: '8px' }}>
                          {recipe.ingredients_used?.map((ing, iIdx) => (
                            <li key={iIdx}>{ing}</li>
                          ))}
                          {recipe.additional_ingredients?.map((ing, iIdx) => (
                            <li key={`add-${iIdx}`} className="extra">{ing} (needed)</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <span className="section-label">Instructions</span>
                        <ol className="recipe-list" style={{ marginTop: '8px' }}>
                          {recipe.instructions?.map((step, sIdx) => (
                            <li key={sIdx}>{step}</li>
                          ))}
                        </ol>
                      </div>

                      {recipe.youtube_thumbnail ? (
                        <a
                          href={`https://www.youtube.com/watch?v=${recipe.youtube_video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="yt-thumb"
                          title="Watch recipe tutorial"
                        >
                          <img src={recipe.youtube_thumbnail} alt={`${recipe.name} tutorial thumbnail`} />
                          <span className="yt-thumb__play">
                            <span><PlayIcon size={22} /></span>
                          </span>
                        </a>
                      ) : recipe.youtube_query ? (
                        <a
                          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(recipe.youtube_query)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="yt-link"
                        >
                          <PlayIcon size={16} /> Watch on YouTube
                        </a>
                      ) : null}
                    </div>

                    <div className="stack" style={{ gap: '10px' }}>
                      <span className="section-label">Nutrition</span>
                      <div className="nutrition-grid">
                        <div className="nutri-cell">
                          <div className="nutri-cell__value">{recipe.nutrition?.protein_g}g</div>
                          <div className="nutri-cell__label">Protein</div>
                        </div>
                        <div className="nutri-cell">
                          <div className="nutri-cell__value">{recipe.nutrition?.carbs_g}g</div>
                          <div className="nutri-cell__label">Carbs</div>
                        </div>
                        <div className="nutri-cell">
                          <div className="nutri-cell__value">{recipe.nutrition?.fat_g}g</div>
                          <div className="nutri-cell__label">Fat</div>
                        </div>
                        {recipe.nutrition?.fiber_g != null && recipe.nutrition?.fiber_g !== '' && (
                          <div className="nutri-cell">
                            <div className="nutri-cell__value">{recipe.nutrition.fiber_g}g</div>
                            <div className="nutri-cell__label">Fiber</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="feedback-row">
                    <span className="muted" style={{ fontWeight: 700 }}>How was this recipe?</span>
                    <div className="row-wrap" style={{ gap: '8px' }}>
                      <button
                        className={`chip-action ${feedbackState[recipe.name] === '👍' ? 'is-active' : ''}`}
                        onClick={() => handleFeedback(recipe.name, '👍')}
                      >
                        <ThumbsUpIcon size={18} /> Loved it
                      </button>
                      <button
                        className={`chip-action ${feedbackState[recipe.name] === 'too_hard' ? 'is-active' : ''}`}
                        onClick={() => handleFeedback(recipe.name, 'too_hard')}
                      >
                        Too hard
                      </button>
                      <button
                        className={`chip-action ${feedbackState[recipe.name] === '👎' ? 'is-active' : ''}`}
                        onClick={() => handleFeedback(recipe.name, '👎')}
                      >
                        <ThumbsDownIcon size={18} /> Not for me
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <button className="text-toggle" onClick={() => toggleExpand(idx)}>
                {isExpanded ? 'Show less' : 'Show full recipe'}
                {isExpanded ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
              </button>
            </div>
          );
        })}
      </div>

      {cookRecipe && (
        <CircleSelectModal
          user={user}
          recipe={cookRecipe}
          detectedIngredients={data.detected_ingredients || []}
          onClose={() => setCookRecipe(null)}
          onRequireAuth={onRequireAuth}
          onPendingCookChange={onPendingCookChange}
          onSubmitNow={() => { setCookRecipe(null); if (onScanSubmitNow) onScanSubmitNow(); }}
          onCookFirst={() => { setCookRecipe(null); if (onScanCookFirst) onScanCookFirst(); }}
        />
      )}
    </div>
  );
}
