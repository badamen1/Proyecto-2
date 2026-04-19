import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('apiFetch', () => {
  it('inyecta el token Bearer y retorna el JSON parseado en 200', async () => {
    window.localStorage.setItem('access_token', 'tok-123');

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, data: [1, 2] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { apiFetch } = await import('@/lib/api');
    const result = await apiFetch<{ ok: boolean; data: number[] }>('/api/test/');

    expect(result).toEqual({ ok: true, data: [1, 2] });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/test/');
    expect((init?.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-123');
  });
});
