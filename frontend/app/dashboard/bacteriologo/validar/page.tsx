'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import type { PaginatedResponse, ResultadoLista } from '@/lib/types';

export default function ValidarExamenesPage() {
  const [resultados, setResultados] = useState<ResultadoLista[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validandoId, setValidandoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PaginatedResponse<ResultadoLista>>('/api/resultados/?estado=PENDIENTE');
      setResultados(data.results);
    } catch (err) {
      setError((err as Error).message || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const validar = async (id: string) => {
    setValidandoId(id);
    try {
      await apiFetch(`/api/resultados/${id}/estado/`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: 'VALIDADO' }),
      });
      setResultados((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert('Error al validar: ' + (err as Error).message);
    } finally {
      setValidandoId(null);
    }
  };

  return (
    <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
      <h2 style={{ color: 'var(--primary-blue)', marginBottom: '0.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
        Validar Exámenes
      </h2>
      <p style={{ color: 'var(--text-gray)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Al validar, el resultado queda visible para el paciente en su portal.
      </p>

      {error && (
        <div style={{ background: '#f8d7da', color: '#721c24', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          {error}{' '}
          <button onClick={cargar} style={{ marginLeft: '10px', padding: '4px 10px', border: '1px solid #721c24', background: 'transparent', color: '#721c24', borderRadius: '4px', cursor: 'pointer' }}>
            Reintentar
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '3rem' }}>Cargando...</p>
      ) : resultados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-gray)' }}>
          <i className="fas fa-check-circle" style={{ fontSize: '3rem', color: '#28a745', display: 'block', marginBottom: '1rem' }} />
          No hay exámenes pendientes de validación.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '12px' }}>Paciente</th>
              <th style={{ padding: '12px' }}>Examen</th>
              <th style={{ padding: '12px' }}>Fecha</th>
              <th style={{ padding: '12px' }}>Fuente</th>
              <th style={{ padding: '12px' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {resultados.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px' }}>{r.paciente_nombre || r.paciente_documento || '—'}</td>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>{r.tipo_examen}</td>
                <td style={{ padding: '12px' }}>{new Date(r.fecha_examen).toLocaleDateString('es-CO')}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ fontSize: '0.8rem', padding: '3px 8px', borderRadius: '12px', background: '#e9ecef', color: '#495057' }}>
                    {r.fuente}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>
                  <button
                    onClick={() => validar(r.id)}
                    disabled={validandoId === r.id}
                    style={{ background: '#28a745', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    {validandoId === r.id ? 'Validando...' : 'Validar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
