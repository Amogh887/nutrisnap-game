import { resolveApiUrl } from '../apiClient';
import CountUp from './CountUp';
import { TrophyIcon } from './icons';

const podiumOrder = [1, 0, 2];

const medalClass = ['rank-badge--gold', 'rank-badge--silver', 'rank-badge--bronze'];
const riseDelay = [0.36, 0.18, 0];

export default function RevealPodium({ results }) {
  if (!results) return null;

  const winner = results.winner;
  const topDishes = results.top_dishes || [];

  return (
    <div className="clay-card podium fade-in">
      <div className="winner-crest">
        <span className="winner-crest__icon"><TrophyIcon size={30} /></span>
        {winner ? (
          <>
            <h2>{winner.display_name}</h2>
            <span className="pill pill--points">
              Winner · <CountUp value={winner.total_points} /> pts
            </span>
          </>
        ) : (
          <h2 style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-lg)' }}>
            No dishes were scored this week
          </h2>
        )}
      </div>

      {topDishes.length > 0 && (
        <div className="podium-row">
          {podiumOrder
            .filter((idx) => topDishes[idx])
            .map((idx) => {
              const dish = topDishes[idx];
              const isFirst = idx === 0;
              return (
                <div
                  key={dish.submission_id}
                  className={`podium-col podium-rise ${isFirst ? 'podium-col--first' : ''}`}
                  style={{ animationDelay: `${riseDelay[idx]}s` }}
                >
                  <div className={`podium-medal ${medalClass[idx]}`}>{idx + 1}</div>
                  {dish.photo_url && (
                    <img
                      src={resolveApiUrl(dish.photo_url)}
                      alt={dish.recipe_name}
                      className="podium-photo"
                      style={{ height: isFirst ? '130px' : '100px' }}
                    />
                  )}
                  <div className="podium-col__name">{dish.recipe_name}</div>
                  <div className="muted" style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{dish.display_name}</div>
                  <span className="pill pill--points" style={{ padding: '5px 12px', fontSize: 'var(--text-sm)' }}>
                    <CountUp value={dish.points} /> pts
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
