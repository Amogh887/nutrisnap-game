import { resolveApiUrl } from '../apiClient';

const podiumOrder = [1, 0, 2];

const medalColors = ['#ffd60a', '#c7c7cc', '#cd7f32'];

export default function RevealPodium({ results }) {
  if (!results) return null;

  const winner = results.winner;
  const topDishes = results.top_dishes || [];

  return (
    <div className="premium-card fade-in" style={{ marginBottom: '2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: topDishes.length ? '2rem' : 0 }}>
        <div style={{ fontSize: '3rem', lineHeight: 1 }}>🏆</div>
        {winner ? (
          <>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0.6rem 0 0.2rem 0', letterSpacing: '-0.5px' }}>
              {winner.display_name}
            </h2>
            <div style={{ color: 'var(--green)', fontWeight: 600, fontSize: '1rem' }}>
              Winner · {winner.total_points} pts
            </div>
          </>
        ) : (
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: '0.6rem 0 0 0', color: 'var(--text-secondary)' }}>
            No dishes were scored this week
          </h2>
        )}
      </div>

      {topDishes.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
          {podiumOrder
            .filter((idx) => topDishes[idx])
            .map((idx) => {
              const dish = topDishes[idx];
              const isFirst = idx === 0;
              const cardWidth = isFirst ? 200 : 160;
              return (
                <div
                  key={dish.submission_id}
                  style={{
                    width: cardWidth,
                    maxWidth: '42vw',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-medium)',
                    border: `1px solid ${medalColors[idx]}`,
                    padding: '0.9rem',
                    transform: isFirst ? 'translateY(-12px)' : 'none',
                    boxShadow: isFirst ? '0 12px 32px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.3)'
                  }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: medalColors[idx], color: '#000', fontWeight: 700,
                    fontSize: '0.85rem', margin: '0 auto 0.6rem auto'
                  }}>
                    {idx + 1}
                  </div>
                  {dish.photo_url && (
                    <img
                      src={resolveApiUrl(dish.photo_url)}
                      alt={dish.recipe_name}
                      style={{
                        width: '100%', height: isFirst ? '130px' : '100px', objectFit: 'cover',
                        borderRadius: 'var(--radius-small)', marginBottom: '0.6rem'
                      }}
                    />
                  )}
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.2rem' }}>{dish.recipe_name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>{dish.display_name}</div>
                  <div style={{ color: 'var(--green)', fontWeight: 700, fontSize: '0.9rem' }}>{dish.points} pts</div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
