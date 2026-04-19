import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

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

    // The empty state message appears in the DOM, just wait for it without loading state
    await new Promise(r => setTimeout(r, 100));
    expect(screen.getByText(/aún no tienes resultados/i)).toBeInTheDocument();
  });

  it('redirige a /login si no hay token', async () => {
    const { default: Page } = await import('@/app/dashboard/resultados/page');
    render(<Page />);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });
});
