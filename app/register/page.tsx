'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type FieldErrors = Partial<Record<string, string[]>>;

export default function Register() {
    const router = useRouter();
    const [nombre, setNombre] = useState('');
    const [tipoDoc, setTipoDoc] = useState('CC');
    const [documento, setDocumento] = useState('');
    const [email, setEmail] = useState('');
    const [telefono, setTelefono] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setFieldErrors({});
        setLoading(true);

        try {
            const body: Record<string, string> = {
                nombre_completo: nombre,
                tipo_documento: tipoDoc,
                documento,
            };
            if (email) body.email = email;
            if (telefono) body.telefono = telefono;

            const res = await fetch(`${API_URL}/api/auth/register/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (res.status === 201) {
                router.push('/login?registered=1');
                return;
            }

            const data = await res.json();
            if (typeof data === 'object' && data !== null) {
                const detail = (data as Record<string, unknown>).detail;
                if (typeof detail === 'string') {
                    setError(detail);
                } else {
                    setFieldErrors(data as FieldErrors);
                }
            } else {
                setError('Error al crear la cuenta.');
            }
        } catch {
            setError('Error de conexión. Asegúrate que el servidor está activo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="section" style={{ background: 'linear-gradient(to bottom, #f8f9fa, #ffffff)', minHeight: '90vh', display: 'flex', alignItems: 'center' }}>
            <div className="container" style={{ maxWidth: '600px' }}>
                <div className="appointment-card" style={{ padding: '3rem 2rem' }}>
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <div style={{ width: '60px', height: '60px', background: 'var(--primary-blue)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.5rem', margin: '0 auto 1rem auto' }}>
                            <i className="fas fa-user-plus"></i>
                        </div>
                        <h1 style={{ fontSize: '1.8rem', color: 'var(--primary-blue)', marginBottom: '0.5rem' }}>Crea tu Cuenta</h1>
                        <p style={{ color: 'var(--text-gray)' }}>Únete a Bioanálisis para gestionar tu salud clínica</p>
                    </div>

                    {error && (
                        <div style={{ background: '#ffebee', color: '#c62828', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontSize: '0.9rem', textAlign: 'center' }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{ textAlign: 'left', gridColumn: '1 / span 2' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Nombre Completo *</label>
                                <input
                                    type="text"
                                    value={nombre}
                                    onChange={(e) => setNombre(e.target.value)}
                                    placeholder="Juan Pérez"
                                    required
                                    style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: fieldErrors.nombre_completo ? '1px solid #c62828' : '1px solid #ddd', fontSize: '1rem', outline: 'none' }}
                                />
                                {fieldErrors.nombre_completo && <small style={{ color: '#c62828' }}>{fieldErrors.nombre_completo[0]}</small>}
                            </div>

                            <div style={{ textAlign: 'left' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Tipo de Documento *</label>
                                <select
                                    value={tipoDoc}
                                    onChange={(e) => setTipoDoc(e.target.value)}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none', background: '#fff', fontSize: '1rem' }}
                                >
                                    <option value="CC">CC — Cédula de Ciudadanía</option>
                                    <option value="TI">TI — Tarjeta de Identidad</option>
                                    <option value="CE">CE — Cédula de Extranjería</option>
                                    <option value="PA">PA — Pasaporte</option>
                                </select>
                            </div>

                            <div style={{ textAlign: 'left' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Número de Documento *</label>
                                <input
                                    type="text"
                                    value={documento}
                                    onChange={(e) => setDocumento(e.target.value)}
                                    placeholder="123456789"
                                    required
                                    style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: fieldErrors.documento ? '1px solid #c62828' : '1px solid #ddd', fontSize: '1rem', outline: 'none' }}
                                />
                                {fieldErrors.documento && <small style={{ color: '#c62828' }}>{fieldErrors.documento[0]}</small>}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ textAlign: 'left' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Correo Electrónico <span style={{ color: '#888', fontWeight: 'normal' }}>(opcional)</span></label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="tu@correo.com"
                                    style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem', outline: 'none' }}
                                />
                            </div>
                            <div style={{ textAlign: 'left' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Teléfono Móvil <span style={{ color: '#888', fontWeight: 'normal' }}>(opcional)</span></label>
                                <input
                                    type="tel"
                                    value={telefono}
                                    onChange={(e) => setTelefono(e.target.value)}
                                    placeholder="300 000 0000"
                                    style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem', outline: 'none' }}
                                />
                            </div>
                        </div>

                        <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '1.5rem' }}>
                            Al registrarte confirmas que tus datos serán tratados con confidencialidad según nuestra política de privacidad.
                        </p>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full"
                            style={{ justifyContent: 'center', padding: '14px', fontSize: '1.1rem', borderRadius: '8px', opacity: loading ? 0.7 : 1 }}
                        >
                            {loading ? 'Creando cuenta...' : <><i className="fas fa-check-circle"></i> Crear Cuenta</>}
                        </button>
                    </form>

                    <div style={{ marginTop: '2rem', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
                        <p style={{ color: 'var(--text-gray)', marginBottom: '0.5rem' }}>¿Ya tienes una cuenta?</p>
                        <Link href="/login" style={{ color: 'var(--primary-blue)', fontWeight: '600' }}>
                            Inicia sesión aquí
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}
