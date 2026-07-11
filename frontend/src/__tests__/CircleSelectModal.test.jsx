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

import CircleSelectModal from '../components/CircleSelectModal.jsx';

const PENDING_COOK_KEY = 'nutrisnap_pending_cook';

async function lockInFirstCircle() {
  const ue = userEvent.setup();
  await waitFor(() => expect(screen.getByText('Test Circle')).toBeInTheDocument());
  await ue.click(screen.getByText('Test Circle').closest('button'));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Locked in' })).toBeInTheDocument());
  return ue;
}

describe('CircleSelectModal locked-in actions', () => {
  beforeEach(() => {
    mockRequestApi.mockReset();
    mockRequestApi.mockImplementation(async ({ path }) => {
      if (path === 'circles') {
        return jsonResponse([{ id: 'circle1', name: 'Test Circle', member_count: 2 }]);
      }
      return jsonResponse({});
    });
    window.localStorage.removeItem(PENDING_COOK_KEY);
  });

  afterEach(() => {
    cleanup();
    window.localStorage.removeItem(PENDING_COOK_KEY);
  });

  it('shows the two locked-in actions after picking a circle and persists the pending cook snapshot', async () => {
    const onPendingCookChange = vi.fn();
    render(
      <CircleSelectModal
        user={makeFirebaseUser()}
        recipe={{ name: 'Egg Sandwich' }}
        detectedIngredients={['egg']}
        onClose={vi.fn()}
        onRequireAuth={vi.fn()}
        onPendingCookChange={onPendingCookChange}
        onSubmitNow={vi.fn()}
        onCookFirst={vi.fn()}
      />
    );

    await lockInFirstCircle();

    expect(screen.getByRole('button', { name: 'Submit photo now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "I'll cook it first" })).toBeInTheDocument();
    expect(onPendingCookChange).toHaveBeenCalledTimes(1);

    const stored = JSON.parse(window.localStorage.getItem(PENDING_COOK_KEY));
    expect(stored.circle_id).toBe('circle1');
    expect(stored.circle_name).toBe('Test Circle');
    expect(stored.recipe).toEqual({ name: 'Egg Sandwich' });
  });

  it('calls onSubmitNow when "Submit photo now" is clicked', async () => {
    const onSubmitNow = vi.fn();
    render(
      <CircleSelectModal
        user={makeFirebaseUser()}
        recipe={{ name: 'Egg Sandwich' }}
        detectedIngredients={[]}
        onClose={vi.fn()}
        onRequireAuth={vi.fn()}
        onPendingCookChange={vi.fn()}
        onSubmitNow={onSubmitNow}
        onCookFirst={vi.fn()}
      />
    );

    const ue = await lockInFirstCircle();
    await ue.click(screen.getByRole('button', { name: 'Submit photo now' }));

    expect(onSubmitNow).toHaveBeenCalledTimes(1);
  });

  it('calls onCookFirst when "I\'ll cook it first" is clicked', async () => {
    const onCookFirst = vi.fn();
    render(
      <CircleSelectModal
        user={makeFirebaseUser()}
        recipe={{ name: 'Egg Sandwich' }}
        detectedIngredients={[]}
        onClose={vi.fn()}
        onRequireAuth={vi.fn()}
        onPendingCookChange={vi.fn()}
        onSubmitNow={vi.fn()}
        onCookFirst={onCookFirst}
      />
    );

    const ue = await lockInFirstCircle();
    await ue.click(screen.getByRole('button', { name: "I'll cook it first" }));

    expect(onCookFirst).toHaveBeenCalledTimes(1);
  });

  it('prompts sign-in instead of listing circles when there is no user', async () => {
    const onRequireAuth = vi.fn();
    const onClose = vi.fn();
    render(
      <CircleSelectModal
        user={null}
        recipe={{ name: 'Egg Sandwich' }}
        detectedIngredients={[]}
        onClose={onClose}
        onRequireAuth={onRequireAuth}
        onPendingCookChange={vi.fn()}
        onSubmitNow={vi.fn()}
        onCookFirst={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Sign in to compete' })).toBeInTheDocument();
    const ue = userEvent.setup();
    await ue.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRequireAuth).toHaveBeenCalledTimes(1);
    expect(mockRequestApi).not.toHaveBeenCalled();
  });
});
