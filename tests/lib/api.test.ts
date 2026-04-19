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

  it('ante 401 hace refresh y reintenta la request original', async () => {
    window.localStorage.setItem('access_token', 'tok-viejo');
    window.localStorage.setItem('refresh_token', 'refresh-abc');

    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response('{"detail":"expired"}', { status: 401 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access: 'tok-nuevo' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: 'hola' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const { apiFetch } = await import('@/lib/api');
    const result = await apiFetch<{ data: string }>('/api/test/');

    expect(result).toEqual({ data: 'hola' });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy.mock.calls[1][0]).toBe('http://localhost:8000/api/auth/login/refresh/');
    expect(window.localStorage.getItem('access_token')).toBe('tok-nuevo');
    const retryInit = fetchSpy.mock.calls[2][1];
    expect((retryInit?.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-nuevo');
  });

  it('si el refresh falla, limpia tokens y lanza error de sesion', async () => {
    window.localStorage.setItem('access_token', 'tok-viejo');
    window.localStorage.setItem('refresh_token', 'refresh-malo');
    window.localStorage.setItem('user_role', 'paciente');

    const assignSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, assign: assignSpy },
    });

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('{"detail":"expired"}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"detail":"invalid"}', { status: 401 }));

    const { apiFetch } = await import('@/lib/api');
    await expect(apiFetch('/api/test/')).rejects.toThrow(/sesi/i);

    expect(window.localStorage.getItem('access_token')).toBeNull();
    expect(window.localStorage.getItem('refresh_token')).toBeNull();
    expect(window.localStorage.getItem('user_role')).toBeNull();
    expect(assignSpy).toHaveBeenCalledWith('/login');
  });
});
