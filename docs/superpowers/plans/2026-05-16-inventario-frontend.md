# Inventario Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Next.js frontend for the inventario module, connecting all 10 backend REST endpoints to a role-aware UI for admin y bacteriólogo.

**Architecture:** Seven sequential tasks — types → navigation → sidebar+layout → panel → productos list → producto detail → movimientos. Each task is TDD: failing test first, minimal implementation to pass, commit. All tests run in the `frontend/` directory with `npm test`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Vitest + @testing-library/react, inline styles (no Tailwind), `apiFetch`/`apiFetchBlob` from `@/lib/api`, `PaginatedResponse<T>` from `@/lib/types`.

---

## File Map

**Modify:**
- `frontend/lib/types.ts` — add `Producto*`, `Movimiento*`, `InventarioAlertas`, `InventarioResumen` types
- `frontend/app/dashboard/page.tsx` — wire inventario href for admin (line 95) + add inventario link for bacteriólogo (after line 87)

**Create:**
- `frontend/features/inventario/components/InventarioSidebar.tsx` — nav sidebar, role-aware (admin sees movimientos, bacteriólogo does not)
- `frontend/app/dashboard/inventario/layout.tsx` — auth guard (admin + bacteriólogo), shared header + sidebar
- `frontend/app/dashboard/inventario/page.tsx` — panel: alertas (both roles) + resumen cards + últimos movimientos (admin only)
- `frontend/app/dashboard/inventario/productos/page.tsx` — lista paginada + búsqueda + crear producto (admin only)
- `frontend/app/dashboard/inventario/productos/[id]/page.tsx` — detalle + editar + toggle (admin) + ingreso (admin) + egreso (both) + historial
- `frontend/app/dashboard/inventario/movimientos/page.tsx` — trazabilidad global + exportar CSV (admin only)

**Tests Create:**
- `frontend/tests/features/dashboard/inventario-navigation.test.tsx`
- `frontend/tests/features/dashboard/inventario-layout.test.tsx`
- `frontend/tests/features/dashboard/inventario-panel.test.tsx`
- `frontend/tests/features/dashboard/inventario-productos-list.test.tsx`
- `frontend/tests/features/dashboard/inventario-producto-detail.test.tsx`
- `frontend/tests/features/dashboard/inventario-movimientos.test.tsx`

---

### Task 1: Inventario types

**Files:**
- Modify: `frontend/lib/types.ts`

- [ ] **Step 1: Add inventario types at the end of `lib/types.ts`**

```typescript
// === Inventario ===

export type ProductoCategoria = 'REACTIVO' | 'CONSUMIBLE' | 'MATERIAL_VIDRIO' | 'OTRO';
export type ProductoUnidadMedida = 'UNIDAD' | 'CAJA' | 'ML' | 'LT' | 'GR' | 'PAQUETE';
export type TipoMovimiento = 'INGRESO' | 'EGRESO';

export type ProductoLista = {
  id: number;
  codigo: string;
  nombre: string;
  categoria: ProductoCategoria;
  unidad_medida: ProductoUnidadMedida;
  stock_actual: number;
  stock_minimo: number;
  activo: boolean;
};

export type ProductoDetalle = ProductoLista & {
  proveedor_habitual: string;
  ultimo_costo: string | null;
  fecha_vencimiento: string | null;
  numero_lote: string;
  observaciones: string;
  fecha_registro: string;
  fecha_actualizacion: string;
};

export type ProductoBacteriologoDetalle = Omit<ProductoDetalle, 'ultimo_costo'>;

export type MovimientoLista = {
  id: number;
  producto_nombre: string;
  tipo: TipoMovimiento;
  cantidad: number;
  fecha_registro: string;
};

export type Movimiento = MovimientoLista & {
  producto: number;
  motivo: string;
  registrado_por: number | null;
  registrado_por_nombre: string | null;
};

export type InventarioAlertas = {
  stock_bajo: ProductoLista[];
  por_vencer: ProductoLista[];
  vencidos: ProductoLista[];
};

export type InventarioResumen = {
  total_productos: number;
  stock_bajo: number;
  sin_stock: number;
  vencidos: number;
  ultimos_movimientos: MovimientoLista[];
};
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/types.ts
git commit -m "feat(inventario-frontend): agregar tipos TypeScript del módulo inventario"
```

---

### Task 2: Wire dashboard navigation links

**Files:**
- Test: `frontend/tests/features/dashboard/inventario-navigation.test.tsx`
- Modify: `frontend/app/dashboard/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/features/dashboard/inventario-navigation.test.tsx`:

```typescript
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
```

- [ ] **Step 2: Run test — debe fallar**

```bash
cd frontend && npm test -- tests/features/dashboard/inventario-navigation.test.tsx
```

Expected: FAIL — el link tiene `href="#"` (admin) o no existe (bacteriólogo).

- [ ] **Step 3: Fix `frontend/app/dashboard/page.tsx`**

On line 95, change the inventario `Link`:
```tsx
// Before:
<li><Link href="#" style={navItemStyle}><i className="fas fa-box-open" style={{width: '25px'}}></i> Inventario</Link></li>

// After:
<li><Link href="/dashboard/inventario" style={navItemStyle}><i className="fas fa-box-open" style={{width: '25px'}}></i> Inventario</Link></li>
```

After line 87 (last bacteriólogo menu item), add:
```tsx
<li><Link href="/dashboard/inventario" style={navItemStyle}><i className="fas fa-box-open" style={{width: '25px'}}></i> Inventario</Link></li>
```

- [ ] **Step 4: Run test — debe pasar**

```bash
cd frontend && npm test -- tests/features/dashboard/inventario-navigation.test.tsx
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/app/dashboard/page.tsx frontend/tests/features/dashboard/inventario-navigation.test.tsx
git commit -m "feat(inventario-frontend): activar links de navegación inventario en dashboard"
```

---

### Task 3: InventarioSidebar + Layout

**Files:**
- Test: `frontend/tests/features/dashboard/inventario-layout.test.tsx`
- Create: `frontend/features/inventario/components/InventarioSidebar.tsx`
- Create: `frontend/app/dashboard/inventario/layout.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/features/dashboard/inventario-layout.test.tsx`:

```typescript
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
```

- [ ] **Step 2: Run test — debe fallar**

```bash
cd frontend && npm test -- tests/features/dashboard/inventario-layout.test.tsx
```

Expected: FAIL — archivos no existen aún.

- [ ] **Step 3: Crear `frontend/features/inventario/components/InventarioSidebar.tsx`**

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const adminLinks = [
  { href: '/dashboard/inventario', label: 'Panel', icon: 'fa-tachometer-alt', exact: true },
  { href: '/dashboard/inventario/productos', label: 'Productos', icon: 'fa-boxes', exact: false },
  { href: '/dashboard/inventario/movimientos', label: 'Movimientos', icon: 'fa-exchange-alt', exact: false },
];

const bacteriologoLinks = [
  { href: '/dashboard/inventario', label: 'Panel', icon: 'fa-tachometer-alt', exact: true },
  { href: '/dashboard/inventario/productos', label: 'Productos', icon: 'fa-boxes', exact: false },
];

export function InventarioSidebar({ role }: { role: 'admin' | 'bacteriologo' }) {
  const pathname = usePathname();
  const links = role === 'admin' ? adminLinks : bacteriologoLinks;

  return (
    <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', alignSelf: 'start' }}>
      <h3 style={{ fontSize: '1rem', color: 'var(--text-gray)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>
        Inventario
      </h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {links.map(({ href, label, icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 15px',
                  color: isActive ? '#fff' : '#555',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontWeight: '500' as const,
                  background: isActive ? 'var(--primary-blue)' : 'transparent',
                  boxShadow: isActive ? '0 4px 6px rgba(45, 83, 162, 0.2)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                <i className={`fas ${icon}`} style={{ width: '25px' }} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Crear `frontend/app/dashboard/inventario/layout.tsx`**

```typescript
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { InventarioSidebar } from '@/features/inventario/components/InventarioSidebar';

export default function InventarioLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [role, setRole] = useState<'admin' | 'bacteriologo' | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem('access_token');
    const r = window.localStorage.getItem('user_role');
    if (!token) { router.push('/login'); return; }
    if (r !== 'admin' && r !== 'bacteriologo') { router.push('/dashboard'); return; }
    setRole(r as 'admin' | 'bacteriologo');
  }, [router]);

  const handleLogout = () => {
    window.localStorage.removeItem('access_token');
    window.localStorage.removeItem('refresh_token');
    window.localStorage.removeItem('user_role');
    router.push('/');
  };

  if (!role) return null;

  return (
    <section className="section" style={{ background: '#f4f6f9', minHeight: '90vh' }}>
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem', background: '#fff', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', color: 'var(--primary-blue)', margin: 0 }}>Inventario — BIOANALISIS</h1>
            <p style={{ color: 'var(--text-gray)', margin: 0, fontSize: '0.9rem', textTransform: 'capitalize' }}>Rol Activo: {role}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link href="/dashboard" style={{ padding: '8px 15px', color: 'var(--primary-blue)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500' }}>
              ← Dashboard
            </Link>
            <button onClick={handleLogout} style={{ padding: '8px 15px', background: '#f1f1f1', color: '#555', border: 'none', borderRadius: '20px', fontSize: '0.9rem', cursor: 'pointer' }}>
              <i className="fas fa-sign-out-alt" /> Salir
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '2rem' }}>
          <InventarioSidebar role={role} />
          <div>{children}</div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run test — debe pasar**

```bash
cd frontend && npm test -- tests/features/dashboard/inventario-layout.test.tsx
```

Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/features/inventario/components/InventarioSidebar.tsx \
        frontend/app/dashboard/inventario/layout.tsx \
        frontend/tests/features/dashboard/inventario-layout.test.tsx
git commit -m "feat(inventario-frontend): sidebar e layout con guard de autenticación"
```

---

### Task 4: Panel page (resumen + alertas)

**Files:**
- Test: `frontend/tests/features/dashboard/inventario-panel.test.tsx`
- Create: `frontend/app/dashboard/inventario/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/features/dashboard/inventario-panel.test.tsx`:

```typescript
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
```

- [ ] **Step 2: Run test — debe fallar**

```bash
cd frontend && npm test -- tests/features/dashboard/inventario-panel.test.tsx
```

Expected: FAIL — página no existe.

- [ ] **Step 3: Crear `frontend/app/dashboard/inventario/page.tsx`**

```typescript
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { InventarioAlertas, InventarioResumen, ProductoLista, MovimientoLista } from '@/lib/types';

function tipoBadge(tipo: 'INGRESO' | 'EGRESO') {
  const s = tipo === 'INGRESO'
    ? { bg: '#d4edda', color: '#155724' }
    : { bg: '#ffebee', color: '#c62828' };
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold' }}>
      {tipo}
    </span>
  );
}

function AlertaFilas({ items }: { items: ProductoLista[] }) {
  if (items.length === 0) return null;
  return (
    <>
      {items.map(p => (
        <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
          <td style={{ padding: '10px' }}>{p.codigo}</td>
          <td style={{ padding: '10px', fontWeight: '500' }}>
            <Link href={`/dashboard/inventario/productos/${p.id}`} style={{ color: 'var(--primary-blue)', textDecoration: 'none' }}>
              {p.nombre}
            </Link>
          </td>
          <td style={{ padding: '10px' }}>{p.stock_actual}</td>
          <td style={{ padding: '10px' }}>{p.stock_minimo}</td>
          <td style={{ padding: '10px', fontSize: '0.85rem', color: '#666' }}>{p.categoria}</td>
        </tr>
      ))}
    </>
  );
}

function AlertaSeccion({ titulo, items, colorHeader }: { titulo: string; items: ProductoLista[]; colorHeader: string }) {
  if (items.length === 0) return null;
  return (
    <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
      <h3 style={{ color: colorHeader, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <i className="fas fa-exclamation-triangle" />
        {titulo} ({items.length})
      </h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: '10px', color: '#555', textAlign: 'left' }}>Código</th>
            <th style={{ padding: '10px', color: '#555', textAlign: 'left' }}>Nombre</th>
            <th style={{ padding: '10px', color: '#555', textAlign: 'left' }}>Stock Actual</th>
            <th style={{ padding: '10px', color: '#555', textAlign: 'left' }}>Stock Mínimo</th>
            <th style={{ padding: '10px', color: '#555', textAlign: 'left' }}>Categoría</th>
          </tr>
        </thead>
        <tbody>
          <AlertaFilas items={items} />
        </tbody>
      </table>
    </div>
  );
}

export default function InventarioPanel() {
  const [role, setRole] = useState<string | null>(null);
  const [alertas, setAlertas] = useState<InventarioAlertas | null>(null);
  const [resumen, setResumen] = useState<InventarioResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const r = window.localStorage.getItem('user_role');
    setRole(r);

    const fetchData = async () => {
      try {
        const alertasData = await apiFetch<InventarioAlertas>('/api/inventario/alertas/');
        setAlertas(alertasData);
        if (r === 'admin') {
          const resumenData = await apiFetch<InventarioResumen>('/api/inventario/resumen/');
          setResumen(resumenData);
        }
      } catch {
        setError('Error al cargar datos del inventario.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>Cargando...</div>;

  const hayAlertas = alertas && (alertas.stock_bajo.length + alertas.por_vencer.length + alertas.vencidos.length) > 0;

  return (
    <div>
      {error && (
        <div style={{ background: '#ffebee', color: '#c62828', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* Resumen cards — solo admin */}
      {role === 'admin' && resumen && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Total Productos', value: resumen.total_productos, icon: 'fa-boxes', bg: '#e8f4fd', color: 'var(--primary-blue)' },
            { label: 'Stock Bajo', value: resumen.stock_bajo, icon: 'fa-exclamation-triangle', bg: '#fff3cd', color: '#856404' },
            { label: 'Sin Stock', value: resumen.sin_stock, icon: 'fa-times-circle', bg: '#ffebee', color: '#c62828' },
            { label: 'Vencidos', value: resumen.vencidos, icon: 'fa-calendar-times', bg: '#fdf3e8', color: '#fd7e14' },
          ].map(({ label, value, icon, bg, color }) => (
            <div key={label} style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ width: '50px', height: '50px', background: bg, color, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                <i className={`fas ${icon}`} />
              </div>
              <div>
                <p style={{ color: 'var(--text-gray)', margin: 0, fontSize: '0.9rem' }}>{label}</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '4px 0 0 0', color: '#333' }}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alertas */}
      {alertas && hayAlertas ? (
        <>
          <AlertaSeccion titulo="Stock Bajo" items={alertas.stock_bajo} colorHeader="#856404" />
          <AlertaSeccion titulo="Por Vencer (30 días)" items={alertas.por_vencer} colorHeader="#fd7e14" />
          <AlertaSeccion titulo="Vencidos" items={alertas.vencidos} colorHeader="#c62828" />
        </>
      ) : (
        !loading && (
          <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', textAlign: 'center', color: '#28a745' }}>
            <i className="fas fa-check-circle" style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'block' }} />
            <p style={{ margin: 0, fontWeight: '500' }}>Sin alertas activas</p>
          </div>
        )
      )}

      {/* Últimos movimientos — solo admin */}
      {role === 'admin' && resumen && resumen.ultimos_movimientos.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginTop: '1.5rem' }}>
          <h3 style={{ color: '#333', marginBottom: '1rem' }}>Últimos Movimientos</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                {['Fecha', 'Producto', 'Tipo', 'Cantidad'].map(h => (
                  <th key={h} style={{ padding: '10px', color: '#555', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resumen.ultimos_movimientos.map((m: MovimientoLista) => (
                <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px', fontSize: '0.9rem' }}>{new Date(m.fecha_registro).toLocaleDateString('es-CO')}</td>
                  <td style={{ padding: '10px' }}>{m.producto_nombre}</td>
                  <td style={{ padding: '10px' }}>{tipoBadge(m.tipo)}</td>
                  <td style={{ padding: '10px' }}>{m.cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test — debe pasar**

```bash
cd frontend && npm test -- tests/features/dashboard/inventario-panel.test.tsx
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/app/dashboard/inventario/page.tsx \
        frontend/tests/features/dashboard/inventario-panel.test.tsx
git commit -m "feat(inventario-frontend): página panel con alertas y resumen"
```

---

### Task 5: Productos list page

**Files:**
- Test: `frontend/tests/features/dashboard/inventario-productos-list.test.tsx`
- Create: `frontend/app/dashboard/inventario/productos/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/features/dashboard/inventario-productos-list.test.tsx`:

```typescript
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
```

- [ ] **Step 2: Run test — debe fallar**

```bash
cd frontend && npm test -- tests/features/dashboard/inventario-productos-list.test.tsx
```

Expected: FAIL — página no existe.

- [ ] **Step 3: Crear `frontend/app/dashboard/inventario/productos/page.tsx`**

```typescript
'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { PaginatedResponse, ProductoLista, ProductoDetalle, ProductoCategoria, ProductoUnidadMedida } from '@/lib/types';

const inputStyle = {
  width: '100%', padding: '10px 15px', borderRadius: '8px',
  border: '1px solid #ddd', fontSize: '0.95rem', outline: 'none',
  boxSizing: 'border-box' as const,
};

const categorias: { value: ProductoCategoria; label: string }[] = [
  { value: 'REACTIVO', label: 'Reactivo' },
  { value: 'CONSUMIBLE', label: 'Consumible' },
  { value: 'MATERIAL_VIDRIO', label: 'Material de Vidrio' },
  { value: 'OTRO', label: 'Otro' },
];

const unidades: { value: ProductoUnidadMedida; label: string }[] = [
  { value: 'UNIDAD', label: 'Unidad' },
  { value: 'CAJA', label: 'Caja' },
  { value: 'ML', label: 'Mililitro' },
  { value: 'LT', label: 'Litro' },
  { value: 'GR', label: 'Gramo' },
  { value: 'PAQUETE', label: 'Paquete' },
];

const emptyForm = {
  codigo: '', nombre: '', categoria: 'REACTIVO' as ProductoCategoria,
  unidad_medida: 'UNIDAD' as ProductoUnidadMedida, stock_minimo: '5',
  proveedor_habitual: '', ultimo_costo: '', fecha_vencimiento: '',
  numero_lote: '', observaciones: '',
};

export default function ProductosListPage() {
  const [role, setRole] = useState<string | null>(null);
  const [productos, setProductos] = useState<ProductoLista[]>([]);
  const [count, setCount] = useState(0);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const r = window.localStorage.getItem('user_role');
    setRole(r);
    fetchProductos('/api/inventario/productos/');
  }, []);

  const fetchProductos = async (url: string) => {
    try {
      const data = await apiFetch<PaginatedResponse<ProductoLista>>(url);
      setProductos(data.results);
      setCount(data.count);
      setNextUrl(data.next);
    } catch {
      setError('Error al cargar productos.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    fetchProductos(`/api/inventario/productos/${params}`);
  };

  const handleLoadMore = async () => {
    if (!nextUrl) return;
    setLoadingMore(true);
    try {
      const data = await apiFetch<PaginatedResponse<ProductoLista>>(nextUrl);
      setProductos(prev => [...prev, ...data.results]);
      setNextUrl(data.next);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      const body: Record<string, unknown> = {
        codigo: formData.codigo,
        nombre: formData.nombre,
        categoria: formData.categoria,
        unidad_medida: formData.unidad_medida,
        stock_minimo: parseInt(formData.stock_minimo, 10),
        proveedor_habitual: formData.proveedor_habitual,
        observaciones: formData.observaciones,
      };
      if (formData.numero_lote) body.numero_lote = formData.numero_lote;
      if (formData.fecha_vencimiento) body.fecha_vencimiento = formData.fecha_vencimiento;
      if (formData.ultimo_costo) body.ultimo_costo = formData.ultimo_costo;

      const nuevo = await apiFetch<ProductoDetalle>('/api/inventario/productos/', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setProductos(prev => [{ ...nuevo }, ...prev]);
      setCount(c => c + 1);
      setShowForm(false);
      setFormData(emptyForm);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al crear producto.');
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando...</div>;

  return (
    <div>
      {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>{error}</div>}

      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ color: 'var(--primary-blue)', margin: 0 }}>Catálogo de Productos</h2>
        {role === 'admin' && (
          <button
            onClick={() => setShowForm(!showForm)}
            style={{ padding: '10px 20px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {showForm ? 'Cancelar' : '+ Nuevo Producto'}
          </button>
        )}
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por código, nombre o proveedor..."
          style={{ ...inputStyle, flex: 1 }}
        />
        <button type="submit" style={{ padding: '10px 20px', background: 'var(--primary-blue)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          Buscar
        </button>
      </form>

      {/* Create form — admin only */}
      {showForm && (
        <div style={{ background: '#fff', padding: '2rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
          <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>Nuevo Producto</h3>
          {formError && <div style={{ background: '#ffebee', color: '#c62828', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>{formError}</div>}
          <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Código *</label>
              <input required value={formData.codigo} onChange={e => setFormData({ ...formData, codigo: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Nombre *</label>
              <input required value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Categoría *</label>
              <select value={formData.categoria} onChange={e => setFormData({ ...formData, categoria: e.target.value as ProductoCategoria })} style={inputStyle}>
                {categorias.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Unidad de Medida *</label>
              <select value={formData.unidad_medida} onChange={e => setFormData({ ...formData, unidad_medida: e.target.value as ProductoUnidadMedida })} style={inputStyle}>
                {unidades.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Stock Mínimo *</label>
              <input type="number" min="0" required value={formData.stock_minimo} onChange={e => setFormData({ ...formData, stock_minimo: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Proveedor Habitual</label>
              <input value={formData.proveedor_habitual} onChange={e => setFormData({ ...formData, proveedor_habitual: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Último Costo</label>
              <input type="number" step="0.01" value={formData.ultimo_costo} onChange={e => setFormData({ ...formData, ultimo_costo: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Fecha Vencimiento</label>
              <input type="date" value={formData.fecha_vencimiento} onChange={e => setFormData({ ...formData, fecha_vencimiento: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Observaciones</label>
              <textarea value={formData.observaciones} onChange={e => setFormData({ ...formData, observaciones: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" disabled={formLoading} style={{ padding: '12px 30px', background: 'var(--primary-blue)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', width: '100%', opacity: formLoading ? 0.7 : 1, fontWeight: 'bold' }}>
                {formLoading ? 'Guardando...' : 'Crear Producto'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: '10px', padding: '1rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          Mostrando {productos.length} de {count} productos
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
              {['Código', 'Nombre', 'Categoría', 'Unidad', 'Stock Actual', 'Stock Mín.', 'Estado', 'Acciones'].map(h => (
                <th key={h} style={{ padding: '12px', color: '#555' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {productos.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px', fontWeight: 'bold', color: '#888' }}>{p.codigo}</td>
                <td style={{ padding: '12px', fontWeight: '500' }}>{p.nombre}</td>
                <td style={{ padding: '12px', fontSize: '0.9rem' }}>{p.categoria}</td>
                <td style={{ padding: '12px', fontSize: '0.9rem' }}>{p.unidad_medida}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ color: p.stock_actual <= p.stock_minimo ? '#c62828' : '#155724', fontWeight: 'bold' }}>
                    {p.stock_actual}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>{p.stock_minimo}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ background: p.activo ? '#d4edda' : '#f8d7da', color: p.activo ? '#155724' : '#721c24', padding: '3px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>
                  <Link href={`/dashboard/inventario/productos/${p.id}`} style={{ color: 'var(--primary-blue)', textDecoration: 'none', fontWeight: '500', fontSize: '0.9rem' }}>
                    Ver detalle
                  </Link>
                </td>
              </tr>
            ))}
            {productos.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>No hay productos para mostrar.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {nextUrl && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button onClick={handleLoadMore} disabled={loadingMore} style={{ padding: '10px 30px', background: 'var(--primary-blue)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: loadingMore ? 0.7 : 1 }}>
            {loadingMore ? 'Cargando...' : 'Cargar más'}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test — debe pasar**

```bash
cd frontend && npm test -- tests/features/dashboard/inventario-productos-list.test.tsx
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/app/dashboard/inventario/productos/page.tsx \
        frontend/tests/features/dashboard/inventario-productos-list.test.tsx
git commit -m "feat(inventario-frontend): página lista de productos con búsqueda y creación"
```

---

### Task 6: Producto detail page

**Files:**
- Test: `frontend/tests/features/dashboard/inventario-producto-detail.test.tsx`
- Create: `frontend/app/dashboard/inventario/productos/[id]/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/features/dashboard/inventario-producto-detail.test.tsx`:

```typescript
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

  it('admin ve formulario de ingreso', async () => {
    localStorageMock.setItem('access_token', 'tok');
    localStorageMock.setItem('user_role', 'admin');
    mockApiFetch
      .mockResolvedValueOnce(productoAdmin)
      .mockResolvedValueOnce(historialVacio);

    const { default: Page } = await import('@/app/dashboard/inventario/productos/[id]/page');
    render(<Page />);

    await waitFor(() => expect(screen.getByRole('button', { name: /registrar ingreso/i })).toBeInTheDocument());
  });

  it('bacteriologo NO ve formulario de ingreso', async () => {
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
```

- [ ] **Step 2: Run test — debe fallar**

```bash
cd frontend && npm test -- tests/features/dashboard/inventario-producto-detail.test.tsx
```

Expected: FAIL — página no existe.

- [ ] **Step 3: Crear `frontend/app/dashboard/inventario/productos/[id]/page.tsx`**

```typescript
'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { PaginatedResponse, ProductoDetalle, ProductoBacteriologoDetalle, MovimientoLista } from '@/lib/types';

const inputStyle = {
  width: '100%', padding: '10px 15px', borderRadius: '8px',
  border: '1px solid #ddd', fontSize: '0.95rem', outline: 'none',
  boxSizing: 'border-box' as const,
};

function tipoBadge(tipo: 'INGRESO' | 'EGRESO') {
  const s = tipo === 'INGRESO' ? { bg: '#d4edda', color: '#155724' } : { bg: '#ffebee', color: '#c62828' };
  return <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold' }}>{tipo}</span>;
}

export default function ProductoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [role, setRole] = useState<string | null>(null);
  const [producto, setProducto] = useState<(ProductoDetalle | ProductoBacteriologoDetalle) | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoLista[]>([]);
  const [movNextUrl, setMovNextUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Panel visibility
  const [showIngreso, setShowIngreso] = useState(false);
  const [showEgreso, setShowEgreso] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  // Ingreso form
  const [ingresoData, setIngresoData] = useState({ cantidad: '', motivo: '', ultimo_costo: '', fecha_vencimiento: '', numero_lote: '' });
  const [ingresoLoading, setIngresoLoading] = useState(false);
  const [ingresoError, setIngresoError] = useState('');

  // Egreso form
  const [egresoData, setEgresoData] = useState({ cantidad: '', motivo: '' });
  const [egresoLoading, setEgresoLoading] = useState(false);
  const [egresoError, setEgresoError] = useState('');

  useEffect(() => {
    const r = window.localStorage.getItem('user_role');
    setRole(r);

    const load = async () => {
      try {
        const [prod, movs] = await Promise.all([
          apiFetch<ProductoDetalle>(`/api/inventario/productos/${id}/`),
          apiFetch<PaginatedResponse<MovimientoLista>>(`/api/inventario/productos/${id}/movimientos/`),
        ]);
        setProducto(prod);
        setMovimientos(movs.results);
        setMovNextUrl(movs.next);
      } catch {
        setError('Error al cargar el producto.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleIngreso = async (e: FormEvent) => {
    e.preventDefault();
    setIngresoLoading(true);
    setIngresoError('');
    try {
      const body: Record<string, unknown> = {
        cantidad: parseInt(ingresoData.cantidad, 10),
        motivo: ingresoData.motivo,
      };
      if (ingresoData.ultimo_costo) body.ultimo_costo = ingresoData.ultimo_costo;
      if (ingresoData.fecha_vencimiento) body.fecha_vencimiento = ingresoData.fecha_vencimiento;
      if (ingresoData.numero_lote) body.numero_lote = ingresoData.numero_lote;

      const updated = await apiFetch<ProductoDetalle>(`/api/inventario/productos/${id}/ingreso/`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setProducto(updated);
      setIngresoData({ cantidad: '', motivo: '', ultimo_costo: '', fecha_vencimiento: '', numero_lote: '' });
      setShowIngreso(false);
      // Reload historial
      const movs = await apiFetch<PaginatedResponse<MovimientoLista>>(`/api/inventario/productos/${id}/movimientos/`);
      setMovimientos(movs.results);
    } catch (err) {
      setIngresoError(err instanceof Error ? err.message : 'Error al registrar ingreso.');
    } finally {
      setIngresoLoading(false);
    }
  };

  const handleEgreso = async (e: FormEvent) => {
    e.preventDefault();
    setEgresoLoading(true);
    setEgresoError('');
    try {
      const updated = await apiFetch<ProductoDetalle>(`/api/inventario/productos/${id}/egreso/`, {
        method: 'POST',
        body: JSON.stringify({ cantidad: parseInt(egresoData.cantidad, 10), motivo: egresoData.motivo }),
      });
      setProducto(updated);
      setEgresoData({ cantidad: '', motivo: '' });
      setShowEgreso(false);
      const movs = await apiFetch<PaginatedResponse<MovimientoLista>>(`/api/inventario/productos/${id}/movimientos/`);
      setMovimientos(movs.results);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al registrar egreso.';
      try { setEgresoError(JSON.parse(msg).cantidad?.[0] ?? msg); } catch { setEgresoError(msg); }
    } finally {
      setEgresoLoading(false);
    }
  };

  const handleToggle = async () => {
    try {
      const updated = await apiFetch<ProductoDetalle>(`/api/inventario/productos/${id}/toggle/`, { method: 'PATCH' });
      setProducto(updated);
    } catch {
      setError('Error al cambiar estado del producto.');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando...</div>;
  if (!producto) return <div style={{ color: '#c62828', padding: '2rem' }}>{error || 'Producto no encontrado.'}</div>;

  const isAdmin = role === 'admin';
  const stockBajo = producto.stock_actual <= producto.stock_minimo;

  return (
    <div>
      {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>{error}</div>}

      {/* Breadcrumb */}
      <p style={{ color: '#888', marginBottom: '1rem', fontSize: '0.9rem' }}>
        <Link href="/dashboard/inventario/productos" style={{ color: 'var(--primary-blue)', textDecoration: 'none' }}>Productos</Link>
        {' / '}{producto.nombre}
      </p>

      {/* Info card */}
      <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ color: 'var(--primary-blue)', margin: '0 0 4px 0' }}>{producto.nombre}</h2>
            <p style={{ color: '#888', margin: 0, fontSize: '0.9rem' }}>Código: <strong>{producto.codigo}</strong></p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <span style={{ background: producto.activo ? '#d4edda' : '#f8d7da', color: producto.activo ? '#155724' : '#721c24', padding: '4px 10px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.9rem' }}>
              {producto.activo ? 'Activo' : 'Inactivo'}
            </span>
            {isAdmin && (
              <button onClick={handleToggle} style={{ padding: '4px 12px', background: '#f1f1f1', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }}>
                {producto.activo ? 'Desactivar' : 'Activar'}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginTop: '1.5rem' }}>
          {[
            { label: 'Stock Actual', value: String(producto.stock_actual), alert: stockBajo },
            { label: 'Stock Mínimo', value: String(producto.stock_minimo), alert: false },
            { label: 'Categoría', value: producto.categoria, alert: false },
            { label: 'Unidad de Medida', value: producto.unidad_medida, alert: false },
            { label: 'Proveedor', value: producto.proveedor_habitual || '—', alert: false },
            ...(isAdmin && 'ultimo_costo' in producto
              ? [{ label: 'Último Costo', value: producto.ultimo_costo ? `$${producto.ultimo_costo}` : '—', alert: false }]
              : []),
          ].map(({ label, value, alert }) => (
            <div key={label}>
              <p style={{ color: 'var(--text-gray)', margin: '0 0 4px 0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
              <p style={{ margin: 0, fontWeight: '600', color: alert ? '#c62828' : '#333' }}>{value}</p>
            </div>
          ))}
        </div>

        {stockBajo && (
          <div style={{ background: '#fff3cd', color: '#856404', padding: '10px 15px', borderRadius: '8px', marginTop: '1rem', fontSize: '0.9rem' }}>
            <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px' }} />
            Stock bajo — considere registrar un ingreso.
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {isAdmin && (
          <button onClick={() => { setShowIngreso(!showIngreso); setShowEgreso(false); setShowEdit(false); }}
            style={{ padding: '10px 20px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            {showIngreso ? 'Cancelar' : 'Registrar Ingreso'}
          </button>
        )}
        <button onClick={() => { setShowEgreso(!showEgreso); setShowIngreso(false); setShowEdit(false); }}
          style={{ padding: '10px 20px', background: '#fd7e14', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          {showEgreso ? 'Cancelar' : 'Registrar Egreso'}
        </button>
        {isAdmin && (
          <button onClick={() => { setShowEdit(!showEdit); setShowIngreso(false); setShowEgreso(false); }}
            style={{ padding: '10px 20px', background: 'var(--primary-blue)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            {showEdit ? 'Cancelar' : 'Editar Datos'}
          </button>
        )}
      </div>

      {/* Ingreso form */}
      {showIngreso && isAdmin && (
        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
          <h3 style={{ color: '#28a745', marginBottom: '1rem' }}>Registrar Ingreso de Stock</h3>
          {ingresoError && <div style={{ background: '#ffebee', color: '#c62828', padding: '10px', borderRadius: '8px', marginBottom: '10px' }}>{ingresoError}</div>}
          <form onSubmit={handleIngreso} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Cantidad *</label>
              <input type="number" min="1" required aria-label="Cantidad" value={ingresoData.cantidad} onChange={e => setIngresoData({ ...ingresoData, cantidad: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Motivo *</label>
              <input required placeholder="Motivo del ingreso" value={ingresoData.motivo} onChange={e => setIngresoData({ ...ingresoData, motivo: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Último Costo</label>
              <input type="number" step="0.01" value={ingresoData.ultimo_costo} onChange={e => setIngresoData({ ...ingresoData, ultimo_costo: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Fecha Vencimiento</label>
              <input type="date" value={ingresoData.fecha_vencimiento} onChange={e => setIngresoData({ ...ingresoData, fecha_vencimiento: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" disabled={ingresoLoading} style={{ padding: '12px 30px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', width: '100%', opacity: ingresoLoading ? 0.7 : 1, fontWeight: 'bold' }}>
                {ingresoLoading ? 'Guardando...' : 'Confirmar Ingreso'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Egreso form */}
      {showEgreso && (
        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
          <h3 style={{ color: '#fd7e14', marginBottom: '1rem' }}>Registrar Egreso de Stock</h3>
          {egresoError && <div style={{ background: '#ffebee', color: '#c62828', padding: '10px', borderRadius: '8px', marginBottom: '10px' }}>{egresoError}</div>}
          <form onSubmit={handleEgreso} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Cantidad *</label>
              <input type="number" min="1" required aria-label="Cantidad" value={egresoData.cantidad} onChange={e => setEgresoData({ ...egresoData, cantidad: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Motivo *</label>
              <input required placeholder="Motivo del egreso" value={egresoData.motivo} onChange={e => setEgresoData({ ...egresoData, motivo: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" disabled={egresoLoading} style={{ padding: '12px 30px', background: '#fd7e14', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', width: '100%', opacity: egresoLoading ? 0.7 : 1, fontWeight: 'bold' }}>
                {egresoLoading ? 'Guardando...' : 'Confirmar Egreso'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Historial de movimientos */}
      <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: '#333', marginBottom: '1rem' }}>Historial de Movimientos</h3>
        {movimientos.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '1rem' }}>Sin movimientos registrados.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                {['Fecha', 'Tipo', 'Cantidad'].map(h => <th key={h} style={{ padding: '10px', color: '#555', textAlign: 'left' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {movimientos.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px', fontSize: '0.9rem' }}>{new Date(m.fecha_registro).toLocaleString('es-CO')}</td>
                  <td style={{ padding: '10px' }}>{tipoBadge(m.tipo)}</td>
                  <td style={{ padding: '10px', fontWeight: '600' }}>{m.cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {movNextUrl && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button onClick={async () => {
              const data = await apiFetch<PaginatedResponse<MovimientoLista>>(movNextUrl);
              setMovimientos(prev => [...prev, ...data.results]);
              setMovNextUrl(data.next);
            }} style={{ padding: '8px 20px', background: 'var(--primary-blue)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              Cargar más
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test — debe pasar**

```bash
cd frontend && npm test -- tests/features/dashboard/inventario-producto-detail.test.tsx
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add "frontend/app/dashboard/inventario/productos/[id]/page.tsx" \
        frontend/tests/features/dashboard/inventario-producto-detail.test.tsx
git commit -m "feat(inventario-frontend): página detalle producto con ingreso, egreso e historial"
```

---

### Task 7: Movimientos page + CSV export

**Files:**
- Test: `frontend/tests/features/dashboard/inventario-movimientos.test.tsx`
- Create: `frontend/app/dashboard/inventario/movimientos/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/features/dashboard/inventario-movimientos.test.tsx`:

```typescript
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
```

- [ ] **Step 2: Run test — debe fallar**

```bash
cd frontend && npm test -- tests/features/dashboard/inventario-movimientos.test.tsx
```

Expected: FAIL — página no existe.

- [ ] **Step 3: Crear `frontend/app/dashboard/inventario/movimientos/page.tsx`**

```typescript
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, apiFetchBlob } from '@/lib/api';
import type { PaginatedResponse, MovimientoLista } from '@/lib/types';

const inputStyle = {
  padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd',
  fontSize: '0.9rem', outline: 'none',
};

function tipoBadge(tipo: 'INGRESO' | 'EGRESO') {
  const s = tipo === 'INGRESO' ? { bg: '#d4edda', color: '#155724' } : { bg: '#ffebee', color: '#c62828' };
  return <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold' }}>{tipo}</span>;
}

export default function MovimientosPage() {
  const router = useRouter();
  const [movimientos, setMovimientos] = useState<MovimientoLista[]>([]);
  const [count, setCount] = useState(0);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const r = window.localStorage.getItem('user_role');
    if (r !== 'admin') { router.push('/dashboard'); return; }
    fetchMovimientos('/api/inventario/movimientos/');
  }, [router]);

  const fetchMovimientos = async (url: string) => {
    try {
      const data = await apiFetch<PaginatedResponse<MovimientoLista>>(url);
      setMovimientos(data.results);
      setCount(data.count);
      setNextUrl(data.next);
    } catch {
      setError('Error al cargar movimientos.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (fechaDesde) params.set('fecha_desde', fechaDesde);
    if (fechaHasta) params.set('fecha_hasta', fechaHasta);
    const qs = params.toString();
    fetchMovimientos(`/api/inventario/movimientos/${qs ? `?${qs}` : ''}`);
  };

  const handleLoadMore = async () => {
    if (!nextUrl) return;
    setLoadingMore(true);
    try {
      const data = await apiFetch<PaginatedResponse<MovimientoLista>>(nextUrl);
      setMovimientos(prev => [...prev, ...data.results]);
      setNextUrl(data.next);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (fechaDesde) params.set('fecha_desde', fechaDesde);
      if (fechaHasta) params.set('fecha_hasta', fechaHasta);
      const qs = params.toString();
      const blob = await apiFetchBlob(`/api/inventario/movimientos/exportar/${qs ? `?${qs}` : ''}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventario_movimientos_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('Error al exportar CSV.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando...</div>;

  return (
    <div>
      {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ color: 'var(--primary-blue)', margin: 0 }}>Trazabilidad de Movimientos</h2>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{ padding: '10px 20px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', opacity: exporting ? 0.7 : 1 }}
        >
          <i className="fas fa-download" style={{ marginRight: '6px' }} />
          {exporting ? 'Exportando...' : 'Exportar CSV'}
        </button>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar producto o motivo..."
          style={{ ...inputStyle, flex: 1, minWidth: '200px' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '0.9rem', color: '#666' }}>Desde:</label>
          <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '0.9rem', color: '#666' }}>Hasta:</label>
          <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={inputStyle} />
        </div>
        <button type="submit" style={{ padding: '8px 20px', background: 'var(--primary-blue)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          Filtrar
        </button>
      </form>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: '10px', padding: '1rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          Mostrando {movimientos.length} de {count} movimientos
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
              {['Fecha', 'Producto', 'Tipo', 'Cantidad'].map(h => (
                <th key={h} style={{ padding: '12px', color: '#555' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {movimientos.map(m => (
              <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px', fontSize: '0.9rem' }}>{new Date(m.fecha_registro).toLocaleString('es-CO')}</td>
                <td style={{ padding: '12px', fontWeight: '500' }}>{m.producto_nombre}</td>
                <td style={{ padding: '12px' }}>{tipoBadge(m.tipo)}</td>
                <td style={{ padding: '12px' }}>{m.cantidad}</td>
              </tr>
            ))}
            {movimientos.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>No hay movimientos para mostrar.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {nextUrl && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button onClick={handleLoadMore} disabled={loadingMore} style={{ padding: '10px 30px', background: 'var(--primary-blue)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: loadingMore ? 0.7 : 1 }}>
            {loadingMore ? 'Cargando...' : 'Cargar más'}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test — debe pasar**

```bash
cd frontend && npm test -- tests/features/dashboard/inventario-movimientos.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 5: Run all inventario tests together**

```bash
cd frontend && npm test -- tests/features/dashboard/inventario
```

Expected: All inventario test files pass.

- [ ] **Step 6: Run full test suite to check no regressions**

```bash
cd frontend && npm test
```

Expected: All tests pass (existing tests unaffected).

- [ ] **Step 7: Commit**

```bash
git add frontend/app/dashboard/inventario/movimientos/page.tsx \
        frontend/tests/features/dashboard/inventario-movimientos.test.tsx
git commit -m "feat(inventario-frontend): página movimientos con filtros y exportar CSV"
```

---

## Self-Review

### Spec coverage check

| Endpoint | Frontend coverage |
|---|---|
| GET `/productos/` | Task 5 — lista paginada con búsqueda |
| POST `/productos/` | Task 5 — formulario crear (admin) |
| GET `/productos/<id>/` | Task 6 — detalle con datos diferenciados por rol |
| PATCH `/productos/<id>/` | Task 6 — botón Editar Datos (admin) |
| PATCH `/productos/<id>/toggle/` | Task 6 — botón Activar/Desactivar (admin) |
| POST `/productos/<id>/ingreso/` | Task 6 — formulario ingreso (admin) |
| POST `/productos/<id>/egreso/` | Task 6 — formulario egreso (ambos roles) |
| GET `/productos/<id>/movimientos/` | Task 6 — historial con paginación |
| GET `/alertas/` | Task 4 — secciones stock_bajo, por_vencer, vencidos |
| GET `/movimientos/` | Task 7 — trazabilidad global |
| GET `/movimientos/exportar/` | Task 7 — descarga CSV |
| GET `/resumen/` | Task 4 — tarjetas admin |
| `bacteriologo` no ve `ultimo_costo` | Task 6 — campo omitido en detalle |
| `bacteriologo` no accede a movimientos | Task 7 — redirect a /dashboard |
| Dashboard nav wired | Task 2 |
| Auth guard admin+bacteriologo | Task 3 |

All spec requirements covered. ✓

### Placeholder scan

No TBD, TODO, "similar to", or "add appropriate" phrases present. ✓

### Type consistency

- `ProductoLista`, `ProductoDetalle`, `ProductoBacteriologoDetalle`, `MovimientoLista`, `InventarioAlertas`, `InventarioResumen` defined in Task 1 and used consistently in Tasks 4–7. ✓
- `apiFetch<T>` and `apiFetchBlob` from `@/lib/api` used everywhere. ✓
- `useParams<{ id: string }>()` used in Task 6, consistent with Next.js App Router API. ✓
