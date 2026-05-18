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
      setError('');
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
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Número de Lote</label>
              <input value={formData.numero_lote} onChange={e => setFormData({ ...formData, numero_lote: e.target.value })} style={inputStyle} />
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
