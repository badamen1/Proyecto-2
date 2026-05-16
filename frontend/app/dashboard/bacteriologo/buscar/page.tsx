'use client';

import { useState } from 'react';
import { apiFetch, apiFetchBlob } from '@/lib/api';
import type { ResultadoLista, ResultadoEstado } from '@/lib/types';

type PacienteBuscar = {
  id: number;
  tipo_documento: string;
  documento: string;
  nombre_completo: string;
  telefono: string;
  activo: boolean;
};

const badgeColors: Record<ResultadoEstado, { bg: string; color: string }> = {
  PENDIENTE: { bg: '#fff3cd', color: '#856404' },
  VALIDADO: { bg: '#d4edda', color: '#155724' },
  ENTREGADO: { bg: '#cce5ff', color: '#004085' },
};

export default function BuscarPacientePage() {
  const [documento, setDocumento] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [paciente, setPaciente] = useState<PacienteBuscar | null>(null);
  const [resultados, setResultados] = useState<ResultadoLista[]>([]);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuscando(true);
    setPaciente(null);
    setResultados([]);
    setNoEncontrado(false);
    setError(null);

    try {
      const p = await apiFetch<PacienteBuscar>(`/api/pacientes/buscar/?documento=${documento.trim()}`);
      setPaciente(p);

      // PacienteResultadosView puede retornar array plano o paginado según config global
      const raw = await apiFetch<{ results: ResultadoLista[] } | ResultadoLista[]>(
        `/api/pacientes/${p.id}/resultados/`
      );
      setResultados(Array.isArray(raw) ? raw : raw.results);
    } catch (err) {
      const msg = (err as Error).message || '';
      if (msg.includes('404') || msg.toLowerCase().includes('no se encontró')) {
        setNoEncontrado(true);
      } else {
        setError(msg || 'Error al buscar');
      }
    } finally {
      setBuscando(false);
    }
  };

  const descargarPDF = async (id: string, nombre: string | null) => {
    setDownloadingId(id);
    try {
      const blob = await apiFetchBlob(`/api/resultados/${id}/pdf/`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre ?? `resultado_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('No se pudo descargar: ' + (err as Error).message);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
      <h2 style={{ color: 'var(--primary-blue)', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
        Buscar Paciente
      </h2>

      <form onSubmit={buscar} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', maxWidth: '480px' }}>
        <input
          type="text"
          value={documento}
          onChange={(e) => setDocumento(e.target.value)}
          placeholder="N° de documento"
          required
          style={{ flex: 1, padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem' }}
        />
        <button
          type="submit"
          disabled={buscando || !documento}
          style={{ background: 'var(--primary-blue)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {buscando ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {error && (
        <div style={{ background: '#f8d7da', color: '#721c24', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {noEncontrado && (
        <div style={{ background: '#fff3cd', color: '#856404', padding: '1rem', borderRadius: '8px' }}>
          <strong>Paciente no registrado.</strong> Los resultados que hayas subido con el documento{' '}
          <strong>{documento}</strong> aparecerán en su portal cuando se registre.
        </div>
      )}

      {paciente && (
        <>
          <div style={{ background: '#f0f7ff', border: '1px solid #b8d9f7', borderRadius: '10px', padding: '1.5rem', marginBottom: '2rem' }}>
            <h3 style={{ color: 'var(--primary-blue)', margin: '0 0 1rem 0' }}>
              <i className="fas fa-user" style={{ marginRight: '10px' }} />
              {paciente.nombre_completo}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.9rem', color: '#555' }}>
              <span><strong>Documento:</strong> {paciente.tipo_documento} {paciente.documento}</span>
              {paciente.telefono && <span><strong>Teléfono:</strong> {paciente.telefono}</span>}
            </div>
          </div>

          <h3 style={{ color: '#333', marginBottom: '1rem' }}>
            Historial de Resultados ({resultados.length})
          </h3>

          {resultados.length === 0 ? (
            <p style={{ color: 'var(--text-gray)' }}>Este paciente no tiene resultados registrados.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '12px' }}>Examen</th>
                  <th style={{ padding: '12px' }}>Fecha</th>
                  <th style={{ padding: '12px' }}>Estado</th>
                  <th style={{ padding: '12px' }}>PDF</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((r) => {
                  const colors = badgeColors[r.estado] ?? { bg: '#eee', color: '#333' };
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{r.tipo_examen}</td>
                      <td style={{ padding: '12px' }}>{new Date(r.fecha_examen).toLocaleDateString('es-CO')}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ background: colors.bg, color: colors.color, padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          {r.estado}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        {r.nombre_archivo ? (
                          <button
                            onClick={() => descargarPDF(r.id, r.nombre_archivo)}
                            disabled={downloadingId === r.id}
                            style={{ background: '#28a745', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                          >
                            {downloadingId === r.id ? 'Descargando...' : 'Descargar PDF'}
                          </button>
                        ) : (
                          <span style={{ color: '#aaa', fontSize: '0.85rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
