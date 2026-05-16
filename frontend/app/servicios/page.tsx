'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

const CATEGORIAS = [
  'Todas',
  'Coagulación',
  'Hematología',
  'Hormonas',
  'Infectología',
  'Inmunología',
  'Metabolismo',
  'Microbiología',
  'Oncología',
  'Otras',
  'Tiroides',
];

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

interface ExamenList {
  slug: string;
  nombre: string;
  codigo: string;
  categoria: string;
  precio: number;
  sintomas: string[];
}

export default function Servicios() {
  const [examenes, setExamenes] = useState<ExamenList[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState('Todas');

  useEffect(() => {
    fetch(`${API_BASE}/api/examenes/?page_size=200`)
      .then((res) => res.json())
      .then((data: { results?: ExamenList[] }) => setExamenes(data.results ?? []))
      .catch(() => setExamenes([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = examenes.filter((e) => {
    const matchSearch =
      e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.codigo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategoria = categoriaActiva === 'Todas' || e.categoria === categoriaActiva;
    return matchSearch && matchCategoria;
  });

  return (
    <section
      className="section"
      style={{ background: 'linear-gradient(to bottom, #f8f9fa, #ffffff)', minHeight: '80vh' }}
    >
      <div className="container">
        {/* Header */}
        <div className="text-center mb-5">
          <h1 className="section-title" style={{ fontSize: '2.5rem' }}>
            Catálogo de Exámenes
          </h1>
          <p
            className="section-subtitle"
            style={{ fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}
          >
            Encuentra rápidamente el examen que necesitas. Escribe el nombre o código en el
            buscador.
          </p>
        </div>

        {/* Search Bar */}
        <div style={{ maxWidth: '600px', margin: '0 auto 2rem auto', position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '15px',
              transform: 'translateY(-50%)',
              color: 'var(--text-gray)',
            }}
          >
            <i className="fas fa-search" />
          </div>
          <input
            type="text"
            placeholder="Buscar examen por nombre o código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '15px 20px 15px 45px',
              borderRadius: '30px',
              border: '1px solid #ddd',
              fontSize: '1.1rem',
              outline: 'none',
              boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
              transition: 'all 0.3s',
            }}
          />
        </div>

        {/* Category Filters */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            justifyContent: 'center',
            marginBottom: '2rem',
          }}
        >
          {CATEGORIAS.map((cat) => {
            const isActive = categoriaActiva === cat;
            const color = CATEGORIA_COLORS[cat] ?? 'var(--primary-blue)';
            return (
              <button
                key={cat}
                onClick={() => setCategoriaActiva(cat)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '20px',
                  border: `1px solid ${isActive ? color : '#ddd'}`,
                  background: isActive ? color : '#fff',
                  color: isActive ? '#fff' : '#555',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.2s',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Results Count */}
        <p style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--text-gray)' }}>
          {loading
            ? 'Cargando...'
            : `Mostrando ${filtered.length} ${filtered.length === 1 ? 'examen' : 'exámenes'}`}
        </p>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <i
              className="fas fa-spinner fa-spin"
              style={{ fontSize: '2rem', color: 'var(--primary-blue)' }}
            />
          </div>
        ) : filtered.length > 0 ? (
          <div
            className="cards-grid"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
          >
            {filtered.map((exam) => (
              <Link
                key={exam.slug}
                href={`/servicios/${exam.slug}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div
                  className="service-card"
                  style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.transform = 'translateY(-4px)';
                    el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.transform = 'translateY(0)';
                    el.style.boxShadow = '';
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: '12px',
                      background: CATEGORIA_COLORS[exam.categoria] ?? '#6c757d',
                      color: '#fff',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      marginBottom: '8px',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {exam.categoria}
                  </span>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem' }}>{exam.nombre}</h4>
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#888' }}>
                    Cód: {exam.codigo}
                  </p>
                  <p
                    style={{
                      margin: '0 0 10px 0',
                      fontWeight: 600,
                      color: 'var(--primary-blue)',
                    }}
                  >
                    ${exam.precio.toLocaleString('es-CO')} COP
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {exam.sintomas.slice(0, 3).map((s) => (
                      <span
                        key={s}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: '#f0f4ff',
                          color: '#555',
                          fontSize: '0.72rem',
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem',
              background: '#fff',
              borderRadius: '10px',
              border: '1px solid #eee',
            }}
          >
            <i
              className="fas fa-search"
              style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }}
            />
            <h3>No se encontraron resultados</h3>
            <p style={{ color: 'var(--text-gray)' }}>Intenta con otros términos de búsqueda.</p>
          </div>
        )}
      </div>
    </section>
  );
}
