const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? `http://${window.location.hostname}:8000` : window.location.origin);

const getApiCandidates = (path) => {
  const baseUrl = API_BASE_URL.replace(/\/$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  return [
    `${baseUrl}/api/${cleanPath}`,
    `${baseUrl}/api/index.py/${cleanPath}`,
    `${baseUrl}/${cleanPath}`,
  ];
};

export const resolveApiUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const baseUrl = API_BASE_URL.replace(/\/$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  return `${baseUrl}/${cleanPath}`;
};

export const requestApi = async ({ path, method = 'GET', headers = {}, body, signal }) => {
  const urls = getApiCandidates(path);
  let response = null;
  let lastError = null;
  let hit404 = false;

  for (const url of urls) {
    try {
      response = await fetch(url, {
        method,
        headers,
        body,
        signal,
      });

      if (response.status !== 404) {
        return response;
      }

      hit404 = true;
    } catch (error) {
      lastError = error;
    }
  }

  if (hit404) {
    throw new Error(`Server error: 404 (Tried: ${urls.join(' | ')})`);
  }

  if (response) {
    return response;
  }
  throw lastError || new Error('Failed to reach API endpoint.');
};
