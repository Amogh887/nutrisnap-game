// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { jsonResponse, makeFirebaseUser } from './testUtils.jsx';

const mockOnAuthStateChanged = vi.fn();

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
  signOut: vi.fn(),
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

async function renderOnboardedApp() {
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
    if (path === 'food-history') {
      return jsonResponse([]);
    }
    return jsonResponse({});
  });

  render(<App />);
  await waitFor(() => expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument());
}

describe('scan flow open/close', () => {
  beforeEach(() => {
    mockOnAuthStateChanged.mockReset();
    mockRequestApi.mockReset();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
  });

  it('opens the full-screen scan layer from the FAB', async () => {
    await renderOnboardedApp();
    const ue = userEvent.setup();

    expect(screen.queryByRole('dialog', { name: 'Snap ingredients' })).not.toBeInTheDocument();

    await ue.click(screen.getByRole('button', { name: 'Snap ingredients' }));

    expect(screen.getByRole('dialog', { name: 'Snap ingredients' })).toBeInTheDocument();
    expect(screen.getByText('Snap it. Cook it. Win it.')).toBeInTheDocument();
  });

  it('closing the scan layer returns to the tab that was active before it opened', async () => {
    await renderOnboardedApp();
    const ue = userEvent.setup();

    await ue.click(screen.getByRole('button', { name: /History/ }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'No history yet' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /History/ })).toHaveAttribute('aria-current', 'page');

    await ue.click(screen.getByRole('button', { name: 'Snap ingredients' }));
    const dialog = screen.getByRole('dialog', { name: 'Snap ingredients' });
    expect(dialog).toBeInTheDocument();

    await ue.click(within(dialog).getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No history yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /History/ })).toHaveAttribute('aria-current', 'page');
  });
});
