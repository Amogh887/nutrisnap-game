import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import './styles/theme.css';
import './styles/layout.css';

import Sidebar from './components/Sidebar';
import UploadCard from './components/UploadCard';
import AnalysisResults from './components/AnalysisResults';
import PreferencesSurvey from './components/PreferencesSurvey';
import SavedRecipes from './components/SavedRecipes';
import History from './components/History';
import Profile from './components/Profile';
import Circles from './components/Circles';
import CircleDetail from './components/CircleDetail';
import AuthModal from './AuthModal';
import { requestApi } from './apiClient';

const PENDING_COOK_KEY = 'nutrisnap_pending_cook';

const readPendingCook = () => {
  try {
    const raw = localStorage.getItem(PENDING_COOK_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [currentView, setCurrentView] = useState('home');

  // Auth state
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [savedRecipeIds, setSavedRecipeIds] = useState({});

  const [activeCircleId, setActiveCircleId] = useState(null);
  const [joinError, setJoinError] = useState('');
  const [, setPendingCookVersion] = useState(0);
  const joinCodeRef = useRef(null);
  const pendingCook = readPendingCook();

  const refreshPendingCook = () => setPendingCookVersion((v) => v + 1);

  const openCircle = (id) => {
    setActiveCircleId(id);
    setCurrentView('circle');
  };

  const dismissPendingCook = () => {
    if (window.confirm('Stop cooking this dish for the circle?')) {
      localStorage.removeItem(PENDING_COOK_KEY);
      refreshPendingCook();
    }
  };

  const steps = [
    { label: 'Analyzing image data...', icon: '🧠' },
    { label: 'Detecting raw ingredients...', icon: '🔍' },
    { label: 'Optimizing health scores...', icon: '🥗' },
    { label: 'Generating tailored recipes...', icon: '👨‍🍳' }
  ];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join');
    if (!code) return;
    joinCodeRef.current = code.toUpperCase();
    params.delete('join');
    const qs = params.toString();
    const newUrl = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
    window.history.replaceState({}, '', newUrl);
    if (!auth.currentUser) {
      setShowAuthModal(true);
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Check if user has completed survey
        try {
          const token = await firebaseUser.getIdToken();
          const res = await requestApi({
            path: 'preferences',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const prefs = await res.json();
            // If the user has default preferences (e.g. no cuisine set), or if this is their first login
            // We can decide to show the survey. For now, let's show it if they have no custom cuisine prefs
            if (prefs.cuisine_preferences === 'any' || !prefs.has_onboarded) {
              setShowPreferences(true);
            }
          }
        } catch (err) {
          console.error("Failed to check onboarding status", err);
        }

        if (joinCodeRef.current) {
          const code = joinCodeRef.current;
          joinCodeRef.current = null;
          try {
            const token = await firebaseUser.getIdToken();
            const res = await requestApi({
              path: 'circles/join',
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ invite_code: code })
            });
            if (res.ok) {
              const data = await res.json();
              setShowAuthModal(false);
              setActiveCircleId(data.id);
              setCurrentView('circle');
            } else {
              setJoinError('Invalid invite code');
            }
          } catch (err) {
            console.error('Failed to join circle from link', err);
            setJoinError('Could not join circle. Please try again.');
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const getAuthToken = async () => {
    if (!user) return null;
    return await user.getIdToken();
  };

  const handleUpload = async (file) => {
    setIsLoading(true);
    setResult(null);
    setError(null);
    setActiveStep(0);

    const formData = new FormData();
    formData.append('image', file);

    // Build headers — include auth token if logged in
    const headers = {};
    const token = await getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Start a simulation to move through steps if the backend takes a while
    const stepInterval = setInterval(() => {
      setActiveStep((prev) => {
        // Step automatically up to second-to-last step (index 2 out of 3. Length - 2)
        if (prev < steps.length - 2) return prev + 1;
        return prev;
      });
    }, 5000);  

    try {
      setActiveStep(0);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout

      const response = await requestApi({
        path: 'analyze-food',
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = `Server error: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMsg = errorData.detail || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const data = await response.json();
      console.log("Analysis Result:", data);
      
      // Push progress bar to the absolute finale
      setActiveStep(steps.length - 1);
      
      // Delay so the animated line completes its journey satisfyingly
      setTimeout(() => {
        setResult(data);
        setIsLoading(false);
      }, 1600);
      
    } catch (err) {
      console.error('Upload error details:', err);
      if (err?.name === 'AbortError') {
        setError('Upload timed out. Please try again with a smaller image or better network.');
      } else if (err instanceof TypeError) {
        setError('Load failed. Configure VITE_API_BASE_URL to your deployed backend URL.');
      } else {
        setError(err.message || 'An unexpected error occurred. Please check your connection.');
      }
      setIsLoading(false);
    } finally {
      clearInterval(stepInterval);
    }
  };

  const handleSaveRecipe = async (recipe) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    const recipeKey = recipe.name;
    try {
      const token = await getAuthToken();
      if (savedRecipeIds[recipeKey]) {
        // Unsave
        await requestApi({
          path: `saved-recipes/${savedRecipeIds[recipeKey]}`,
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        setSavedRecipeIds(prev => {
          const updated = { ...prev };
          delete updated[recipeKey];
          return updated;
        });
      } else {
        // Save
        const res = await requestApi({
          path: 'saved-recipes',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(recipe),
        });
        const data = await res.json();
        setSavedRecipeIds(prev => ({ ...prev, [recipeKey]: data.id }));
      }
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setSavedRecipeIds({});
  };

  return (
    <div className="app-shell">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        user={user}
        onSignIn={() => setShowAuthModal(true)}
        onSignOut={handleSignOut}
        onOpenPreferences={() => {
          setIsSidebarOpen(false);
          setShowPreferences(true);
        }}
        onNavigate={setCurrentView}
        currentView={currentView}
      />
      
      <main className="main-viewport" style={{ overflowY: (currentView === 'home' && !result && !isLoading) ? 'hidden' : 'auto' }}>
        <header className="top-bar">
          <button className="rounded-btn" onClick={() => setIsSidebarOpen(true)}>
            <span style={{ fontSize: '1.2rem' }}>⠿</span> Menu
          </button>
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center' }}>
            <img src="/logo.png" alt="NutriSnap" style={{ height: '95px', marginTop: '10px', objectFit: 'contain', pointerEvents: 'none' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            {!user ? (
               <button 
                 className="rounded-btn" 
                 onClick={() => setShowAuthModal(true)}
                 style={{ padding: '6px 12px', fontSize: '0.8rem' }}
               >
                 Sign In
               </button>
             ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <button 
                    onClick={() => setShowPreferences(true)}
                    title="Personalize"
                    style={{ 
                      background: '#000000', 
                      border: '1px solid rgba(255, 255, 255, 0.2)', 
                      color: '#FFFFFF', 
                      cursor: 'pointer', 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '50%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)'
                    }}
                    onMouseOver={(e) => { 
                      e.currentTarget.style.background = '#111111'; 
                      e.currentTarget.style.transform = 'scale(1.05)'; 
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.7)';
                    }}
                    onMouseOut={(e) => { 
                      e.currentTarget.style.background = '#000000'; 
                      e.currentTarget.style.transform = 'scale(1)'; 
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
                    }}
                  >
                    <img 
                      src="/gear.png" 
                      alt="Preferences Gear" 
                      style={{ 
                        filter: 'brightness(0) invert(1)',
                        width: '24px', 
                        height: '24px', 
                        objectFit: 'contain'
                      }} 
                    />
                  </button>
                </div>
              )}
            </div>
        </header>

        {joinError && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem',
            background: 'rgba(255, 69, 58, 0.1)', border: '1px solid rgba(255, 69, 58, 0.2)',
            color: 'var(--red)', padding: '10px 16px', borderRadius: '12px', marginBottom: '1rem', fontSize: '0.9rem'
          }}>
            <span>{joinError}</span>
            <button
              onClick={() => setJoinError('')}
              style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '1rem' }}
            >
              ✕
            </button>
          </div>
        )}

        {pendingCook && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem',
            background: 'rgba(48, 209, 88, 0.1)', border: '1px solid rgba(48, 209, 88, 0.25)',
            color: 'var(--text-primary)', padding: '10px 16px', borderRadius: '12px', marginBottom: '1rem', fontSize: '0.9rem'
          }}>
            <span
              onClick={() => openCircle(pendingCook.circle_id)}
              style={{ cursor: 'pointer', flex: 1 }}
            >
              🍳 You're cooking <strong>{pendingCook.recipe?.name}</strong> for {pendingCook.circle_name} —{' '}
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>Submit dish</span>
            </span>
            <button
              onClick={dismissPendingCook}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1rem' }}
            >
              ✕
            </button>
          </div>
        )}

        <section className="content-center">
          {currentView === 'circles' ? (
            <Circles user={user} onOpenCircle={openCircle} />
          ) : currentView === 'circle' ? (
            <CircleDetail
              user={user}
              circleId={activeCircleId}
              onBack={() => setCurrentView('circles')}
              pendingCook={pendingCook}
              onPendingCookChange={refreshPendingCook}
            />
          ) : currentView === 'profile' ? (
            <Profile user={user} />
          ) : currentView === 'history' ? (
            <History user={user} />
          ) : currentView === 'saved_recipes' ? (
            <SavedRecipes 
              user={user} 
              onUnsave={(id) => {
                const recipeKey = Object.keys(savedRecipeIds).find(key => savedRecipeIds[key] === id);
                if (recipeKey) {
                  setSavedRecipeIds(prev => {
                    const updated = { ...prev };
                    delete updated[recipeKey];
                    return updated;
                  });
                }
              }} 
            />
          ) : !result ? (
            <div className="fade-in" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <UploadCard 
                onUpload={handleUpload} 
                isLoading={isLoading} 
                activeStep={activeStep}
                steps={steps}
                error={error}
              />
              {error && !error.includes("Not enough ingredients") && (
                <div style={{ 
                  marginTop: '1.5rem', 
                  color: 'var(--red)', 
                  fontSize: '0.9rem',
                  background: 'rgba(255, 69, 58, 0.1)',
                  padding: '10px 20px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 69, 58, 0.2)'
                }}>
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div className="fade-in" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
              {!user && (
                <div style={{
                  textAlign: 'center',
                  padding: '1rem',
                  background: 'rgba(76, 175, 80, 0.1)',
                  borderRadius: '12px',
                  border: '1px solid rgba(76, 175, 80, 0.2)',
                  fontSize: '0.95rem',
                  color: 'var(--text-secondary)',
                  maxWidth: '800px',
                  width: '100%'
                }}>
                  💡 <span
                    style={{ color: 'var(--green)', cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => setShowAuthModal(true)}
                  >
                    Sign in
                  </span> to save recipes and get deep personalization.
                </div>
              )}
              <AnalysisResults
                data={result}
                onReset={() => setResult(null)}
                onSaveRecipe={handleSaveRecipe}
                savedRecipeIds={savedRecipeIds}
                user={user}
                onRequireAuth={() => setShowAuthModal(true)}
                onPendingCookChange={refreshPendingCook}
              />
            </div>
          )}
        </section>
      </main>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      <PreferencesSurvey 
        isOpen={showPreferences} 
        onClose={() => setShowPreferences(false)} 
        user={user} 
      />
    </div>
  );
}

export default App;
