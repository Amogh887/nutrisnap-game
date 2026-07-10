import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

async function loadResolveApiUrl() {
  vi.resetModules();
  const mod = await import('../apiClient.js');
  return mod.resolveApiUrl;
}

describe('resolveApiUrl', () => {
  const originalBase = import.meta.env.VITE_API_BASE_URL;

  afterEach(() => {
    if (originalBase === undefined) {
      delete import.meta.env.VITE_API_BASE_URL;
    } else {
      import.meta.env.VITE_API_BASE_URL = originalBase;
    }
  });

  it('resolves a relative path against the configured API base', async () => {
    import.meta.env.VITE_API_BASE_URL = 'http://api.example.com';
    const resolveApiUrl = await loadResolveApiUrl();
    expect(resolveApiUrl('/media/x')).toBe('http://api.example.com/media/x');
  });

  it('resolves a relative path without a leading slash', async () => {
    import.meta.env.VITE_API_BASE_URL = 'http://api.example.com';
    const resolveApiUrl = await loadResolveApiUrl();
    expect(resolveApiUrl('media/x')).toBe('http://api.example.com/media/x');
  });

  it('passes absolute http URLs through unchanged', async () => {
    import.meta.env.VITE_API_BASE_URL = 'http://api.example.com';
    const resolveApiUrl = await loadResolveApiUrl();
    expect(resolveApiUrl('http://other.example.com/media/x')).toBe('http://other.example.com/media/x');
  });

  it('passes absolute https URLs through unchanged', async () => {
    import.meta.env.VITE_API_BASE_URL = 'http://api.example.com';
    const resolveApiUrl = await loadResolveApiUrl();
    expect(resolveApiUrl('https://other.example.com/media/x')).toBe('https://other.example.com/media/x');
  });

  it('does not produce a double slash when the base already ends in one', async () => {
    import.meta.env.VITE_API_BASE_URL = 'http://api.example.com/';
    const resolveApiUrl = await loadResolveApiUrl();
    const result = resolveApiUrl('/media/x');
    expect(result).toBe('http://api.example.com/media/x');
    expect(result).not.toMatch(/([^:])\/\//);
  });

  it('returns an empty string for a falsy path', async () => {
    import.meta.env.VITE_API_BASE_URL = 'http://api.example.com';
    const resolveApiUrl = await loadResolveApiUrl();
    expect(resolveApiUrl('')).toBe('');
    expect(resolveApiUrl(undefined)).toBe('');
  });
});

describe('resolveApiUrl without VITE_API_BASE_URL (window fallback)', () => {
  const originalBase = import.meta.env.VITE_API_BASE_URL;
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const originalWindow = globalThis.window;

  beforeEach(() => {
    delete import.meta.env.VITE_API_BASE_URL;
    globalThis.window = {
      location: { hostname: 'testhost', origin: 'http://testhost:5173' },
    };
  });

  afterEach(() => {
    if (originalBase === undefined) {
      delete import.meta.env.VITE_API_BASE_URL;
    } else {
      import.meta.env.VITE_API_BASE_URL = originalBase;
    }
    if (hadWindow) {
      globalThis.window = originalWindow;
    } else {
      delete globalThis.window;
    }
  });

  it('falls back to window.location when no explicit base is configured', async () => {
    const resolveApiUrl = await loadResolveApiUrl();
    const result = resolveApiUrl('/media/x');
    expect(result.endsWith('/media/x')).toBe(true);
    expect(result).not.toMatch(/([^:])\/\//);
  });
});
