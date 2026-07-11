// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import BottomNav from '../components/BottomNav.jsx';

describe('BottomNav', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the four tabs plus the camera FAB with an accessible label', () => {
    render(<BottomNav currentView="circles" onNavigate={() => {}} onSnap={() => {}} />);

    expect(screen.getByRole('button', { name: /Circles/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /History/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Saved/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /You/ })).toBeInTheDocument();

    const fab = screen.getByRole('button', { name: 'Snap ingredients' });
    expect(fab).toBeInTheDocument();
    expect(fab).toHaveAccessibleName('Snap ingredients');
  });

  it('marks the tab matching currentView as active via aria-current', () => {
    render(<BottomNav currentView="history" onNavigate={() => {}} onSnap={() => {}} />);

    expect(screen.getByRole('button', { name: /History/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Circles/ })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: /Saved/ })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: /You/ })).not.toHaveAttribute('aria-current');
  });

  it('treats the circle-detail view as part of the Circles tab', () => {
    render(<BottomNav currentView="circle" onNavigate={() => {}} onSnap={() => {}} />);

    expect(screen.getByRole('button', { name: /Circles/ })).toHaveAttribute('aria-current', 'page');
  });

  it('treats the profile view as part of the You tab', () => {
    render(<BottomNav currentView="profile" onNavigate={() => {}} onSnap={() => {}} />);

    expect(screen.getByRole('button', { name: /You/ })).toHaveAttribute('aria-current', 'page');
  });

  it('invokes onNavigate with the target tab key when a tab is clicked', async () => {
    const onNavigate = vi.fn();
    const ue = userEvent.setup();
    render(<BottomNav currentView="circles" onNavigate={onNavigate} onSnap={() => {}} />);

    await ue.click(screen.getByRole('button', { name: /History/ }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('history');

    await ue.click(screen.getByRole('button', { name: /Saved/ }));
    expect(onNavigate).toHaveBeenCalledWith('saved');

    await ue.click(screen.getByRole('button', { name: /You/ }));
    expect(onNavigate).toHaveBeenCalledWith('profile');
  });

  it('invokes onSnap and not onNavigate when the camera FAB is clicked', async () => {
    const onSnap = vi.fn();
    const onNavigate = vi.fn();
    const ue = userEvent.setup();
    render(<BottomNav currentView="circles" onNavigate={onNavigate} onSnap={onSnap} />);

    await ue.click(screen.getByRole('button', { name: 'Snap ingredients' }));
    expect(onSnap).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
