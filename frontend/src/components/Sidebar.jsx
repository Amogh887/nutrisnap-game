export default function Sidebar({ isOpen, onClose, user, onSignIn, onSignOut, onOpenPreferences, onNavigate, currentView }) {
  return (
    <>
      <div 
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`} 
        onClick={onClose}
      />
      <div className={`sidebar-drawer ${isOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Menu</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>
        
        {user && (
          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem' }}>
              {user.email?.[0].toUpperCase() || 'U'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user.email}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Member</div>
            </div>
          </div>
        )}

        <div className="sidebar-links">
          <div 
            onClick={() => { onNavigate('home'); onClose(); }}
            style={{ 
              padding: '0.8rem 1rem', 
              borderRadius: '14px', 
              background: currentView === 'home' ? 'rgba(255,255,255,0.05)' : 'transparent', 
              color: currentView === 'home' ? 'var(--text-primary)' : 'var(--text-secondary)', 
              marginBottom: '0.5rem', 
              cursor: 'pointer' 
            }}
          >
            🏠 Home
          </div>
          <div
            onClick={() => { onNavigate('circles'); onClose(); }}
            style={{
              padding: '0.8rem 1rem',
              borderRadius: '14px',
              background: (currentView === 'circles' || currentView === 'circle') ? 'rgba(255,255,255,0.05)' : 'transparent',
              color: (currentView === 'circles' || currentView === 'circle') ? 'var(--text-primary)' : 'var(--text-secondary)',
              marginBottom: '0.5rem',
              cursor: 'pointer'
            }}
          >
            🏆 Circles
          </div>
          <div
            onClick={() => { onNavigate('history'); onClose(); }}
            style={{ 
              padding: '0.8rem 1rem', 
              borderRadius: '14px', 
              background: currentView === 'history' ? 'rgba(255,255,255,0.05)' : 'transparent', 
              color: currentView === 'history' ? 'var(--text-primary)' : 'var(--text-secondary)', 
              marginBottom: '0.5rem', 
              cursor: 'pointer' 
            }}
          >
            🕰️ Analysis History
          </div>
          <div 
            onClick={() => { onNavigate('profile'); onClose(); }}
            style={{ 
              padding: '0.8rem 1rem', 
              borderRadius: '14px', 
              background: currentView === 'profile' ? 'rgba(255,255,255,0.05)' : 'transparent', 
              color: currentView === 'profile' ? 'var(--text-primary)' : 'var(--text-secondary)', 
              marginBottom: '0.5rem', 
              cursor: 'pointer' 
            }}
          >
            👤 User Profile
          </div>
          <div 
            onClick={() => { onNavigate('saved_recipes'); onClose(); }}
            style={{ 
              padding: '0.8rem 1rem', 
              borderRadius: '14px', 
              background: currentView === 'saved_recipes' ? 'rgba(255,255,255,0.05)' : 'transparent', 
              color: currentView === 'saved_recipes' ? 'var(--text-primary)' : 'var(--text-secondary)', 
              marginBottom: '0.5rem', 
              cursor: 'pointer' 
            }}
          >
            ❤️ Saved Recipes
          </div>

        </div>

        <div style={{ position: 'absolute', bottom: '2rem', left: '1.5rem', right: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!user ? (
            <button 
              className="rounded-btn" 
              onClick={() => { onSignIn(); onClose(); }}
              style={{ width: '100%', padding: '0.8rem' }}
            >
              Sign In
            </button>
          ) : (
            <button 
              onClick={() => { onSignOut(); onClose(); }}
              style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '14px', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              Sign Out
            </button>
          )}

          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            NutriSnap v1.0
          </div>
        </div>
      </div>
    </>
  );
}
