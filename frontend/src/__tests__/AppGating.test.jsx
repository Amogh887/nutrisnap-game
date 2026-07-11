// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { jsonResponse, makeFirebaseUser } from './testUtils.jsx';

const mockOnAuthStateChanged = vi.fn();
const mockSignOut = vi.fn();

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
  signOut: (...args) => mockSignOut(...args),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {}),
}));

vi.mock('../firebase', () => ({
  auth: {},
  googleProvider: {},
  default: {},
}));

const mockRequestApi = vi.fn();

vi.mock('../apiClient', () => ({
  requestApi: (...args) => mockRequestApi(...args),
  resolveApiUrl: (path) => path,
}));

import App from '../App.jsx';

describe('App auth and onboarding gating', () => {
  beforeEach(() => {
    mockOnAuthStateChanged.mockReset();
    mockSignOut.mockReset();
    mockRequestApi.mockReset();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the full-screen AuthScreen and no tabbed shell when logged out', async () => {
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null);
      return () => {};
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText('Continue with Google')).toBeInTheDocument());
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Snap ingredients' })).not.toBeInTheDocument();
    expect(mockRequestApi).not.toHaveBeenCalled();
  });

  it('shows onboarding when has_onboarded is false, even with a specific cuisine set', async () => {
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      callback(makeFirebaseUser());
      return () => {};
    });
    mockRequestApi.mockImplementation(async ({ path }) => {
      if (path === 'preferences') {
        return jsonResponse({ has_onboarded: false, cuisine_preferences: 'italian' });
      }
      return jsonResponse({});
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText('What should we call you?')).toBeInTheDocument());
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
  });

  it('shows onboarding when cuisine_preferences is "any", even if has_onboarded is true', async () => {
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      callback(makeFirebaseUser());
      return () => {};
    });
    mockRequestApi.mockImplementation(async ({ path }) => {
      if (path === 'preferences') {
        return jsonResponse({ has_onboarded: true, cuisine_preferences: 'any' });
      }
      return jsonResponse({});
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText('What should we call you?')).toBeInTheDocument());
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
  });

  it('skips onboarding and lands on the circles tab when both conditions are satisfied', async () => {
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      callback(makeFirebaseUser());
      return () => {};
    });
    mockRequestApi.mockImplementation(async ({ path }) => {
      if (path === 'preferences') {
        return jsonResponse({ has_onboarded: true, cuisine_preferences: 'italian' });
      }
      if (path === 'circles') {
        return jsonResponse([]);
      }
      return jsonResponse({});
    });

    render(<App />);

    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument());
    expect(screen.queryByText('What should we call you?')).not.toBeInTheDocument();

    const circlesTab = screen.getByRole('button', { name: /Circles/ });
    expect(circlesTab).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: 'Circles' })).toBeInTheDocument();
  });
});
