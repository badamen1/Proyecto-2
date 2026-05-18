import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({ id: '1' }),
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

const productoAdmin = {
  id: 1, codigo: 'R001', nombre: 'Glucosa Reactivo', categoria: 'REACTIVO',
  unidad_medida: 'ML', stock_actual: 50, stock_minimo: 10, activo: true,
  proveedor_habitual: 'Lab XYZ', ultimo_costo: '25000.00',
  fecha_vencimiento: '2027-12-31', numero_lote: 'LOT-001',
  observaciones: '', fecha_registro: '2026-01-01T00:00:00Z', fecha_actualizacion: '2026-05-01T00:00:00Z',
};

const historialVacio = { count: 0, next: null, previous: null, results: [] };

beforeEach(() => {
  localStorageMock.clear();
  mockApiFetch.mockReset();
  mockPush.mockClear();
});

describe('Página /dashboard/inventario/productos/[id]', () => {
  it('muestra nombre y código del producto', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'admin');
    mockApiFetch
      .mockResolvedValueOnce(productoAdmin)  // GET producto
      .mockResolvedValueOnce(historialVacio); // GET movimientos

    const { default: Page } = await import('@/app/dashboard/inventario/productos/[id]/page');
    render(<Page />);

    await waitFor(() => expect(screen.getByText('Glucosa Reactivo')).toBeInTheDocument());
    expect(screen.getByText('R001')).toBeInTheDocument();
  });

  it('admin ve botón Registrar Ingreso', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'admin');
    mockApiFetch
      .mockResolvedValueOnce(productoAdmin)
      .mockResolvedValueOnce(historialVacio);

    const { default: Page } = await import('@/app/dashboard/inventario/productos/[id]/page');
    render(<Page />);

    await waitFor(() => expect(screen.getByRole('button', { name: /registrar ingreso/i })).toBeInTheDocument());
  });

  it('bacteriologo NO ve botón Registrar Ingreso', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'bacteriologo');
    const productoSinCosto = { ...productoAdmin };
    delete (productoSinCosto as Record<string, unknown>).ultimo_costo;
    mockApiFetch
      .mockResolvedValueOnce(productoSinCosto)
      .mockResolvedValueOnce(historialVacio);

    const { default: Page } = await import('@/app/dashboard/inventario/productos/[id]/page');
    render(<Page />);

    await waitFor(() => expect(screen.getByText('Glucosa Reactivo')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /registrar ingreso/i })).not.toBeInTheDocument();
  });

  it('ambos roles ven botón Registrar Egreso', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'bacteriologo');
    const productoSinCosto = { ...productoAdmin };
    delete (productoSinCosto as Record<string, unknown>).ultimo_costo;
    mockApiFetch
      .mockResolvedValueOnce(productoSinCosto)
      .mockResolvedValueOnce(historialVacio);

    const { default: Page } = await import('@/app/dashboard/inventario/productos/[id]/page');
    render(<Page />);

    await waitFor(() => expect(screen.getByRole('button', { name: /registrar egreso/i })).toBeInTheDocument());
  });

  it('muestra error cuando egreso excede stock', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'admin');
    mockApiFetch
      .mockResolvedValueOnce(productoAdmin)
      .mockResolvedValueOnce(historialVacio)
      .mockRejectedValueOnce(new Error('{"cantidad":["Stock insuficiente"]}'));

    const { default: Page } = await import('@/app/dashboard/inventario/productos/[id]/page');
    render(<Page />);

    await waitFor(() => expect(screen.getByRole('button', { name: /registrar egreso/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /registrar egreso/i }));

    await waitFor(() => {
      const cantidadInputs = screen.getAllByLabelText(/cantidad/i);
      fireEvent.change(cantidadInputs[cantidadInputs.length - 1], { target: { value: '9999' } });
    });
    const motivoInputs = screen.getAllByPlaceholderText(/motivo/i);
    fireEvent.change(motivoInputs[motivoInputs.length - 1], { target: { value: 'Test' } });

    const submitButtons = screen.getAllByRole('button', { name: /confirmar egreso/i });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => expect(screen.getByText(/stock insuficiente/i)).toBeInTheDocument());
  });
});
