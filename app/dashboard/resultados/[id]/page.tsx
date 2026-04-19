'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch, apiFetchBlob } from '@/lib/api';
import type { ResultadoDetalle, ResultadoEstado } from '@/lib/types';

const badgeColors: Record<ResultadoEstado, { bg: string; color: string }> = {
  PENDIENTE: { bg: '#fff3cd', color: '#856404' },
  VALIDADO: { bg: '#d4edda', color: '#155724' },
  ENTREGADO: { bg: '#cce5ff', color: '#004085' },
};

const fuenteLegible: Record<string, string> = {
  FASIL: 'Sistema FASIL',
  EXTERNO: 'Laboratorio Externo',
  MANUAL: 'Ingreso Manual',
};

export default function ResultadoDetallePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [resultado, setResultado] = useState<ResultadoDetalle | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }
    if (!id) return;

    let cancelled = false;
    let createdBlobUrl: string | null = null;

    (async () => {
      try {
        const data = await apiFetch<ResultadoDetalle>(`/api/resultados/${id}/`);
        if (cancelled) return;
        setResultado(data);
      } catch (err) {
        if (!cancelled) setError((err as Error).message || 'Resultado no disponible');
      } finally {
        if (!cancelled) setLoading(false);
      }

      try {
        const blob = await apiFetchBlob(`/api/resultados/${id}/pdf/`);
        if (cancelled) return;
        createdBlobUrl = URL.createObjectURL(blob);
        setBlobUrl(createdBlobUrl);
      } catch (err) {
        if (!cancelled) setPdfError((err as Error).message || 'No se pudo cargar el PDF');
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
  }, [id, router]);

  const descargarPDF = async () => {
    if (!id) return;
    try {
      const blob = await apiFetchBlob(`/api/resultados/${id}/pdf/`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resultado?.nombre_archivo ?? `resultado_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('No se pudo descargar: ' + (err as Error).message);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        Cargando resultado...
      </div>
    );
  }

  if (error || !resultado) {
    return (
      <section className="section" style={{ background: '#f4f6f9', minHeight: '90vh' }}>
        <div className="container" style={{ textAlign: 'center', padding: '4rem' }}>
          <h2 style={{ color: '#721c24' }}>Resultado no encontrado o no disponible</h2>
          <p style={{ color: 'var(--text-gray)' }}>{error}</p>
          <Link href="/dashboard/resultados" style={{ color: 'var(--primary-blue)', fontWeight: 'bold' }}>← Volver a mis resultados</Link>
        </div>
      </section>
    );
  }

  const colors = badgeColors[resultado.estado];

  return (
    <section className="section" style={{ background: '#f4f6f9', minHeight: '90vh' }}>
      <div className="container">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem', background: '#fff', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', color: 'var(--primary-blue)', margin: 0, display: 'inline-block', marginRight: '1rem' }}>{resultado.tipo_examen}</h1>
            <span style={{ background: colors.bg, color: colors.color, padding: '5px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold' }}>
              {resultado.estado}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={descargarPDF} style={{ background: '#28a745', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
              Descargar PDF
            </button>
            <Link href="/dashboard/resultados" style={{ background: '#f1f1f1', color: '#555', padding: '8px 16px', borderRadius: '4px', textDecoration: 'none' }}>← Volver</Link>
          </div>
        </div>

        {/* Metadata */}
        <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <MetaRow label="Fecha del examen" value={new Date(resultado.fecha_examen).toLocaleDateString('es-CO')} />
            <MetaRow label="Fecha de carga" value={new Date(resultado.fecha_carga).toLocaleString('es-CO')} />
            <MetaRow label="Fuente" value={fuenteLegible[resultado.fuente] ?? resultado.fuente} />
            <MetaRow label="Subido por" value={resultado.subido_por_nombre ?? '—'} />
            {resultado.observaciones && (
              <div style={{ gridColumn: '1 / span 2' }}>
                <MetaRow label="Observaciones" value={resultado.observaciones} />
              </div>
            )}
          </div>
        </div>

        {/* Visor PDF */}
        <div style={{ background: '#fff', borderRadius: '10px', padding: '1rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          {pdfLoading && <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando PDF...</div>}
          {pdfError && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#721c24' }}>
              No se pudo cargar el PDF. Puedes descargarlo con el botón de arriba.
            </div>
          )}
          {blobUrl && (
            <iframe
              title="Visor PDF del resultado"
              src={blobUrl}
              style={{ width: '100%', height: '800px', border: '1px solid #ddd', borderRadius: '8px' }}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-gray)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontWeight: 'bold', color: '#333' }}>{value}</div>
    </div>
  );
}
