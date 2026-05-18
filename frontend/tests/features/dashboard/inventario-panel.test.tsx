import { render, screen, waitFor } from '@testing-library/react';
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

const productoAlerta = {
  id: 1, codigo: 'R001', nombre: 'Reactivo A',
  categoria: 'REACTIVO' as const, unidad_medida: 'ML' as const,
  stock_actual: 2, stock_minimo: 10, activo: true,
};

const alertasVacias = { stock_bajo: [], por_vencer: [], vencidos: [] };
const alertasConDatos = { stock_bajo: [productoAlerta], por_vencer: [], vencidos: [] };
const resumenAdmin = { total_productos: 15, stock_bajo: 1, sin_stock: 0, vencidos: 0, ultimos_movimientos: [] };

beforeEach(() => {
  localStorageMock.clear();
  mockApiFetch.mockReset();
});

describe('Página /dashboard/inventario (Panel)', () => {
  it('admin ve tarjetas de resumen', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'admin');
    mockApiFetch
      .mockResolvedValueOnce(alertasVacias)   // /alertas/
      .mockResolvedValueOnce(resumenAdmin);    // /resumen/

    const { default: Page } = await import('@/app/dashboard/inventario/page');
    render(<Page />);

    await waitFor(() => expect(screen.getByText('15')).toBeInTheDocument());
    expect(screen.getByText(/total productos/i)).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledWith('/api/inventario/resumen/');
  });

  it('bacteriologo NO ve tarjetas de resumen', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'bacteriologo');
    mockApiFetch.mockResolvedValueOnce(alertasVacias);

    const { default: Page } = await import('@/app/dashboard/inventario/page');
    render(<Page />);

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/api/inventario/alertas/'));
    expect(mockApiFetch).not.toHaveBeenCalledWith('/api/inventario/resumen/');
    expect(screen.queryByText(/total productos/i)).not.toBeInTheDocument();
  });

  it('muestra productos con stock bajo en alerta', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'bacteriologo');
    mockApiFetch.mockResolvedValueOnce(alertasConDatos);

    const { default: Page } = await import('@/app/dashboard/inventario/page');
    render(<Page />);

    await waitFor(() => expect(screen.getByText('Reactivo A')).toBeInTheDocument());
    expect(screen.getByText(/stock bajo/i)).toBeInTheDocument();
  });

  it('muestra mensaje vacío cuando no hay alertas', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'bacteriologo');
    mockApiFetch.mockResolvedValueOnce(alertasVacias);

    const { default: Page } = await import('@/app/dashboard/inventario/page');
    render(<Page />);

    await waitFor(() => expect(screen.getByText(/sin alertas/i)).toBeInTheDocument());
  });
});
