import { useState } from 'react';
import { requestApi } from '../apiClient';
import CircleSelectModal from './CircleSelectModal';

export default function AnalysisResults({ data, onReset, onSaveRecipe, savedRecipeIds, user, onRequireAuth, onPendingCookChange }) {
  const [expandedRecipes, setExpandedRecipes] = useState({});
  const [showAllIngredients, setShowAllIngredients] = useState(false);
  const [feedbackState, setFeedbackState] = useState({}); // { [recipeName]: '👍' | '👎' | 'too_spicy' etc }
  const [cookRecipe, setCookRecipe] = useState(null);

  const handleFeedback = async (recipeName, type) => {
    setFeedbackState(prev => ({ ...prev, [recipeName]: type }));
    try {
      // We assume App.jsx logic manages tokens, but since this component doesn't
      // have direct access to the user, we should ideally pass a callback down. 
      // For simplicity, we just fire-and-forget to the new backend endpoint.
      // If no token is provided, the backend can either reject or save anonymously.
      
      const auth = await import('../firebase').then(m => m.auth);
      const user = auth.currentUser;
      if (!user) return; // Only logged in users can leave feedback

      const token = await user.getIdToken();
      
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
    setExpandedRecipes(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const ingredients = data.detected_ingredients || [];
  const displayIngredients = showAllIngredients ? ingredients : ingredients.slice(0, 6);
  const hasMoreIngredients = ingredients.length > 6;

  return (
    <div className="premium-card" style={{ width: '100%', maxWidth: '800px', animation: 'fadeIn 0.6s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>Analysis Complete</h2>
        <button className="rounded-btn" onClick={onReset}>New Analysis</button>
      </div>

      {/* Ingredients */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Detected Ingredients</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
          {displayIngredients.map((ing, idx) => (
            <span key={idx} style={{ padding: '0.6rem 1.2rem', background: 'var(--bg-tertiary)', borderRadius: '20px', fontSize: '0.9rem' }}>
              {ing}
            </span>
          ))}
          {!showAllIngredients && hasMoreIngredients && (
            <span style={{ padding: '0.6rem 1.2rem', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              +{ingredients.length - 6} more
            </span>
          )}
        </div>
        
        {hasMoreIngredients && (
          <button 
            onClick={() => setShowAllIngredients(!showAllIngredients)}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--blue)', 
              cursor: 'pointer', 
              padding: 0, 
              fontSize: '0.85rem', 
              fontWeight: 500 
            }}
          >
            {showAllIngredients ? 'Show Less ↑' : 'Show All Ingredients ↓'}
          </button>
        )}
      </div>

      {/* Recipes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Recipe Suggestions</h3>
        {data.recipes?.map((recipe, idx) => {
          const isExpanded = expandedRecipes[idx];
          return (
            <div key={idx} className="recipe-card-minimal" style={{ 
              background: 'var(--bg-tertiary)', 
              padding: '1.5rem', 
              borderRadius: 'var(--radius-medium)',
              border: '1px solid rgba(255,255,255,0.03)',
              transition: 'all 0.3s ease'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.3rem', margin: '0 0 0.4rem 0' }}>{recipe.name}</h4>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <span>⏱️ {recipe.estimated_time_minutes}</span>
                    <span>🔥 {recipe.nutrition?.calories_kcal} kcal</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ 
                    background: 'var(--green)', 
                    color: '#000', 
                    padding: '4px 12px', 
                    borderRadius: '12px', 
                    fontWeight: 700, 
                    fontSize: '0.9rem' 
                  }}>
                    {recipe.health_score}/10
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onSaveRecipe(recipe);
                    }}
                    style={{
                      background: savedRecipeIds[recipe.name] ? 'rgba(255, 69, 58, 0.1)' : 'rgba(255,255,255,0.05)',
                      color: savedRecipeIds[recipe.name] ? 'var(--red)' : 'var(--text-primary)',
                      border: 'none',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {savedRecipeIds[recipe.name] ? '❤️ Saved' : '🤍 Save'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCookRecipe(recipe);
                    }}
                    style={{
                      background: 'rgba(48, 209, 88, 0.12)',
                      color: 'var(--green)',
                      border: 'none',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    🏆 Cook for a Circle
                  </button>
                </div>
              </div>
              
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: isExpanded ? '1.5rem' : '1rem' }}>
                {recipe.description}
              </p>

              {isExpanded && (
                <>
                  {recipe.servings && (
                    <div style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Servings:</span> {recipe.servings}
                    </div>
                  )}
                  <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '2rem', marginBottom: '1.5rem' }}>
                    <div>
                      <h5 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.8rem' }}>Ingredients</h5>
                      <ul style={{ paddingLeft: '1.2rem', margin: '0 0 1.5rem 0', fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                        {recipe.ingredients_used?.map((ing, iIdx) => (
                          <li key={iIdx} style={{ marginBottom: '6px' }}>{ing}</li>
                        ))}
                        {recipe.additional_ingredients?.map((ing, iIdx) => (
                          <li key={`add-${iIdx}`} style={{ marginBottom: '6px', color: 'var(--text-secondary)' }}>
                            {ing} <span style={{ fontSize: '0.8rem' }}>(needed)</span>
                          </li>
                        ))}
                      </ul>

                      <h5 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.8rem' }}>Instructions</h5>
                      <ol style={{ paddingLeft: '1.2rem', margin: '0 0 1.5rem 0', fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                        {recipe.instructions?.map((step, sIdx) => (
                          <li key={sIdx} style={{ marginBottom: '6px' }}>{step}</li>
                        ))}
                      </ol>

                      {recipe.youtube_thumbnail ? (
                        <a 
                          href={`https://www.youtube.com/watch?v=${recipe.youtube_video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Watch Recipe Tutorial"
                          style={{
                            display: 'block',
                            position: 'relative',
                            width: '100%',
                            height: '140px',
                            borderRadius: '16px',
                            overflow: 'hidden',
                            marginTop: '1rem',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            transition: 'transform 0.2s',
                            textDecoration: 'none'
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                          <img 
                            src={recipe.youtube_thumbnail} 
                            alt="YouTube Thumbnail" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                          <div style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <div style={{ width: '68px', height: '48px', opacity: 0.9 }}>
                              <svg height="100%" version="1.1" viewBox="0 0 68 48" width="100%">
                                <path fill="#f00" d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z"></path>
                                <path d="M 45,24 27,14 27,34" fill="#fff"></path>
                              </svg>
                            </div>
                          </div>
                        </a>
                      ) : recipe.youtube_query ? (
                        <a 
                          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(recipe.youtube_query)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'rgba(255, 0, 0, 0.1)',
                            color: '#ff4b4b',
                            textDecoration: 'none',
                            padding: '8px 16px',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            border: '1px solid rgba(255, 0, 0, 0.2)',
                            transition: 'all 0.2s',
                            marginTop: '0.5rem'
                          }}
                          onMouseOver={(e) => { e.target.style.background = 'rgba(255, 0, 0, 0.15)'; }}
                          onMouseOut={(e) => { e.target.style.background = 'rgba(255, 0, 0, 0.1)'; }}
                        >
                          ▶️ Watch on YouTube
                        </a>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                       <h5 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Nutrition</h5>
                       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{recipe.nutrition?.protein_g}g</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Protein</div>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{recipe.nutrition?.carbs_g}g</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Carbs</div>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{recipe.nutrition?.fat_g}g</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Fat</div>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Fiber</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>High</div>
                          </div>
                       </div>
                    </div>
                  </div>

                  {/* Feedback Widget */}
                  <div style={{ 
                    marginTop: '2rem', 
                    paddingTop: '1rem', 
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>How was this recipe?</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => handleFeedback(recipe.name, '👍')}
                        style={{ background: feedbackState[recipe.name] === '👍' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '20px', padding: '6px 12px', cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        👍 Perfect
                      </button>
                      <button 
                         onClick={() => handleFeedback(recipe.name, 'too_hard')}
                         style={{ background: feedbackState[recipe.name] === 'too_hard' ? 'rgba(255, 152, 0, 0.2)' : 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '20px', padding: '6px 12px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.85rem' }}
                      >
                        Too Hard
                      </button>
                      <button 
                         onClick={() => handleFeedback(recipe.name, '👎')}
                         style={{ background: feedbackState[recipe.name] === '👎' ? 'rgba(255, 69, 58, 0.2)' : 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '20px', padding: '6px 12px', cursor: 'pointer' }}
                      >
                        👎 Not for me
                      </button>
                    </div>
                  </div>
                </>
              )}

              <button 
                onClick={() => toggleExpand(idx)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--blue)', 
                  cursor: 'pointer', 
                  padding: 0, 
                  fontSize: '0.9rem', 
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {isExpanded ? 'Show Less ↑' : 'Show Full Recipe ↓'}
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
        />
      )}
    </div>
  );
}
