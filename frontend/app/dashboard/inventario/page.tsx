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
            {['Código', 'Nombre', 'Stock Actual', 'Stock Mínimo', 'Categoría'].map(h => (
              <th key={h} style={{ padding: '10px', color: '#555', textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
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
