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

import CircleDetail from '../components/CircleDetail.jsx';

const CIRCLE_ID = 'circle1';

function circleResponse(overrides = {}) {
  return {
    id: CIRCLE_ID,
    name: 'Test Circle',
    invite_code: 'ABCD1234',
    my_scored_today: 0,
    my_attempts_today: 0,
    ...overrides,
  };
}

function leaderboardResponse(overrides = {}) {
  return {
    week_key: '2026-W29',
    is_finalized: false,
    standings: [],
    ...overrides,
  };
}

async function renderCircleDetail(props = {}) {
  render(
    <CircleDetail
      user={makeFirebaseUser()}
      circleId={CIRCLE_ID}
      onBack={vi.fn()}
      pendingCook={null}
      onPendingCookChange={vi.fn()}
      onOpenScan={vi.fn()}
      autoOpenSubmit={false}
      onAutoSubmitHandled={vi.fn()}
      {...props}
    />
  );
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Test Circle' })).toBeInTheDocument());
}

describe('CircleDetail cook CTA and auto-open-submit', () => {
  beforeEach(() => {
    mockRequestApi.mockReset();
    mockRequestApi.mockImplementation(async ({ path }) => {
      if (path === `circles/${CIRCLE_ID}`) return jsonResponse(circleResponse());
      if (path === `circles/${CIRCLE_ID}/leaderboard`) return jsonResponse(leaderboardResponse());
      return jsonResponse({});
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('invokes onOpenScan with "photo" from the header CTA "Snap ingredients" button', async () => {
    const onOpenScan = vi.fn();
    await renderCircleDetail({ onOpenScan });
    const ue = userEvent.setup();

    const snapButtons = screen.getAllByRole('button', { name: /Snap ingredients/ });
    await ue.click(snapButtons[0]);

    expect(onOpenScan).toHaveBeenCalledWith('photo');
  });

  it('invokes onOpenScan with "custom" from the header CTA "Name your own dish" button', async () => {
    const onOpenScan = vi.fn();
    await renderCircleDetail({ onOpenScan });
    const ue = userEvent.setup();

    const customButtons = screen.getAllByRole('button', { name: /Name your own dish/ });
    await ue.click(customButtons[0]);

    expect(onOpenScan).toHaveBeenCalledWith('custom');
  });

  it('hides the header cook CTA when there is a pending cook for this circle', async () => {
    await renderCircleDetail({
      pendingCook: { circle_id: CIRCLE_ID, recipe: { name: 'Egg Sandwich' } },
    });

    expect(screen.getByText('Ready to submit?')).toBeInTheDocument();
    expect(screen.queryByText('Cook a dish for this circle')).not.toBeInTheDocument();
  });

  it('opens the submit modal exactly once and calls onAutoSubmitHandled when autoOpenSubmit is true', async () => {
    const onAutoSubmitHandled = vi.fn();
    await renderCircleDetail({
      autoOpenSubmit: true,
      onAutoSubmitHandled,
      pendingCook: { circle_id: CIRCLE_ID, recipe: { name: 'Egg Sandwich' } },
    });

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Submit your dish' })).toBeInTheDocument());
    expect(onAutoSubmitHandled).toHaveBeenCalledTimes(1);
  });

  it('does not open the submit modal when autoOpenSubmit is false', async () => {
    await renderCircleDetail({ autoOpenSubmit: false });

    expect(screen.queryByRole('heading', { name: 'Submit your dish' })).not.toBeInTheDocument();
  });
});
