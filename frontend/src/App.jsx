import { useState, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import './styles/theme.css';
import './styles/layout.css';
import './App.css';

import BottomNav from './components/BottomNav';
import Mascot from './components/Mascot';
import UploadCard from './components/UploadCard';
import CustomDishInput from './components/CustomDishInput';
import AnalysisResults from './components/AnalysisResults';
import PreferencesSurvey from './components/PreferencesSurvey';
import OnboardingFlow from './components/OnboardingFlow';
import SavedRecipes from './components/SavedRecipes';
import History from './components/History';
import Profile from './components/Profile';
import Circles from './components/Circles';
import CircleDetail from './components/CircleDetail';
import SubmitDish from './components/SubmitDish';
import AuthScreen from './AuthScreen';
import {
  SettingsIcon,
  CloseIcon,
  UtensilsIcon,
  ChevronRightIcon,
  LogOutIcon,
} from './components/icons';
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
  const [authResolved, setAuthResolved] = useState(false);
  const [user, setUser] = useState(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  const [currentView, setCurrentView] = useState('circles');
  const [scanOpen, setScanOpen] = useState(false);
  const [scanMode, setScanMode] = useState('photo');

  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState(null);

  const [savedRecipeIds, setSavedRecipeIds] = useState({});

  const [activeCircleId, setActiveCircleId] = useState(null);
  const [joinError, setJoinError] = useState('');
  const [, setPendingCookVersion] = useState(0);
  const [scanSubmit, setScanSubmit] = useState(null);
  const [autoOpenSubmit, setAutoOpenSubmit] = useState(false);
  const scanSubmitScoredRef = useRef(false);
  const joinCodeRef = useRef(null);
  const pendingCook = readPendingCook();

  const refreshPendingCook = () => setPendingCookVersion((v) => v + 1);
  const clearAutoSubmit = useCallback(() => setAutoOpenSubmit(false), []);

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
    { label: 'Reading your photo', icon: 'analyze' },
    { label: 'Spotting the ingredients', icon: 'detect' },
    { label: 'Scoring the health points', icon: 'score' },
    { label: 'Cooking up recipes', icon: 'recipes' },
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
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setNeedsOnboarding(false);
        setAuthResolved(true);
        return;
      }

      try {
        const token = await firebaseUser.getIdToken();
        const res = await requestApi({
          path: 'preferences',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const prefs = await res.json();
          setNeedsOnboarding(prefs.cuisine_preferences === 'any' || !prefs.has_onboarded);
        }
      } catch (err) {
        console.error("Failed to check onboarding status", err);
      }

      setAuthResolved(true);

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

    const headers = {};
    const token = await getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const stepInterval = setInterval(() => {
      setActiveStep((prev) => {
        if (prev < steps.length - 2) return prev + 1;
        return prev;
      });
    }, 5000);

    try {
      setActiveStep(0);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

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
          if (errorData?.detail) errorMsg = errorData.detail;
        } catch {
          errorMsg = `Server error: ${response.status}`;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();

      setActiveStep(steps.length - 1);

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
    if (!user) return;
    const recipeKey = recipe.name;
    try {
      const token = await getAuthToken();
      if (savedRecipeIds[recipeKey]) {
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
    setCurrentView('circles');
    setScanOpen(false);
  };

  const openScan = (mode) => {
    setResult(null);
    setError(null);
    setCustomError(null);
    setScanMode(mode === 'custom' ? 'custom' : 'photo');
    setScanOpen(true);
  };

  const closeScan = () => setScanOpen(false);

  const handleGenerateRecipe = async (dishName) => {
    setCustomLoading(true);
    setCustomError(null);
    setError(null);
    setResult(null);

    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = await getAuthToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await requestApi({
        path: 'generate-recipe',
        method: 'POST',
        headers,
        body: JSON.stringify({ dish_name: dishName }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = `Server error: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData?.detail) errorMsg = errorData.detail;
        } catch {
          errorMsg = `Server error: ${response.status}`;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error('Generate recipe error:', err);
      setCustomError(err.message || 'Could not generate a recipe. Please try again.');
    } finally {
      setCustomLoading(false);
    }
  };

  const handleScanSubmitNow = () => {
    const cook = readPendingCook();
    if (cook) setScanSubmit(cook);
  };

  const handleScanCookFirst = () => {
    setScanSubmit(null);
    setScanOpen(false);
    setResult(null);
  };

  const handleScanSubmitScored = () => {
    scanSubmitScoredRef.current = true;
  };

  const handleScanSubmitClose = () => {
    const scored = scanSubmitScoredRef.current;
    const circleId = scanSubmit?.circle_id;
    scanSubmitScoredRef.current = false;
    setScanSubmit(null);
    if (scored) {
      setScanOpen(false);
      setResult(null);
      if (circleId) openCircle(circleId);
    }
  };

  const removeSavedById = (id) => {
    const recipeKey = Object.keys(savedRecipeIds).find(key => savedRecipeIds[key] === id);
    if (recipeKey) {
      setSavedRecipeIds(prev => {
        const updated = { ...prev };
        delete updated[recipeKey];
        return updated;
      });
    }
  };

  const renderProfile = () => (
    <div className="screen">
      <Profile user={user} />
      <div className="account-links">
        <button className="account-link" onClick={() => setShowPreferences(true)}>
          <UtensilsIcon size={22} />
          Taste preferences
          <ChevronRightIcon size={20} className="account-link__chevron" />
        </button>
        <button className="account-link" onClick={handleSignOut}>
          <LogOutIcon size={22} />
          Sign out
        </button>
      </div>
    </div>
  );

  const renderView = () => {
    switch (currentView) {
      case 'circle':
        return (
          <CircleDetail
            user={user}
            circleId={activeCircleId}
            onBack={() => setCurrentView('circles')}
            pendingCook={pendingCook}
            onPendingCookChange={refreshPendingCook}
            onOpenScan={openScan}
            autoOpenSubmit={autoOpenSubmit}
            onAutoSubmitHandled={clearAutoSubmit}
          />
        );
      case 'profile':
        return renderProfile();
      case 'history':
        return <History user={user} />;
      case 'saved':
        return <SavedRecipes user={user} onUnsave={removeSavedById} />;
      default:
        return <Circles user={user} onOpenCircle={openCircle} />;
    }
  };

  if (!authResolved) {
    return (
      <div className="splash">
        <span className="splash__wordmark">NutriSnap</span>
        <span className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (needsOnboarding) {
    return <OnboardingFlow user={user} onComplete={() => setNeedsOnboarding(false)} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__brand">
            <span className="app-header__wordmark">NutriSnap</span>
          </div>
          <button className="icon-btn" onClick={() => setShowPreferences(true)} aria-label="Taste preferences">
            <SettingsIcon size={22} />
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="content-column">
          {joinError && (
            <div className="banner banner--error">
              <div className="banner__body">{joinError}</div>
              <button className="banner__close" onClick={() => setJoinError('')} aria-label="Dismiss">
                <CloseIcon size={18} />
              </button>
            </div>
          )}

          {pendingCook && (
            <div className="banner banner--info">
              <div className="banner__body" onClick={() => { openCircle(pendingCook.circle_id); setAutoOpenSubmit(true); }} style={{ cursor: 'pointer' }}>
                You are cooking <strong>{pendingCook.recipe?.name}</strong> for {pendingCook.circle_name} —{' '}
                <span className="link-strong">submit your dish</span>
              </div>
              <button className="banner__close" onClick={dismissPendingCook} aria-label="Stop cooking this dish">
                <CloseIcon size={18} />
              </button>
            </div>
          )}

          {renderView()}
        </div>
      </main>

      <BottomNav currentView={currentView} onNavigate={setCurrentView} onSnap={openScan} />

      {scanOpen && (
        <div className="scan-flow" role="dialog" aria-label="Snap ingredients">
          <div className="scan-flow__header">
            <button className="icon-btn" onClick={closeScan} aria-label="Close">
              <CloseIcon size={20} />
            </button>
            <span className="scan-flow__title">{result ? 'Your recipes' : 'Snap ingredients'}</span>
          </div>
          <div className="scan-flow__body">
            <div className="scan-flow__column">
              {result ? (
                <AnalysisResults
                  data={result}
                  onReset={() => setResult(null)}
                  onSaveRecipe={handleSaveRecipe}
                  savedRecipeIds={savedRecipeIds}
                  user={user}
                  onRequireAuth={() => {}}
                  onPendingCookChange={refreshPendingCook}
                  onScanSubmitNow={handleScanSubmitNow}
                  onScanCookFirst={handleScanCookFirst}
                />
              ) : (
                <>
                  <div className="home-hero">
                    <Mascot pose="wave" size={112} animate title="NutriSnap chef mascot" />
                    <h1>Snap it. Cook it. Win it.</h1>
                    <p>Photograph your ingredients and get instant recipes worth cooking.</p>
                  </div>
                  <UploadCard
                    onUpload={handleUpload}
                    isLoading={isLoading}
                    activeStep={activeStep}
                    steps={steps}
                    error={error}
                  />
                  {error && !error.includes("Not enough ingredients") && (
                    <div className="banner banner--error">
                      <div className="banner__body">{error}</div>
                    </div>
                  )}
                  <CustomDishInput
                    onGenerate={handleGenerateRecipe}
                    isLoading={customLoading}
                    error={customError}
                    autoFocus={scanMode === 'custom'}
                  />
                </>
              )}
            </div>
          </div>

          {scanSubmit && (
            <SubmitDish
              user={user}
              circleId={scanSubmit.circle_id}
              pendingCook={scanSubmit}
              onClose={handleScanSubmitClose}
              onSubmitted={handleScanSubmitScored}
              onPendingCookChange={refreshPendingCook}
            />
          )}
        </div>
      )}

      <PreferencesSurvey
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
        user={user}
      />
    </div>
  );
}

export default App;
