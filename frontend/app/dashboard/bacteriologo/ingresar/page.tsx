'use client';

import { useState, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export default function IngresarResultadoPage() {
  const [documento, setDocumento] = useState('');
  const [tipoExamen, setTipoExamen] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivo) return;
    setLoading(true);
    setError(null);

    const token = window.localStorage.getItem('access_token') ?? '';
    const hoy = new Date().toISOString().split('T')[0];

    const formData = new FormData();
    formData.append('paciente_documento', documento.trim());
    formData.append('tipo_examen', tipoExamen.trim());
    formData.append('archivo_pdf', archivo);
    formData.append('fuente', 'EXTERNO');
    formData.append('fecha_examen', hoy);

    try {
      const res = await fetch(`${API_BASE}/api/resultados/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || res.statusText);
      }
      setExito(true);
    } catch (err) {
      setError((err as Error).message || 'Error al subir el resultado');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDocumento('');
    setTipoExamen('');
    setArchivo(null);
    setExito(false);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  if (exito) {
    return (
      <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', color: '#28a745', marginBottom: '1rem' }}>
          <i className="fas fa-check-circle" />
        </div>
        <h2 style={{ color: '#333', marginBottom: '0.5rem' }}>Resultado ingresado exitosamente</h2>
        <p style={{ color: 'var(--text-gray)', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
          El resultado queda pendiente de validación. El paciente lo verá en su portal una vez que lo valides.
        </p>
        <button
          onClick={resetForm}
          style={{ background: 'var(--primary-blue)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '25px', cursor: 'pointer', fontSize: '1rem' }}
        >
          Ingresar otro resultado
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
      <h2 style={{ color: 'var(--primary-blue)', marginBottom: '0.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
        Ingresar Resultado Externo
      </h2>
      <p style={{ color: 'var(--text-gray)', marginBottom: '2rem', fontSize: '0.9rem' }}>
        Si el paciente aún no está registrado en el sistema, el resultado aparecerá en su portal automáticamente cuando se registre con el mismo número de documento.
      </p>

      {error && (
        <div style={{ background: '#f8d7da', color: '#721c24', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '480px' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>
            N° Documento del Paciente
          </label>
          <input
            type="text"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            placeholder="Ej: 1023456789"
            required
            style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' as const }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>
            Nombre del Examen
          </label>
          <input
            type="text"
            value={tipoExamen}
            onChange={(e) => setTipoExamen(e.target.value)}
            placeholder="Ej: Perfil Lipídico"
            required
            style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' as const }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>
            PDF del Resultado
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            required
            style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' as const }}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !documento || !tipoExamen || !archivo}
          style={{
            background: 'var(--primary-blue)',
            color: '#fff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '25px',
            cursor: (loading || !documento || !tipoExamen || !archivo) ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            opacity: (loading || !documento || !tipoExamen || !archivo) ? 0.7 : 1,
            alignSelf: 'flex-start',
          }}
        >
          {loading ? 'Subiendo...' : 'Guardar Resultado'}
        </button>
      </form>
    </div>
  );
}
