# Vista de Resultados del Paciente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la experiencia del paciente para consultar y descargar sus resultados clínicos validados, con helper de API robusto (auto-refresh JWT) y paginación.

**Architecture:** Next.js 16 App Router + React 19 client components. Un helper `lib/api.ts` centraliza el acceso a la API Django (base URL, Bearer token, auto-refresh en 401). Dos páginas nuevas (`/dashboard/resultados` lista paginada "load more" y `/dashboard/resultados/[id]` detalle con iframe PDF vía blob URL autenticado). El dashboard actual se actualiza para mostrar conteo real. Estilos inline se mantienen por consistencia.

**Tech Stack:** Next.js 16.1.4, React 19, TypeScript 5, Vitest 4 + Testing Library, Tailwind 4 (no usado en este plan), Django REST Framework (backend ya existente), SimpleJWT para auth.

**Spec:** `docs/superpowers/specs/2026-04-19-vista-resultados-paciente-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `.env.local.example` | Create | Documentar `NEXT_PUBLIC_API_URL` |
| `lib/types.ts` | Create | Tipos compartidos: `PaginatedResponse`, `Resultado*` |
| `lib/api.ts` | Create | `apiFetch`, `apiFetchBlob`, `logoutAndRedirect` con auto-refresh |
| `app/dashboard/resultados/page.tsx` | Create | Lista paginada |
| `app/dashboard/resultados/[id]/page.tsx` | Create | Detalle + iframe PDF |
| `app/dashboard/page.tsx` | Modify | Card del paciente con conteo real + Link funcional |
| `tests/lib/api.test.ts` | Create | Tests unitarios de `apiFetch` |
| `tests/app/dashboard/resultados-list.test.tsx` | Create | Tests del listado |
| `tests/app/dashboard/resultados-detail.test.tsx` | Create | Tests del detalle |
| `tests/dashboard-page.test.tsx` | Modify | Añadir casos con fetch mockeado |

---

## Task 1: Configuración de entorno y tipos compartidos

**Files:**
- Create: `.env.local.example`
- Create: `lib/types.ts`

- [ ] **Step 1: Crear `.env.local.example` con la variable de entorno**

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- [ ] **Step 2: Crear `lib/types.ts` con los tipos compartidos**

```ts
// lib/types.ts
export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type ResultadoEstado = 'PENDIENTE' | 'VALIDADO' | 'ENTREGADO';
export type ResultadoFuente = 'FASIL' | 'EXTERNO' | 'MANUAL';

export type ResultadoLista = {
  id: number;
  paciente_nombre: string;
  paciente_documento: string;
  empresa_nombre: string | null;
  tipo_examen: string;
  fuente: ResultadoFuente;
  estado: ResultadoEstado;
  fecha_examen: string;
  fecha_carga: string;
  nombre_archivo: string | null;
};

export type ResultadoDetalle = ResultadoLista & {
  paciente: number;
  empresa: number | null;
  subido_por: number | null;
  subido_por_nombre: string | null;
  archivo_pdf: string;
  tipo_archivo: string;
  fecha_actualizacion: string;
  observaciones: string;
  id_orden_fasil: string | null;
};

export type RefreshResponse = {
  access: string;
};
```

- [ ] **Step 3: Verificar que TS compile**

Run: `npx tsc --noEmit`
Expected: Sin errores (los tipos nuevos son auto-contenidos).

- [ ] **Step 4: Commit**

```bash
git add .env.local.example lib/types.ts
git commit -m "feat(frontend): agregar tipos compartidos y env var NEXT_PUBLIC_API_URL

Prepara la base para el helper lib/api.ts y las vistas de resultados
del paciente."
```

---

## Task 2: Test — `apiFetch` happy path

**Files:**
- Create: `tests/lib/api.test.ts`

- [ ] **Step 1: Escribir el test del happy path**

```ts
// tests/lib/api.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage a nivel de módulo (jsdom ya lo provee, lo limpiamos)
beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
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
```

- [ ] **Step 2: Ejecutar el test para ver que falla**

Run: `npm test -- tests/lib/api.test.ts`
Expected: FAIL — módulo `@/lib/api` no existe.

- [ ] **Step 3: Crear `lib/api.ts` con la implementación mínima**

```ts
// lib/api.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

function buildUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${BASE_URL}${path}`;
}

function authHeaders(): Record<string, string> {
  const token = window.localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders(),
    ...(opts.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(buildUrl(path), { ...opts, headers });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || res.statusText);
  }

  return res.json() as Promise<T>;
}
```

- [ ] **Step 4: Ejecutar el test — debe pasar**

Run: `npm test -- tests/lib/api.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add lib/api.ts tests/lib/api.test.ts
git commit -m "feat(frontend): apiFetch base con inyeccion de token Bearer"
```

---

## Task 3: Test — `apiFetch` maneja 401 con refresh exitoso

**Files:**
- Modify: `tests/lib/api.test.ts`
- Modify: `lib/api.ts`

- [ ] **Step 1: Agregar el test de refresh exitoso al archivo existente**

Añadir dentro del `describe('apiFetch', () => {...})`:

```ts
  it('ante 401 hace refresh y reintenta la request original', async () => {
    window.localStorage.setItem('access_token', 'tok-viejo');
    window.localStorage.setItem('refresh_token', 'refresh-abc');

    const fetchSpy = vi.spyOn(global, 'fetch')
      // 1. request original devuelve 401
      .mockResolvedValueOnce(
        new Response('{"detail":"expired"}', { status: 401 })
      )
      // 2. refresh devuelve nuevo access
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access: 'tok-nuevo' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      // 3. retry de la request original devuelve 200
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

    // El segundo call es al endpoint de refresh
    expect(fetchSpy.mock.calls[1][0]).toBe('http://localhost:8000/api/auth/login/refresh/');

    // El access_token en localStorage se actualizó
    expect(window.localStorage.getItem('access_token')).toBe('tok-nuevo');

    // El tercer call (retry) usa el nuevo token
    const retryInit = fetchSpy.mock.calls[2][1];
    expect((retryInit?.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-nuevo');
  });
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `npm test -- tests/lib/api.test.ts`
Expected: FAIL — el test nuevo falla porque `apiFetch` lanza en 401 en lugar de refrescar.

- [ ] **Step 3: Implementar la lógica de refresh en `lib/api.ts`**

Reemplazar el contenido completo de `lib/api.ts` con:

```ts
// lib/api.ts
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
```

- [ ] **Step 4: Ejecutar los dos tests — ambos deben pasar**

Run: `npm test -- tests/lib/api.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/api.ts tests/lib/api.test.ts
git commit -m "feat(frontend): auto-refresh de JWT en apiFetch con reintento"
```

---

## Task 4: Test — refresh fallido dispara logout

**Files:**
- Modify: `tests/lib/api.test.ts`

- [ ] **Step 1: Agregar el test de refresh fallido**

Añadir dentro del `describe('apiFetch', ...)`:

```ts
  it('si el refresh falla, limpia tokens y lanza error de sesion', async () => {
    window.localStorage.setItem('access_token', 'tok-viejo');
    window.localStorage.setItem('refresh_token', 'refresh-malo');
    window.localStorage.setItem('user_role', 'paciente');

    // Mock de window.location.assign
    const assignSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, assign: assignSpy },
    });

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('{"detail":"expired"}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"detail":"invalid"}', { status: 401 }));

    const { apiFetch } = await import('@/lib/api');
    await expect(apiFetch('/api/test/')).rejects.toThrow(/sesion expirada/i);

    expect(window.localStorage.getItem('access_token')).toBeNull();
    expect(window.localStorage.getItem('refresh_token')).toBeNull();
    expect(window.localStorage.getItem('user_role')).toBeNull();
    expect(assignSpy).toHaveBeenCalledWith('/login');
  });
```

- [ ] **Step 2: Ejecutar el test**

Run: `npm test -- tests/lib/api.test.ts`
Expected: PASS (3 tests). La lógica ya estaba implementada en Task 3; este test verifica el comportamiento.

- [ ] **Step 3: Commit**

```bash
git add tests/lib/api.test.ts
git commit -m "test(frontend): cubrir logout automatico cuando el refresh falla"
```

---

## Task 5: Test — refresh concurrente dispara solo un fetch de refresh

**Files:**
- Modify: `tests/lib/api.test.ts`

- [ ] **Step 1: Agregar el test de refresh concurrente**

```ts
  it('dos requests en paralelo con 401 solo disparan un refresh', async () => {
    window.localStorage.setItem('access_token', 'tok-viejo');
    window.localStorage.setItem('refresh_token', 'refresh-abc');

    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('/api/auth/login/refresh/')) {
          return new Response(JSON.stringify({ access: 'tok-nuevo' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        // Primer GET con token viejo → 401. Con el nuevo → 200.
        const auth = (init?.headers as Record<string, string> | undefined)?.['Authorization'] ?? '';
        if (auth === 'Bearer tok-nuevo') {
          return new Response('{"ok":true}', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('{"detail":"expired"}', { status: 401 });
      }
    );

    const { apiFetch } = await import('@/lib/api');
    const [a, b] = await Promise.all([
      apiFetch<{ ok: boolean }>('/api/a/'),
      apiFetch<{ ok: boolean }>('/api/b/'),
    ]);

    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });

    const refreshCalls = fetchSpy.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.endsWith('/api/auth/login/refresh/')
    );
    expect(refreshCalls).toHaveLength(1);
  });
```

- [ ] **Step 2: Ejecutar el test**

Run: `npm test -- tests/lib/api.test.ts`
Expected: PASS (4 tests). La variable de módulo `refreshPromise` implementada en Task 3 garantiza esto.

- [ ] **Step 3: Commit**

```bash
git add tests/lib/api.test.ts
git commit -m "test(frontend): verificar que refresh concurrente usa una sola promesa"
```

---

## Task 6: Agregar `apiFetchBlob` para descargas de PDF

**Files:**
- Modify: `tests/lib/api.test.ts`
- Modify: `lib/api.ts`

- [ ] **Step 1: Escribir el test de apiFetchBlob**

```ts
describe('apiFetchBlob', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('retorna un Blob con el contenido del archivo', async () => {
    window.localStorage.setItem('access_token', 'tok-123');
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(pdfBytes, {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      })
    );

    const { apiFetchBlob } = await import('@/lib/api');
    const blob = await apiFetchBlob('/api/resultados/1/pdf/');

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBe(4);
  });

  it('tambien dispara refresh si 401', async () => {
    window.localStorage.setItem('access_token', 'tok-viejo');
    window.localStorage.setItem('refresh_token', 'ref');

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access: 'tok-nuevo' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'Content-Type': 'application/pdf' },
        })
      );

    const { apiFetchBlob } = await import('@/lib/api');
    const blob = await apiFetchBlob('/api/resultados/1/pdf/');
    expect(blob.size).toBe(3);
  });
});
```

- [ ] **Step 2: Ejecutar — debe fallar**

Run: `npm test -- tests/lib/api.test.ts`
Expected: FAIL — `apiFetchBlob` no está exportada.

- [ ] **Step 3: Agregar `apiFetchBlob` a `lib/api.ts`**

Añadir al final de `lib/api.ts` (antes de cualquier línea en blanco final):

```ts
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
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm test -- tests/lib/api.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/api.ts tests/lib/api.test.ts
git commit -m "feat(frontend): apiFetchBlob con auth y auto-refresh para PDFs"
```

---

## Task 7: Página de lista `/dashboard/resultados` (tests primero)

**Files:**
- Create: `tests/app/dashboard/resultados-list.test.tsx`
- Create: `app/dashboard/resultados/page.tsx`

- [ ] **Step 1: Crear el test de render con datos**

```tsx
// tests/app/dashboard/resultados-list.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), prefetch: vi.fn() }),
}));

const mockApiFetch = vi.hoisted(() => vi.fn());
const mockApiFetchBlob = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({
  apiFetch: mockApiFetch,
  apiFetchBlob: mockApiFetchBlob,
  logoutAndRedirect: vi.fn(),
}));

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
  mockApiFetch.mockReset();
  mockApiFetchBlob.mockReset();
  mockPush.mockClear();
});

describe('Pagina /dashboard/resultados', () => {
  it('renderiza la lista de resultados del paciente', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'paciente');
    mockApiFetch.mockResolvedValueOnce({
      count: 2,
      next: null,
      previous: null,
      results: [
        {
          id: 1,
          paciente_nombre: 'Juan',
          paciente_documento: '123',
          empresa_nombre: null,
          tipo_examen: 'Hemograma',
          fuente: 'MANUAL',
          estado: 'VALIDADO',
          fecha_examen: '2026-04-01',
          fecha_carga: '2026-04-02T10:00:00Z',
          nombre_archivo: 'hemo.pdf',
        },
        {
          id: 2,
          paciente_nombre: 'Juan',
          paciente_documento: '123',
          empresa_nombre: 'Acme',
          tipo_examen: 'Perfil Lipidico',
          fuente: 'FASIL',
          estado: 'ENTREGADO',
          fecha_examen: '2026-03-15',
          fecha_carga: '2026-03-16T10:00:00Z',
          nombre_archivo: 'lip.pdf',
        },
      ],
    });

    const { default: Page } = await import('@/app/dashboard/resultados/page');
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText('Hemograma')).toBeInTheDocument();
      expect(screen.getByText('Perfil Lipidico')).toBeInTheDocument();
    });

    expect(screen.getByText(/mostrando 2 de 2/i)).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledWith('/api/resultados/');
  });

  it('muestra mensaje vacio cuando count=0', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'paciente');
    mockApiFetch.mockResolvedValueOnce({
      count: 0, next: null, previous: null, results: [],
    });

    const { default: Page } = await import('@/app/dashboard/resultados/page');
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText(/aun no tienes resultados/i)).toBeInTheDocument();
    });
  });

  it('redirige a /login si no hay token', async () => {
    const { default: Page } = await import('@/app/dashboard/resultados/page');
    render(<Page />);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });
});
```

- [ ] **Step 2: Ejecutar — debe fallar**

Run: `npm test -- tests/app/dashboard/resultados-list.test.tsx`
Expected: FAIL — la página no existe.

- [ ] **Step 3: Crear `app/dashboard/resultados/page.tsx`**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch, apiFetchBlob } from '@/lib/api';
import type { PaginatedResponse, ResultadoLista, ResultadoEstado } from '@/lib/types';

const badgeColors: Record<ResultadoEstado, { bg: string; color: string }> = {
  PENDIENTE: { bg: '#fff3cd', color: '#856404' },
  VALIDADO: { bg: '#d4edda', color: '#155724' },
  ENTREGADO: { bg: '#cce5ff', color: '#004085' },
};

function pathFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

export default function ResultadosListaPage() {
  const router = useRouter();
  const [results, setResults] = useState<ResultadoLista[]>([]);
  const [count, setCount] = useState(0);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PaginatedResponse<ResultadoLista>>('/api/resultados/');
      setResults(data.results);
      setCount(data.count);
      setNextUrl(data.next);
    } catch (err) {
      setError((err as Error).message || 'Error al cargar resultados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = window.localStorage.getItem('access_token');
    const role = window.localStorage.getItem('user_role');
    if (!token) {
      router.push('/login');
      return;
    }
    if (role !== 'paciente') {
      router.push('/dashboard');
      return;
    }
    void loadFirst();
  }, [router, loadFirst]);

  const loadMore = async () => {
    if (!nextUrl) return;
    setLoadingMore(true);
    try {
      const data = await apiFetch<PaginatedResponse<ResultadoLista>>(pathFromUrl(nextUrl));
      setResults((prev) => [...prev, ...data.results]);
      setNextUrl(data.next);
    } catch (err) {
      setError((err as Error).message || 'Error al cargar más');
    } finally {
      setLoadingMore(false);
    }
  };

  const descargarPDF = async (id: number, nombreArchivo: string | null) => {
    setDownloadingId(id);
    try {
      const blob = await apiFetchBlob(`/api/resultados/${id}/pdf/`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivo ?? `resultado_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('No se pudo descargar el PDF: ' + (err as Error).message);
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        Cargando resultados...
      </div>
    );
  }

  return (
    <section className="section" style={{ background: '#f4f6f9', minHeight: '90vh' }}>
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem', background: '#fff', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', color: 'var(--primary-blue)', margin: 0 }}>Mis Resultados</h1>
            <p style={{ color: 'var(--text-gray)', margin: 0, fontSize: '0.9rem' }}>Mostrando {results.length} de {count}</p>
          </div>
          <Link href="/dashboard" style={{ color: 'var(--primary-blue)', textDecoration: 'none', fontWeight: 'bold' }}>← Volver al dashboard</Link>
        </div>

        {error && (
          <div style={{ background: '#f8d7da', color: '#721c24', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
            {error}{' '}
            <button onClick={loadFirst} style={{ marginLeft: '10px', padding: '4px 10px', border: '1px solid #721c24', background: 'transparent', color: '#721c24', borderRadius: '4px', cursor: 'pointer' }}>
              Reintentar
            </button>
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          {count === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-gray)' }}>
              <i className="fas fa-file-medical-alt" style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem', display: 'block' }}></i>
              Aún no tienes resultados disponibles.
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '12px' }}>Tipo de examen</th>
                    <th style={{ padding: '12px' }}>Fecha</th>
                    <th style={{ padding: '12px' }}>Estado</th>
                    <th style={{ padding: '12px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const colors = badgeColors[r.estado];
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{r.tipo_examen}</td>
                        <td style={{ padding: '12px' }}>{new Date(r.fecha_examen).toLocaleDateString('es-CO')}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ background: colors.bg, color: colors.color, padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            {r.estado}
                          </span>
                        </td>
                        <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                          <Link href={`/dashboard/resultados/${r.id}`} style={{ background: 'var(--primary-blue)', color: '#fff', padding: '6px 12px', borderRadius: '4px', textDecoration: 'none', fontSize: '0.85rem' }}>
                            Ver
                          </Link>
                          <button
                            onClick={() => descargarPDF(r.id, r.nombre_archivo)}
                            disabled={downloadingId === r.id}
                            style={{ background: '#28a745', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                          >
                            {downloadingId === r.id ? 'Descargando...' : 'PDF'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {nextUrl && (
                <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    style={{ padding: '10px 25px', background: 'var(--primary-blue)', color: '#fff', border: 'none', borderRadius: '25px', cursor: 'pointer', fontSize: '0.9rem' }}
                  >
                    {loadingMore ? 'Cargando...' : 'Cargar más'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm test -- tests/app/dashboard/resultados-list.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Type check del proyecto**

Run: `npx tsc --noEmit`
Expected: Sin errores.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/resultados/page.tsx tests/app/dashboard/resultados-list.test.tsx
git commit -m "feat(frontend): pagina de lista de resultados del paciente con paginacion"
```

---

## Task 8: Página de detalle `/dashboard/resultados/[id]`

**Files:**
- Create: `tests/app/dashboard/resultados-detail.test.tsx`
- Create: `app/dashboard/resultados/[id]/page.tsx`

- [ ] **Step 1: Escribir el test del detalle**

```tsx
// tests/app/dashboard/resultados-detail.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: '42' }),
}));

const mockApiFetch = vi.hoisted(() => vi.fn());
const mockApiFetchBlob = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({
  apiFetch: mockApiFetch,
  apiFetchBlob: mockApiFetchBlob,
  logoutAndRedirect: vi.fn(),
}));

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
  mockApiFetch.mockReset();
  mockApiFetchBlob.mockReset();
  mockPush.mockClear();
  // Mock URL.createObjectURL / revokeObjectURL (no existen en jsdom)
  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    value: vi.fn(() => 'blob:mock-url'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    writable: true,
    value: vi.fn(),
  });
});

describe('Pagina /dashboard/resultados/[id]', () => {
  it('renderiza metadata y el iframe con blob URL', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'paciente');

    mockApiFetch.mockResolvedValueOnce({
      id: 42,
      paciente: 1,
      paciente_nombre: 'Juan',
      paciente_documento: '123',
      empresa: null,
      empresa_nombre: null,
      subido_por: 5,
      subido_por_nombre: 'dra_ana',
      tipo_examen: 'Hemograma Completo',
      fuente: 'MANUAL',
      estado: 'VALIDADO',
      archivo_pdf: '/media/resultados/paciente_123/hemo.pdf',
      tipo_archivo: 'application/pdf',
      nombre_archivo: 'hemo.pdf',
      fecha_examen: '2026-04-01',
      fecha_carga: '2026-04-02T10:00:00Z',
      fecha_actualizacion: '2026-04-02T10:00:00Z',
      observaciones: 'Valores normales.',
      id_orden_fasil: null,
    });
    mockApiFetchBlob.mockResolvedValueOnce(new Blob(['%PDF'], { type: 'application/pdf' }));

    const { default: Page } = await import('@/app/dashboard/resultados/[id]/page');
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText('Hemograma Completo')).toBeInTheDocument();
      expect(screen.getByText('VALIDADO')).toBeInTheDocument();
      expect(screen.getByText(/valores normales/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      const iframe = screen.getByTitle(/visor pdf/i) as HTMLIFrameElement;
      expect(iframe).toBeInTheDocument();
      expect(iframe.src).toContain('blob:mock-url');
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/resultados/42/');
    expect(mockApiFetchBlob).toHaveBeenCalledWith('/api/resultados/42/pdf/');
  });

  it('muestra mensaje de error si el resultado no existe', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'paciente');
    mockApiFetch.mockRejectedValueOnce(new Error('Not Found'));

    const { default: Page } = await import('@/app/dashboard/resultados/[id]/page');
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText(/no se encontro|no disponible/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Ejecutar — debe fallar**

Run: `npm test -- tests/app/dashboard/resultados-detail.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Crear `app/dashboard/resultados/[id]/page.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch, apiFetchBlob } from '@/lib/api';
import type { ResultadoDetalle, ResultadoEstado } from '@/lib/types';

const badgeColors: Record<ResultadoEstado, { bg: string; color: string }> = {
  PENDIENTE: { bg: '#fff3cd', color: '#856404' },
  VALIDADO: { bg: '#d4edda', color: '#155724' },
  ENTREGADO: { bg: '#cce5ff', color: '#004085' },
};

const fuenteLegible: Record<string, string> = {
  FASIL: 'Sistema FASIL',
  EXTERNO: 'Laboratorio Externo',
  MANUAL: 'Ingreso Manual',
};

export default function ResultadoDetallePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [resultado, setResultado] = useState<ResultadoDetalle | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }
    if (!id) return;

    let cancelled = false;
    let createdBlobUrl: string | null = null;

    (async () => {
      try {
        const data = await apiFetch<ResultadoDetalle>(`/api/resultados/${id}/`);
        if (cancelled) return;
        setResultado(data);
      } catch (err) {
        if (!cancelled) setError((err as Error).message || 'Resultado no disponible');
      } finally {
        if (!cancelled) setLoading(false);
      }

      try {
        const blob = await apiFetchBlob(`/api/resultados/${id}/pdf/`);
        if (cancelled) return;
        createdBlobUrl = URL.createObjectURL(blob);
        setBlobUrl(createdBlobUrl);
      } catch (err) {
        if (!cancelled) setPdfError((err as Error).message || 'No se pudo cargar el PDF');
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
  }, [id, router]);

  const descargarPDF = async () => {
    if (!id) return;
    try {
      const blob = await apiFetchBlob(`/api/resultados/${id}/pdf/`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resultado?.nombre_archivo ?? `resultado_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('No se pudo descargar: ' + (err as Error).message);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        Cargando resultado...
      </div>
    );
  }

  if (error || !resultado) {
    return (
      <section className="section" style={{ background: '#f4f6f9', minHeight: '90vh' }}>
        <div className="container" style={{ textAlign: 'center', padding: '4rem' }}>
          <h2 style={{ color: '#721c24' }}>Resultado no encontrado o no disponible</h2>
          <p style={{ color: 'var(--text-gray)' }}>{error}</p>
          <Link href="/dashboard/resultados" style={{ color: 'var(--primary-blue)', fontWeight: 'bold' }}>← Volver a mis resultados</Link>
        </div>
      </section>
    );
  }

  const colors = badgeColors[resultado.estado];

  return (
    <section className="section" style={{ background: '#f4f6f9', minHeight: '90vh' }}>
      <div className="container">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem', background: '#fff', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', color: 'var(--primary-blue)', margin: 0, display: 'inline-block', marginRight: '1rem' }}>{resultado.tipo_examen}</h1>
            <span style={{ background: colors.bg, color: colors.color, padding: '5px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold' }}>
              {resultado.estado}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={descargarPDF} style={{ background: '#28a745', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
              Descargar PDF
            </button>
            <Link href="/dashboard/resultados" style={{ background: '#f1f1f1', color: '#555', padding: '8px 16px', borderRadius: '4px', textDecoration: 'none' }}>← Volver</Link>
          </div>
        </div>

        {/* Metadata */}
        <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <MetaRow label="Fecha del examen" value={new Date(resultado.fecha_examen).toLocaleDateString('es-CO')} />
            <MetaRow label="Fecha de carga" value={new Date(resultado.fecha_carga).toLocaleString('es-CO')} />
            <MetaRow label="Fuente" value={fuenteLegible[resultado.fuente] ?? resultado.fuente} />
            <MetaRow label="Subido por" value={resultado.subido_por_nombre ?? '—'} />
            {resultado.observaciones && (
              <div style={{ gridColumn: '1 / span 2' }}>
                <MetaRow label="Observaciones" value={resultado.observaciones} />
              </div>
            )}
          </div>
        </div>

        {/* Visor PDF */}
        <div style={{ background: '#fff', borderRadius: '10px', padding: '1rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          {pdfLoading && <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando PDF...</div>}
          {pdfError && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#721c24' }}>
              No se pudo cargar el PDF. Puedes descargarlo con el botón de arriba.
            </div>
          )}
          {blobUrl && (
            <iframe
              title="Visor PDF del resultado"
              src={blobUrl}
              style={{ width: '100%', height: '800px', border: '1px solid #ddd', borderRadius: '8px' }}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-gray)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontWeight: 'bold', color: '#333' }}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm test -- tests/app/dashboard/resultados-detail.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: Sin errores.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/resultados/[id]/page.tsx tests/app/dashboard/resultados-detail.test.tsx
git commit -m "feat(frontend): pagina de detalle con visor PDF inline via blob URL"
```

---

## Task 9: Actualizar card "Resultados Recientes" en `/dashboard`

**Files:**
- Modify: `app/dashboard/page.tsx`
- Modify: `tests/dashboard-page.test.tsx`

- [ ] **Step 1: Leer el archivo actual para conservar contexto**

Ejecutar `cat app/dashboard/page.tsx` y localizar el bloque de la tarjeta "Resultados Recientes" (líneas ~99-108 actualmente).

- [ ] **Step 2: Modificar `app/dashboard/page.tsx` — agregar estado y fetch**

Dentro del componente `Dashboard`, debajo de `const [isLoading, setIsLoading] = useState(true);` agregar:

```tsx
    const [resultadosCount, setResultadosCount] = useState<number | null>(null);
```

Añadir el import al inicio:

```tsx
import { apiFetch } from '@/lib/api';
import type { PaginatedResponse, ResultadoLista } from '@/lib/types';
```

Dentro del `useEffect` existente, después de `setCurrentRole(role);`, agregar:

```tsx
            if (role === 'paciente') {
                apiFetch<PaginatedResponse<ResultadoLista>>('/api/resultados/')
                    .then((data) => setResultadosCount(data.count))
                    .catch(() => setResultadosCount(0));
            }
```

- [ ] **Step 3: Reemplazar el texto hardcodeado en la tarjeta del paciente**

Localizar el bloque:

```tsx
<h3 style={{ color: '#333', marginBottom: '0.5rem' }}>Resultados Recientes</h3>
<p style={{ color: 'var(--text-gray)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Tienes 1 resultado nuevo listo para descargar.</p>
<button className="btn-primary" style={{ padding: '10px 20px', borderRadius: '25px', fontSize: '0.9rem' }}>Ver Resultados</button>
```

Y reemplazar por:

```tsx
<h3 style={{ color: '#333', marginBottom: '0.5rem' }}>Resultados Recientes</h3>
<p style={{ color: 'var(--text-gray)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
    {resultadosCount === null
        ? 'Cargando...'
        : resultadosCount === 0
        ? 'No tienes resultados aún.'
        : `Tienes ${resultadosCount} resultado${resultadosCount > 1 ? 's' : ''} disponible${resultadosCount > 1 ? 's' : ''}.`}
</p>
<Link href="/dashboard/resultados" className="btn-primary" style={{ padding: '10px 20px', borderRadius: '25px', fontSize: '0.9rem', textDecoration: 'none', display: 'inline-block' }}>Ver Resultados</Link>
```

- [ ] **Step 4: Actualizar `tests/dashboard-page.test.tsx` para mockear `apiFetch`**

Añadir al inicio del archivo, junto a los otros `vi.mock`:

```ts
const mockApiFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({
  apiFetch: mockApiFetch,
  apiFetchBlob: vi.fn(),
  logoutAndRedirect: vi.fn(),
}));
```

Y dentro del `beforeEach`:

```ts
mockApiFetch.mockReset();
mockApiFetch.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
```

- [ ] **Step 5: Agregar test nuevo en `tests/dashboard-page.test.tsx`**

```tsx
  it('muestra el conteo real de resultados del paciente', async () => {
    localStorageMock.setItem('access_token', 'fake-token');
    localStorageMock.setItem('user_role', 'paciente');
    mockApiFetch.mockResolvedValueOnce({
      count: 3, next: null, previous: null, results: [],
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/tienes 3 resultados disponibles/i)).toBeInTheDocument();
    });

    const link = screen.getByText(/ver resultados/i).closest('a');
    expect(link).toHaveAttribute('href', '/dashboard/resultados');
  });
```

Importar `waitFor` si no estaba: `import { render, screen, waitFor } from '@testing-library/react';`

- [ ] **Step 6: Ejecutar los tests**

Run: `npm test -- tests/dashboard-page.test.tsx`
Expected: PASS (todos los tests pasan, incluido el nuevo).

- [ ] **Step 7: Type check**

Run: `npx tsc --noEmit`
Expected: Sin errores.

- [ ] **Step 8: Commit**

```bash
git add app/dashboard/page.tsx tests/dashboard-page.test.tsx
git commit -m "feat(frontend): dashboard del paciente muestra conteo real de resultados"
```

---

## Task 10: Verificación end-to-end

**Files:** ninguno

- [ ] **Step 1: Correr todo el test suite**

Run: `npm test`
Expected: TODOS los tests pasan (nuevos + existentes no regresionados).

- [ ] **Step 2: Correr el lint**

Run: `npm run lint`
Expected: Sin errores.

- [ ] **Step 3: Correr el build de Next.js**

Run: `npm run build`
Expected: Build exitoso sin errores de TypeScript.

- [ ] **Step 4: Testing manual — preparación**

En una terminal separada:
```bash
cd backend
python manage.py runserver
```

En otra:
```bash
npm run dev
```

En Django admin (`http://localhost:8000/admin/`):
1. Crear un User con `role='paciente'` y documento.
2. Crear un Paciente vinculado a ese User.
3. Subir un Resultado para ese paciente con `estado='VALIDADO'` y un PDF real.
4. Subir un segundo Resultado con `estado='PENDIENTE'` (para verificar que NO aparece al paciente).

- [ ] **Step 5: Testing manual — flujo paciente**

1. Navegar a `http://localhost:3000/login`, iniciar sesión como paciente (OTP).
2. En el dashboard verificar:
   - Tarjeta "Resultados Recientes" dice "Tienes 1 resultado disponible" (solo el VALIDADO).
   - Click en "Ver Resultados" lleva a `/dashboard/resultados`.
3. En `/dashboard/resultados` verificar:
   - Aparece UNA fila con el resultado validado.
   - El PDF pendiente NO aparece.
   - Badge "VALIDADO" con color verde.
   - Botón "PDF" descarga correctamente.
4. Click en "Ver":
   - Se carga `/dashboard/resultados/<id>`.
   - Metadata completa se muestra.
   - Iframe renderiza el PDF.
   - Botón "Descargar PDF" funciona.

- [ ] **Step 6: Testing manual — refresh de token**

1. Abrir DevTools → Application → Local Storage.
2. Reemplazar `access_token` con un string inválido (ej: `"invalido"`).
3. Navegar a `/dashboard/resultados`.
4. Verificar: se dispara un POST a `/api/auth/login/refresh/`, el token se actualiza, y los resultados aparecen. El usuario NO fue expulsado.

- [ ] **Step 7: Testing manual — logout automático**

1. Invalidar tanto `access_token` como `refresh_token` en localStorage.
2. Navegar a `/dashboard/resultados`.
3. Verificar: redirige a `/login` y los tokens están limpios.

- [ ] **Step 8: Commit final si hubo ajustes**

Si durante el testing manual descubriste bugs, arréglalos y haz un commit adicional. Si no, pasa al siguiente paso.

- [ ] **Step 9: Merge hacia develop (opcional, si estás en otra rama)**

```bash
git log --oneline develop..HEAD  # confirmar los commits del feature
# Si se trabajó en worktree o feature branch, seguir el flujo del equipo.
```

---

## Resumen de commits esperados

1. `feat(frontend): agregar tipos compartidos y env var NEXT_PUBLIC_API_URL`
2. `feat(frontend): apiFetch base con inyeccion de token Bearer`
3. `feat(frontend): auto-refresh de JWT en apiFetch con reintento`
4. `test(frontend): cubrir logout automatico cuando el refresh falla`
5. `test(frontend): verificar que refresh concurrente usa una sola promesa`
6. `feat(frontend): apiFetchBlob con auth y auto-refresh para PDFs`
7. `feat(frontend): pagina de lista de resultados del paciente con paginacion`
8. `feat(frontend): pagina de detalle con visor PDF inline via blob URL`
9. `feat(frontend): dashboard del paciente muestra conteo real de resultados`

Total: 9 commits principales, ~15-20 minutos por tarea (TDD + impl + commit).
