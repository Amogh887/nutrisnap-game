// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { setMatchMedia } from './testUtils.jsx';
import Confetti from '../components/Confetti.jsx';

describe('Confetti and prefers-reduced-motion', () => {
  afterEach(() => {
    delete window.matchMedia;
    cleanup();
  });

  it('renders nothing when the user prefers reduced motion, even when active', () => {
    setMatchMedia(true);
    const { container } = render(<Confetti active pieceCount={40} />);

    expect(container).toBeEmptyDOMElement();
    expect(container.querySelectorAll('.confetti-piece').length).toBe(0);
  });

  it('renders confetti pieces when active and motion is not reduced', () => {
    setMatchMedia(false);
    const { container } = render(<Confetti active pieceCount={40} />);

    expect(container.querySelectorAll('.confetti-piece').length).toBe(40);
  });

  it('renders nothing when inactive, regardless of motion preference', () => {
    setMatchMedia(false);
    const { container } = render(<Confetti active={false} pieceCount={40} />);

    expect(container).toBeEmptyDOMElement();
  });
});
