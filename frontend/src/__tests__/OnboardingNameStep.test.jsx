// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { jsonResponse, makeFirebaseUser } from './testUtils.jsx';

const mockRequestApi = vi.fn();

vi.mock('../apiClient', () => ({
  requestApi: (...args) => mockRequestApi(...args),
  resolveApiUrl: (path) => path,
}));

import OnboardingFlow from '../components/OnboardingFlow.jsx';

describe('OnboardingFlow name-confirm step', () => {
  beforeEach(() => {
    mockRequestApi.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('pre-fills the display name input from the firebase user displayName', () => {
    render(<OnboardingFlow user={makeFirebaseUser({ displayName: 'Jamie Rivera' })} onComplete={() => {}} />);

    expect(screen.getByLabelText('Display name')).toHaveValue('Jamie Rivera');
  });

  it('leaves the input blank when the firebase user has no displayName', () => {
    render(<OnboardingFlow user={makeFirebaseUser({ displayName: null })} onComplete={() => {}} />);

    expect(screen.getByLabelText('Display name')).toHaveValue('');
  });

  it('submits a PUT to profile with a { profile: { display_name } } payload on continue', async () => {
    mockRequestApi.mockResolvedValue(jsonResponse({ message: 'Profile updated' }));
    const user = makeFirebaseUser({ displayName: 'Jamie Rivera' });
    const ue = userEvent.setup();

    render(<OnboardingFlow user={user} onComplete={() => {}} />);

    const input = screen.getByLabelText('Display name');
    await ue.clear(input);
    await ue.type(input, 'Alex Chen');
    await ue.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      const profileCall = mockRequestApi.mock.calls.find(([args]) => args.path === 'profile');
      expect(profileCall).toBeTruthy();
    });

    const [callArgs] = mockRequestApi.mock.calls.find(([args]) => args.path === 'profile');
    expect(callArgs.method).toBe('PUT');
    expect(JSON.parse(callArgs.body)).toEqual({ profile: { display_name: 'Alex Chen' } });
  });

  it('advances to the preferences survey step after a successful save', async () => {
    mockRequestApi.mockResolvedValue(jsonResponse({ message: 'Profile updated' }));
    const ue = userEvent.setup();

    render(<OnboardingFlow user={makeFirebaseUser()} onComplete={() => {}} />);
    await ue.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(screen.getByText('How do you like to eat?')).toBeInTheDocument());
  });

  it('shows an error and does not advance when the save request fails', async () => {
    mockRequestApi.mockResolvedValue(jsonResponse({ detail: 'nope' }, false, 500));
    const ue = userEvent.setup();

    render(<OnboardingFlow user={makeFirebaseUser()} onComplete={() => {}} />);
    await ue.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(screen.getByText('Could not save your name. Please try again.')).toBeInTheDocument());
    expect(screen.queryByText('How do you like to eat?')).not.toBeInTheDocument();
  });

  it('disables continue while the name field is blank', () => {
    render(<OnboardingFlow user={makeFirebaseUser({ displayName: '' })} onComplete={() => {}} />);

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
});
