import { useState, useRef, useEffect } from 'react';
import { SparklesIcon } from './icons';

export default function CustomDishInput({ onGenerate, isLoading, error, autoFocus }) {
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [autoFocus]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || isLoading) return;
    onGenerate(trimmed);
  };

  return (
    <div className="custom-dish">
      <div className="custom-dish__divider">
        <span>or name your own dish</span>
      </div>
      <div className="custom-dish__row">
        <input
          ref={inputRef}
          className="clay-input"
          type="text"
          maxLength={80}
          placeholder="e.g. egg sandwiches"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          disabled={isLoading}
          aria-label="Dish name"
        />
        <button
          className="clay-btn clay-btn--primary"
          onClick={submit}
          disabled={isLoading || !name.trim()}
        >
          <SparklesIcon size={18} />
          {isLoading ? 'Generating…' : 'Generate recipe'}
        </button>
      </div>
      {error && (
        <div className="banner banner--error">
          <div className="banner__body">{error}</div>
        </div>
      )}
    </div>
  );
}
