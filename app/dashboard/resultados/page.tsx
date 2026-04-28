'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch, apiFetchBlob } from '@/lib/api';
import type { PaginatedResponse, ResultadoLista, ResultadoEstado } from '@/lib/types';

const badgeColors: Record<ResultadoEstado, { bg: string; color: string }> = {
  PENDIENTE: { bg: '#fff3cd', color: '#856404' },
  VALIDADO: { bg: '#d4edda', color: '#155724' },
  ENTREGADO: { bg: '#cce5ff', color: '#004085' },
};

function pathFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

export default function ResultadosListaPage() {
  const router = useRouter();
  const [results, setResults] = useState<ResultadoLista[]>([]);
  const [count, setCount] = useState(0);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PaginatedResponse<ResultadoLista>>('/api/resultados/');
      setResults(data.results);
      setCount(data.count);
      setNextUrl(data.next);
    } catch (err) {
      setError((err as Error).message || 'Error al cargar resultados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = window.localStorage.getItem('access_token');
    const role = window.localStorage.getItem('user_role');
    if (!token) {
      router.push('/login');
      return;
    }
    if (role !== 'paciente') {
      router.push('/dashboard');
      return;
    }
    void loadFirst();
  }, [router, loadFirst]);

  const loadMore = async () => {
    if (!nextUrl) return;
    setLoadingMore(true);
    try {
      const data = await apiFetch<PaginatedResponse<ResultadoLista>>(pathFromUrl(nextUrl));
      setResults((prev) => [...prev, ...data.results]);
      setNextUrl(data.next);
    } catch (err) {
      setError((err as Error).message || 'Error al cargar más');
    } finally {
      setLoadingMore(false);
    }
  };

  const descargarPDF = async (id: string, nombreArchivo: string | null) => {
    setDownloadingId(id);
    try {
      const blob = await apiFetchBlob(`/api/resultados/${id}/pdf/`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivo ?? `resultado_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('No se pudo descargar el PDF: ' + (err as Error).message);
    } finally {
      setDownloadingId(null);
    }
  };

  const verPDFNuevaTab = async (id: string) => {
    setDownloadingId(id);
    try {
      const blob = await apiFetchBlob(`/api/resultados/${id}/pdf/`);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      alert('No se pudo abrir el PDF: ' + (err as Error).message);
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        Cargando resultados...
      </div>
    );
  }

  return (
    <section className="section" style={{ background: '#f4f6f9', minHeight: '90vh' }}>
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem', background: '#fff', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', color: 'var(--primary-blue)', margin: 0 }}>Mis Resultados</h1>
            <p style={{ color: 'var(--text-gray)', margin: 0, fontSize: '0.9rem' }}>Mostrando {results.length} de {count}</p>
          </div>
          <Link href="/dashboard" style={{ color: 'var(--primary-blue)', textDecoration: 'none', fontWeight: 'bold' }}>← Volver al dashboard</Link>
        </div>

        {error && (
          <div style={{ background: '#f8d7da', color: '#721c24', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
            {error}{' '}
            <button onClick={loadFirst} style={{ marginLeft: '10px', padding: '4px 10px', border: '1px solid #721c24', background: 'transparent', color: '#721c24', borderRadius: '4px', cursor: 'pointer' }}>
              Reintentar
            </button>
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          {count === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-gray)' }}>
              <i className="fas fa-file-medical-alt" style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem', display: 'block' }}></i>
              Aún no tienes resultados disponibles.
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '12px' }}>Tipo de examen</th>
                    <th style={{ padding: '12px' }}>Fecha</th>
                    <th style={{ padding: '12px' }}>Estado</th>
                    <th style={{ padding: '12px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const colors = badgeColors[r.estado];
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{r.tipo_examen}</td>
                        <td style={{ padding: '12px' }}>{new Date(r.fecha_examen).toLocaleDateString('es-CO')}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ background: colors.bg, color: colors.color, padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            {r.estado}
                          </span>
                        </td>
                        <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                          {r.fuente === 'FASIL' ? (
                            r.tiene_pdf !== false ? (
                              <>
                                <button
                                  onClick={() => verPDFNuevaTab(String(r.id))}
                                  disabled={downloadingId === String(r.id)}
                                  style={{ background: 'var(--primary-blue)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                                >
                                  Ver PDF
                                </button>
                                <button
                                  onClick={() => descargarPDF(String(r.id), r.nombre_archivo)}
                                  disabled={downloadingId === String(r.id)}
                                  style={{ background: '#28a745', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                                >
                                  {downloadingId === String(r.id) ? 'Descargando...' : 'PDF'}
                                </button>
                              </>
                            ) : (
                              <button
                                disabled
                                style={{ background: '#ccc', color: '#666', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '0.85rem', cursor: 'not-allowed' }}
                              >
                                PDF no disponible
                              </button>
                            )
                          ) : (
                            <>
                              <Link
                                href={`/dashboard/resultados/${r.id}`}
                                style={{ background: 'var(--primary-blue)', color: '#fff', padding: '6px 12px', borderRadius: '4px', textDecoration: 'none', fontSize: '0.85rem' }}
                              >
                                Ver
                              </Link>
                              <button
                                onClick={() => descargarPDF(String(r.id), r.nombre_archivo)}
                                disabled={downloadingId === String(r.id)}
                                style={{ background: '#28a745', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                              >
                                {downloadingId === String(r.id) ? 'Descargando...' : 'PDF'}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {nextUrl && (
                <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    style={{ padding: '10px 25px', background: 'var(--primary-blue)', color: '#fff', border: 'none', borderRadius: '25px', cursor: 'pointer', fontSize: '0.9rem' }}
                  >
                    {loadingMore ? 'Cargando...' : 'Cargar más'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
