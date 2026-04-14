import Link from 'next/link';

export const metadata = {
    title: 'Registro - Laboratorio Clínico BIOANALISIS',
    description: 'Crea tu cuenta como paciente para acceder a tus resultados y agendar citas fácilmente.'
};

export default function Register() {
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

                    <form>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{ textAlign: 'left' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Nombre Completo</label>
                                <input 
                                    type="text" 
                                    placeholder="Juan Pérez" 
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 15px',
                                        borderRadius: '8px',
                                        border: '1px solid #ddd',
                                        fontSize: '1rem',
                                        outline: 'none',
                                        transition: 'border-color 0.3s'
                                    }}
                                />
                            </div>
                            <div style={{ textAlign: 'left' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Tipo y N° Documento</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <select style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none', background: '#fff' }}>
                                        <option value="CC">CC</option>
                                        <option value="TI">TI</option>
                                        <option value="CE">CE</option>
                                        <option value="P">Pass</option>
                                    </select>
                                    <input 
                                        type="text" 
                                        placeholder="123456789" 
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '12px 15px',
                                            borderRadius: '8px',
                                            border: '1px solid #ddd',
                                            fontSize: '1rem',
                                            outline: 'none',
                                            transition: 'border-color 0.3s'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{ textAlign: 'left' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Correo Electrónico</label>
                                <input 
                                    type="email" 
                                    placeholder="tu@correo.com" 
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 15px',
                                        borderRadius: '8px',
                                        border: '1px solid #ddd',
                                        fontSize: '1rem',
                                        outline: 'none',
                                        transition: 'border-color 0.3s'
                                    }}
                                />
                            </div>
                            <div style={{ textAlign: 'left' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Teléfono Móvil</label>
                                <input 
                                    type="tel" 
                                    placeholder="300 000 0000" 
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 15px',
                                        borderRadius: '8px',
                                        border: '1px solid #ddd',
                                        fontSize: '1rem',
                                        outline: 'none',
                                        transition: 'border-color 0.3s'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Contraseña</label>
                            <input 
                                type="password" 
                                placeholder="Crea una contraseña segura" 
                                required
                                style={{
                                    width: '100%',
                                    padding: '12px 15px',
                                    borderRadius: '8px',
                                    border: '1px solid #ddd',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    transition: 'border-color 0.3s'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '2rem', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <input type="checkbox" id="terms" required style={{ marginTop: '5px' }} />
                            <label htmlFor="terms" style={{ color: 'var(--text-gray)', fontSize: '0.9rem', lineHeight: '1.4' }}>
                                Acepto la <Link href="#" style={{ color: 'var(--primary-blue)' }}>Política de Tratamiento de Datos Personales</Link> y reconozco que mis datos médicos serán manejados con confidencialidad.
                            </label>
                        </div>

                        <button 
                            type="submit" 
                            className="btn-primary w-full"
                            style={{ justifyContent: 'center', padding: '14px', fontSize: '1.1rem', borderRadius: '8px' }}
                        >
                            <i className="fas fa-check-circle"></i> Crear Cuenta
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
