'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import type { PaginatedResponse, ResultadoLista, ResultadoEstado } from '@/lib/types';

const badgeColors: Record<ResultadoEstado, { bg: string; color: string }> = {
  PENDIENTE: { bg: '#fff3cd', color: '#856404' },
  VALIDADO: { bg: '#d4edda', color: '#155724' },
  ENTREGADO: { bg: '#cce5ff', color: '#004085' },
};

type EstadoFiltro = ResultadoEstado | 'TODOS';

export default function PanelTrabajoPage() {
  const [resultados, setResultados] = useState<ResultadoLista[]>([]);
  const [count, setCount] = useState(0);
  const [filtro, setFiltro] = useState<EstadoFiltro>('TODOS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validandoId, setValidandoId] = useState<string | null>(null);

  const cargar = useCallback(async (estado: EstadoFiltro) => {
    setLoading(true);
    setError(null);
    try {
      const qs = estado === 'TODOS' ? '' : `?estado=${estado}`;
      const data = await apiFetch<PaginatedResponse<ResultadoLista>>(`/api/resultados/${qs}`);
      setResultados(data.results);
      setCount(data.count);
    } catch (err) {
      setError((err as Error).message || 'Error al cargar resultados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void cargar(filtro); }, [filtro, cargar]);

  const validar = async (id: string) => {
    setValidandoId(id);
    try {
      await apiFetch(`/api/resultados/${id}/estado/`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: 'VALIDADO' }),
      });
      setResultados((prev) =>
        prev.map((r) => r.id === id ? { ...r, estado: 'VALIDADO' as ResultadoEstado } : r)
      );
    } catch (err) {
      alert('Error al validar: ' + (err as Error).message);
    } finally {
      setValidandoId(null);
    }
  };

  return (
    <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
        <h2 style={{ color: 'var(--primary-blue)', margin: 0 }}>Panel de Trabajo</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ color: 'var(--text-gray)', fontSize: '0.9rem' }}>Estado:</label>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as EstadoFiltro)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '0.9rem' }}
          >
            <option value="TODOS">Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="VALIDADO">Validado</option>
            <option value="ENTREGADO">Entregado</option>
          </select>
          <span style={{ color: 'var(--text-gray)', fontSize: '0.85rem' }}>
            {count} resultado{count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {error && (
        <div style={{ background: '#f8d7da', color: '#721c24', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          {error}{' '}
          <button onClick={() => cargar(filtro)} style={{ marginLeft: '10px', padding: '4px 10px', border: '1px solid #721c24', background: 'transparent', color: '#721c24', borderRadius: '4px', cursor: 'pointer' }}>
            Reintentar
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '3rem' }}>Cargando...</p>
      ) : resultados.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '3rem' }}>No hay resultados para mostrar.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '12px' }}>Paciente</th>
              <th style={{ padding: '12px' }}>Examen</th>
              <th style={{ padding: '12px' }}>Fecha</th>
              <th style={{ padding: '12px' }}>Fuente</th>
              <th style={{ padding: '12px' }}>Estado</th>
              <th style={{ padding: '12px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {resultados.map((r) => {
              const colors = badgeColors[r.estado];
              const pacienteLabel = r.paciente_nombre || r.paciente_documento || '—';
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px' }}>{pacienteLabel}</td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{r.tipo_examen}</td>
                  <td style={{ padding: '12px' }}>{new Date(r.fecha_examen).toLocaleDateString('es-CO')}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ fontSize: '0.8rem', padding: '3px 8px', borderRadius: '12px', background: '#e9ecef', color: '#495057' }}>
                      {r.fuente}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ background: colors.bg, color: colors.color, padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      {r.estado}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {r.estado === 'PENDIENTE' && (
                      <button
                        onClick={() => validar(r.id)}
                        disabled={validandoId === r.id}
                        style={{ background: '#28a745', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        {validandoId === r.id ? 'Validando...' : 'Validar'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
