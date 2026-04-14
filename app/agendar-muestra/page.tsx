'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function AgendarMuestra() {
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Here we would normally send to Django API
        // For now, we simulate a success response
        setIsSubmitted(true);
    };

    if (isSubmitted) {
        return (
            <section className="section" style={{ background: 'linear-gradient(to bottom, #f8f9fa, #ffffff)', minHeight: '90vh', display: 'flex', alignItems: 'center' }}>
                <div className="container" style={{ maxWidth: '600px' }}>
                    <div className="appointment-card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                        <i className="fas fa-check-circle" style={{ fontSize: '4rem', color: '#28a745', marginBottom: '1.5rem' }}></i>
                        <h2 style={{ color: 'var(--primary-blue)', marginBottom: '1rem' }}>¡Solicitud Recibida!</h2>
                        <p style={{ color: 'var(--text-gray)', fontSize: '1.1rem', marginBottom: '2rem' }}>
                            Hemos registrado tu solicitud para toma de muestra a domicilio. Nuestro equipo de atención se pondrá en contacto contigo pronto para confirmar los detalles.
                        </p>
                        <Link href="/" className="btn-primary" style={{ display: 'inline-flex', padding: '12px 24px', borderRadius: '8px' }}>
                            Volver al Inicio
                        </Link>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="section" style={{ background: 'linear-gradient(to bottom, #f8f9fa, #ffffff)', minHeight: '90vh' }}>
            <div className="container">
                {/* Header */}
                <div className="text-center mb-5">
                    <h1 className="section-title" style={{ fontSize: '2.5rem' }}>
                        Agenda tu Toma de Muestra a Domicilio
                    </h1>
                    <p className="section-subtitle" style={{ fontSize: '1.1rem', maxWidth: '700px', margin: '0 auto' }}>
                        Completa el formulario para solicitar la visita de nuestro personal. Sin costo adicional en Quibdó.
                    </p>
                </div>

                {/* Form Card */}
                <div className="appointment-card" style={{ maxWidth: '800px', textAlign: 'left', padding: '2.5rem' }}>
                    
                    <div style={{ marginBottom: '2rem', padding: '1rem', background: '#e8f4fd', borderRadius: '8px', borderLeft: '4px solid var(--primary-blue)' }}>
                        <h4 style={{ color: 'var(--primary-blue)', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
                            <i className="fas fa-clock" style={{ marginRight: '8px' }}></i>
                            Horarios de Atención a Domicilio
                        </h4>
                        <p style={{ color: 'var(--text-gray)', margin: 0, fontSize: '0.95rem' }}>
                            Atendemos de Lunes a Sábado de 7:00 a.m. a 9:00 a.m.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <h3 style={{ fontSize: '1.2rem', color: 'var(--primary-blue)', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Datos del Paciente</h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Nombre Completo *</label>
                                <input type="text" required style={inputStyle} placeholder="Nombre del paciente" />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Tipo y N° Documento *</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <select style={selectStyle}>
                                        <option value="CC">CC</option>
                                        <option value="TI">TI</option>
                                        <option value="CE">CE</option>
                                    </select>
                                    <input type="text" required style={inputStyle} placeholder="Número" />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Celular de Contacto *</label>
                                <input type="tel" required style={inputStyle} placeholder="300 000 0000" />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Correo Electrónico (Opcional)</label>
                                <input type="email" style={inputStyle} placeholder="tu@correo.com" />
                            </div>
                        </div>

                        <h3 style={{ fontSize: '1.2rem', color: 'var(--primary-blue)', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Datos de la Muestra</h3>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Fecha Preferida *</label>
                                <input type="date" required style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Comprobante u Orden (Opcional)</label>
                                <input type="file" style={{...inputStyle, padding: '9px 15px'}} />
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Dirección Completa *</label>
                            <input type="text" required style={inputStyle} placeholder="Barrio, Calle, Número de Casa, Referencias" />
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Exámenes Solicitados u Observaciones *</label>
                            <textarea 
                                required 
                                rows={4} 
                                style={{...inputStyle, resize: 'vertical'}} 
                                placeholder="Ej: Perfil lipídico y cuadro hemático. O notas importantes sobre la dirección."
                            ></textarea>
                        </div>

                        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                            <button type="submit" className="btn-primary btn-lg" style={{ width: '100%', maxWidth: '400px', padding: '15px' }}>
                                <i className="fas fa-calendar-check" style={{ marginRight: '10px' }}></i> Enviar Solicitud
                            </button>
                        </div>
                    </form>
                </div>

                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <Link href="/agenda-tu-cita" style={{ color: 'var(--primary-blue)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fas fa-arrow-left"></i> Volver a Opciones
                    </Link>
                </div>
            </div>
        </section>
    );
}

const inputStyle = {
    width: '100%',
    padding: '12px 15px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.3s',
    fontFamily: 'inherit'
};

const selectStyle = {
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '1rem',
    outline: 'none',
    background: '#fff',
    fontFamily: 'inherit'
};
