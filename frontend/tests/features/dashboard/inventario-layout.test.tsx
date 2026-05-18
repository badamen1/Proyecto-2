import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/dashboard/inventario',
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
  mockPush.mockClear();
});

describe('InventarioLayout auth guard', () => {
  it('redirige a /login si no hay token', async () => {
    const { default: Layout } = await import('@/app/dashboard/inventario/layout');
    render(<Layout>contenido</Layout>);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'));
  });

  it('redirige a /dashboard si el rol es paciente', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'paciente');
    const { default: Layout } = await import('@/app/dashboard/inventario/layout');
    render(<Layout>contenido</Layout>);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
  });

  it('renderiza children para admin', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'admin');
    const { default: Layout } = await import('@/app/dashboard/inventario/layout');
    render(<Layout>Contenido Admin</Layout>);
    await waitFor(() => expect(screen.getByText('Contenido Admin')).toBeInTheDocument());
  });

  it('renderiza children para bacteriologo', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'bacteriologo');
    const { default: Layout } = await import('@/app/dashboard/inventario/layout');
    render(<Layout>Contenido Bacteriologo</Layout>);
    await waitFor(() => expect(screen.getByText('Contenido Bacteriologo')).toBeInTheDocument());
  });

  it('admin ve link de Movimientos en el sidebar', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'admin');
    const { default: Layout } = await import('@/app/dashboard/inventario/layout');
    render(<Layout>x</Layout>);
    await waitFor(() => expect(screen.getByRole('link', { name: /movimientos/i })).toBeInTheDocument());
  });

  it('bacteriologo NO ve link de Movimientos en el sidebar', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'bacteriologo');
    const { default: Layout } = await import('@/app/dashboard/inventario/layout');
    render(<Layout>x</Layout>);
    await waitFor(() => expect(screen.queryByRole('link', { name: /movimientos/i })).not.toBeInTheDocument());
  });
});
