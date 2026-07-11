import { vi } from 'vitest';

export function jsonResponse(data, ok = true, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

export function makeFirebaseUser(overrides = {}) {
  return {
    uid: 'test-uid-1',
    displayName: 'Jamie Rivera',
    email: 'jamie@example.com',
    photoURL: null,
    getIdToken: vi.fn().mockResolvedValue('fake-id-token'),
    ...overrides,
  };
}

export function setMatchMedia(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
