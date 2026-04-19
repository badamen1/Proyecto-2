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
