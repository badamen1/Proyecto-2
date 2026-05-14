'use client';

import { useState } from 'react';
import ServiceCard from '@/shared/ui/ServiceCard';
import examenesData from '../data/examenes.json';

export default function Servicios() {
    const [searchTerm, setSearchTerm] = useState('');

    // Filtrar exámenes basados en el término de búsqueda
    const filteredExams = examenesData.filter(exam => 
        exam.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
        exam.codigo.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <section className="section" style={{ background: 'linear-gradient(to bottom, #f8f9fa, #ffffff)', minHeight: '80vh' }}>
            <div className="container">
                {/* Section Header */}
                <div className="text-center mb-5">
                    <h1 className="section-title" style={{ fontSize: '2.5rem' }}>
                        Catálogo de Exámenes
                    </h1>
                    <p className="section-subtitle" style={{ fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
                        Encuentra rápidamente el examen que necesitas. Escribe el nombre o código en el buscador.
                    </p>
                </div>

                {/* Search Bar */}
                <div style={{ maxWidth: '600px', margin: '0 auto 3rem auto', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '50%', left: '15px', transform: 'translateY(-50%)', color: 'var(--text-gray)' }}>
                        <i className="fas fa-search"></i>
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
                            transition: 'all 0.3s'
                        }}
                    />
                </div>

                {/* Results Count */}
                <p style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--text-gray)' }}>
                    Mostrando {filteredExams.length} {filteredExams.length === 1 ? 'examen' : 'exámenes'}
                </p>

                {/* Service Cards Grid - Using a more compact grid for the catalog */}
                {filteredExams.length > 0 ? (
                    <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                        {filteredExams.map((exam, index) => (
                            <ServiceCard
                                key={index}
                                icon="fas fa-vial" /* Generic icon for lab tests */
                                title={exam.nombre}
                                description={`Código: ${exam.codigo || 'N/A'}`}
                            />
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: '10px', border: '1px solid #eee' }}>
                        <i className="fas fa-search" style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }}></i>
                        <h3>No se encontraron resultados</h3>
                        <p style={{ color: 'var(--text-gray)' }}>Intenta con otros términos de búsqueda.</p>
                    </div>
                )}
            </div>
        </section>
    );
}
