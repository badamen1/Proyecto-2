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

  const [showIngreso, setShowIngreso] = useState(false);
  const [showEgreso, setShowEgreso] = useState(false);

  const [ingresoData, setIngresoData] = useState({ cantidad: '', motivo: '', ultimo_costo: '', fecha_vencimiento: '', numero_lote: '' });
  const [ingresoLoading, setIngresoLoading] = useState(false);
  const [ingresoError, setIngresoError] = useState('');

  const [egresoData, setEgresoData] = useState({ cantidad: '', motivo: '' });
  const [egresoLoading, setEgresoLoading] = useState(false);
  const [egresoError, setEgresoError] = useState('');

  const reloadMovimientos = async () => {
    const movs = await apiFetch<PaginatedResponse<MovimientoLista>>(`/api/inventario/productos/${id}/movimientos/`);
    setMovimientos(movs.results);
    setMovNextUrl(movs.next);
  };

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
      await reloadMovimientos();
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
      await reloadMovimientos();
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
          <button onClick={() => { setShowIngreso(!showIngreso); setShowEgreso(false); }}
            style={{ padding: '10px 20px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            {showIngreso ? 'Cancelar' : 'Registrar Ingreso'}
          </button>
        )}
        <button onClick={() => { setShowEgreso(!showEgreso); setShowIngreso(false); }}
          style={{ padding: '10px 20px', background: '#fd7e14', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          {showEgreso ? 'Cancelar' : 'Registrar Egreso'}
        </button>
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
