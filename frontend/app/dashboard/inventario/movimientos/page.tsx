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
    } catch {
      setError('Error al cargar más movimientos.');
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
