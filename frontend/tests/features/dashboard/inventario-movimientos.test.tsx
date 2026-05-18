import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

// jsdom doesn't implement URL.createObjectURL — stub it
URL.createObjectURL = vi.fn(() => 'blob:mock-url');
URL.revokeObjectURL = vi.fn();

const mov1 = { id: 1, producto_nombre: 'Glucosa Reactivo', tipo: 'INGRESO' as const, cantidad: 10, fecha_registro: '2026-05-01T10:00:00Z' };
const mov2 = { id: 2, producto_nombre: 'Guantes Latex', tipo: 'EGRESO' as const, cantidad: 2, fecha_registro: '2026-05-02T11:00:00Z' };

beforeEach(() => {
  localStorageMock.clear();
  mockApiFetch.mockReset();
  mockApiFetchBlob.mockReset();
  mockPush.mockClear();
});

describe('Página /dashboard/inventario/movimientos', () => {
  it('lista movimientos del API', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'admin');
    mockApiFetch.mockResolvedValueOnce({ count: 2, next: null, previous: null, results: [mov1, mov2] });

    const { default: Page } = await import('@/app/dashboard/inventario/movimientos/page');
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText('Glucosa Reactivo')).toBeInTheDocument();
      expect(screen.getByText('Guantes Latex')).toBeInTheDocument();
    });
    expect(screen.getByText(/mostrando 2 de 2/i)).toBeInTheDocument();
  });

  it('redirige a /dashboard si el rol es bacteriologo', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'bacteriologo');

    const { default: Page } = await import('@/app/dashboard/inventario/movimientos/page');
    render(<Page />);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
  });

  it('exportar CSV llama apiFetchBlob y descarga el archivo', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'admin');
    mockApiFetch.mockResolvedValueOnce({ count: 1, next: null, previous: null, results: [mov1] });
    mockApiFetchBlob.mockResolvedValueOnce(new Blob(['csv content'], { type: 'text/csv' }));

    const clickMock = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = originalCreateElement('a');
        el.click = clickMock;
        return el;
      }
      return originalCreateElement(tag);
    });

    const { default: Page } = await import('@/app/dashboard/inventario/movimientos/page');
    render(<Page />);

    await waitFor(() => expect(screen.getByText('Glucosa Reactivo')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /exportar csv/i }));

    await waitFor(() => {
      expect(mockApiFetchBlob).toHaveBeenCalledWith(
        expect.stringContaining('/api/inventario/movimientos/exportar/')
      );
      expect(clickMock).toHaveBeenCalled();
    });

    vi.restoreAllMocks();
  });
});
