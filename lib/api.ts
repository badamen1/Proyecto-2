import type { RefreshResponse } from './types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const REFRESH_PATH = '/api/auth/login/refresh/';

let refreshPromise: Promise<string> | null = null;

function buildUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${BASE_URL}${path}`;
}

function authHeaders(): Record<string, string> {
  const token = window.localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function logoutAndRedirect(): void {
  window.localStorage.removeItem('access_token');
  window.localStorage.removeItem('refresh_token');
  window.localStorage.removeItem('user_role');
  if (typeof window !== 'undefined') {
    window.location.assign('/login');
  }
}

async function doRefresh(): Promise<string> {
  const refresh = window.localStorage.getItem('refresh_token');
  if (!refresh) {
    throw new Error('No refresh token');
  }

  const res = await fetch(`${BASE_URL}${REFRESH_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });

  if (!res.ok) {
    throw new Error('Refresh failed');
  }

  const data = (await res.json()) as RefreshResponse;
  window.localStorage.setItem('access_token', data.access);
  return data.access;
}

function getOrStartRefresh(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function requestOnce(
  path: string,
  opts: RequestInit,
  tokenOverride?: string
): Promise<Response> {
  const authHeader = tokenOverride
    ? { Authorization: `Bearer ${tokenOverride}` }
    : authHeaders();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeader,
    ...(opts.headers as Record<string, string> ?? {}),
  };

  return fetch(buildUrl(path), { ...opts, headers });
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  let res = await requestOnce(path, opts);

  if (res.status === 401) {
    try {
      const newToken = await getOrStartRefresh();
      res = await requestOnce(path, opts, newToken);
    } catch {
      logoutAndRedirect();
      throw new Error('Sesión expirada');
    }
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || res.statusText);
  }

  return res.json() as Promise<T>;
}

export async function apiFetchBlob(
  path: string,
  opts: RequestInit = {}
): Promise<Blob> {
  let res = await requestOnce(path, opts);

  if (res.status === 401) {
    try {
      const newToken = await getOrStartRefresh();
      res = await requestOnce(path, opts, newToken);
    } catch {
      logoutAndRedirect();
      throw new Error('Sesión expirada');
    }
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || res.statusText);
  }

  return res.blob();
}
