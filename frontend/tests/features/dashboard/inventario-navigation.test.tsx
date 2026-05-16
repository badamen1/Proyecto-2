import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), prefetch: vi.fn() }),
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

beforeEach(() => {
  localStorageMock.clear();
  mockPush.mockClear();
  mockApiFetch.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
});

describe('Dashboard nav — inventario links', () => {
  it('admin menu tiene link a /dashboard/inventario', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'admin');

    const { default: Dashboard } = await import('@/app/dashboard/page');
    render(<Dashboard />);

    const link = screen.getByRole('link', { name: /inventario/i });
    expect(link).toHaveAttribute('href', '/dashboard/inventario');
  });

  it('bacteriologo menu tiene link a /dashboard/inventario', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'bacteriologo');

    const { default: Dashboard } = await import('@/app/dashboard/page');
    render(<Dashboard />);

    const link = screen.getByRole('link', { name: /inventario/i });
    expect(link).toHaveAttribute('href', '/dashboard/inventario');
  });
});
