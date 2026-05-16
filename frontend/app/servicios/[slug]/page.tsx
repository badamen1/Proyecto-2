'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const WHATSAPP_NUMBER = '573103661093';

const CATEGORIA_COLORS: Record<string, string> = {
  'Coagulación':   '#dc3545',
  'Hematología':   '#6610f2',
  'Hormonas':      '#6f42c1',
  'Infectología':  '#fd7e14',
  'Inmunología':   '#0d6efd',
  'Metabolismo':   '#198754',
  'Microbiología': '#d97706',
  'Oncología':     '#343a40',
  'Otras':         '#6c757d',
  'Tiroides':      '#0d9488',
};

interface ExamenDetail {
  slug: string;
  nombre: string;
  codigo: string;
  categoria: string;
  precio: number;
  descripcion: string;
  sintomas: string[];
  requiere_ayuno: boolean;
  preparacion: string;
}

export default function ExamenDetallePage() {
  const { slug } = useParams<{ slug: string }>();
  const [examen, setExamen] = useState<ExamenDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/examenes/${slug}/`)
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        return res.json() as Promise<ExamenDetail>;
      })
      .then((data) => {
        if (data) setExamen(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <section
        className="section"
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <i
          className="fas fa-spinner fa-spin"
          style={{ fontSize: '2.5rem', color: 'var(--primary-blue)' }}
        />
      </section>
    );
  }

  if (notFound || !examen) {
    return (
      <section
        className="section"
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <i className="fas fa-vial" style={{ fontSize: '3rem', color: '#ccc' }} />
        <h2>Examen no encontrado</h2>
        <Link href="/servicios" style={{ color: 'var(--primary-blue)' }}>
          Volver al catálogo
        </Link>
      </section>
    );
  }

  const whatsappMsg = encodeURIComponent(`Hola, quiero agendar el examen: ${examen.nombre}`);
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`;
  const badgeColor = CATEGORIA_COLORS[examen.categoria] ?? '#6c757d';

  return (
    <section
      className="section"
      style={{ background: 'linear-gradient(to bottom, #f8f9fa, #ffffff)', minHeight: '80vh' }}
    >
      <div className="container" style={{ maxWidth: '800px' }}>
        {/* Breadcrumb */}
        <nav style={{ marginBottom: '1.5rem', fontSize: '0.85rem', color: '#888' }}>
          <Link href="/" style={{ color: '#888' }}>
            Inicio
          </Link>
          {' › '}
          <Link href="/servicios" style={{ color: '#888' }}>
            Servicios
          </Link>
          {' › '}
          <span style={{ color: '#333' }}>{examen.nombre}</span>
        </nav>

        {/* Nombre */}
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{examen.nombre}</h1>

        {/* Badges */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              padding: '4px 14px',
              borderRadius: '14px',
              background: badgeColor,
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            {examen.categoria}
          </span>
          <span
            style={{
              padding: '4px 14px',
              borderRadius: '14px',
              background: '#f0f4ff',
              color: '#555',
              fontSize: '0.8rem',
            }}
          >
            Código: {examen.codigo}
          </span>
        </div>

        {/* Precio */}
        <p
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: 'var(--primary-blue)',
            marginBottom: '1.5rem',
          }}
        >
          ${examen.precio.toLocaleString('es-CO')} COP
        </p>

        {/* Descripción */}
        {examen.descripcion && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              ¿Qué mide este examen?
            </h3>
            <p style={{ color: '#444', lineHeight: '1.7' }}>{examen.descripcion}</p>
          </div>
        )}

        {/* Síntomas */}
        {examen.sintomas.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              Síntomas relacionados
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {examen.sintomas.map((s) => (
                <span
                  key={s}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '20px',
                    background: '#f0f4ff',
                    color: '#444',
                    fontSize: '0.85rem',
                    border: '1px solid #dce4ff',
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Preparación */}
        {(examen.requiere_ayuno || examen.preparacion) && (
          <div
            style={{
              marginBottom: '2rem',
              padding: '16px 20px',
              background: '#fff8e1',
              borderRadius: '10px',
              border: '1px solid #ffe082',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              <i className="fas fa-clock" style={{ marginRight: '8px', color: '#f59e0b' }} />
              Preparación
            </h3>
            {examen.requiere_ayuno && (
              <p style={{ margin: '0 0 4px 0', color: '#92400e' }}>
                <strong>Este examen requiere ayuno.</strong>
              </p>
            )}
            {examen.preparacion && (
              <p style={{ margin: 0, color: '#555' }}>{examen.preparacion}</p>
            )}
          </div>
        )}

        {/* CTA WhatsApp */}
        <Link
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 28px',
            borderRadius: '30px',
            background: '#25d366',
            color: '#fff',
            fontWeight: 600,
            fontSize: '1rem',
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(37,211,102,0.35)',
            transition: 'opacity 0.2s',
          }}
        >
          <i className="fab fa-whatsapp" style={{ fontSize: '1.2rem' }} />
          Agendar por WhatsApp
        </Link>
      </div>
    </section>
  );
}
