import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

const mockApiFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({
  apiFetch: mockApiFetch,
  apiFetchBlob: vi.fn(),
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

const producto1 = {
  id: 1, codigo: 'R001', nombre: 'Glucosa Reactivo', categoria: 'REACTIVO',
  unidad_medida: 'ML', stock_actual: 50, stock_minimo: 10, activo: true,
};
const producto2 = {
  id: 2, codigo: 'C002', nombre: 'Guantes Latex', categoria: 'CONSUMIBLE',
  unidad_medida: 'CAJA', stock_actual: 5, stock_minimo: 5, activo: true,
};

beforeEach(() => {
  localStorageMock.clear();
  mockApiFetch.mockReset();
});

describe('Página /dashboard/inventario/productos', () => {
  it('lista productos del API', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'admin');
    mockApiFetch.mockResolvedValueOnce({ count: 2, next: null, previous: null, results: [producto1, producto2] });

    const { default: Page } = await import('@/app/dashboard/inventario/productos/page');
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText('Glucosa Reactivo')).toBeInTheDocument();
      expect(screen.getByText('Guantes Latex')).toBeInTheDocument();
    });
    expect(screen.getByText(/mostrando 2 de 2/i)).toBeInTheDocument();
  });

  it('admin ve botón Nuevo Producto', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'admin');
    mockApiFetch.mockResolvedValueOnce({ count: 0, next: null, previous: null, results: [] });

    const { default: Page } = await import('@/app/dashboard/inventario/productos/page');
    render(<Page />);

    await waitFor(() => expect(screen.getByRole('button', { name: /nuevo producto/i })).toBeInTheDocument());
  });

  it('bacteriologo NO ve botón Nuevo Producto', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'bacteriologo');
    mockApiFetch.mockResolvedValueOnce({ count: 0, next: null, previous: null, results: [] });

    const { default: Page } = await import('@/app/dashboard/inventario/productos/page');
    render(<Page />);

    await waitFor(() => expect(screen.queryByRole('button', { name: /nuevo producto/i })).not.toBeInTheDocument());
  });

  it('buscar producto llama API con ?search=', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'admin');
    mockApiFetch
      .mockResolvedValueOnce({ count: 2, next: null, previous: null, results: [producto1, producto2] })
      .mockResolvedValueOnce({ count: 1, next: null, previous: null, results: [producto1] });

    const { default: Page } = await import('@/app/dashboard/inventario/productos/page');
    render(<Page />);

    await waitFor(() => expect(screen.getByText('Glucosa Reactivo')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText(/buscar/i);
    fireEvent.change(searchInput, { target: { value: 'glucosa' } });
    fireEvent.submit(searchInput.closest('form')!);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('search=glucosa')
      );
    });
  });

  it('muestra Cargar más cuando hay siguiente página', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'admin');
    mockApiFetch.mockResolvedValueOnce({
      count: 10, next: 'http://localhost:8000/api/inventario/productos/?page=2',
      previous: null, results: [producto1],
    });

    const { default: Page } = await import('@/app/dashboard/inventario/productos/page');
    render(<Page />);

    await waitFor(() => expect(screen.getByRole('button', { name: /cargar más/i })).toBeInTheDocument());
  });
});
