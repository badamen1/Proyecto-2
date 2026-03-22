'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Login() {
    const router = useRouter();
    const [loginType, setLoginType] = useState<'paciente' | 'personal'>('paciente');
    
    // Estados para paciente (OTP)
    const [documento, setDocumento] = useState('');
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    
    // Estados para personal (Contraseña)
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handlePatientRequestOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            const res = await fetch('http://localhost:8000/api/auth/otp/request/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documento })
            });
            const data = await res.json();
            if (res.ok) {
                setOtpSent(true);
                alert("Simulación: Revisa la consola del backend de Django para ver el código OTP.");
            } else {
                setError(data.detail || 'Error al solicitar OTP');
            }
        } catch (err) {
            setError('Error de conexión con el servidor Backend (Asegúrate que Django está corriendo en el puerto 8000)');
        }
        setLoading(false);
    };

    const handlePatientVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            const res = await fetch('http://localhost:8000/api/auth/otp/verify/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documento, otp })
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('access_token', data.access);
                localStorage.setItem('refresh_token', data.refresh);
                localStorage.setItem('user_role', data.role);
                router.push('/dashboard');
            } else {
                setError(data.detail || 'Código OTP inválido');
            }
        } catch (err) {
            setError('Error de conexión con el servidor Backend');
        }
        setLoading(false);
    };

    const handleStaffLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            const res = await fetch('http://localhost:8000/api/auth/login/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('access_token', data.access);
                localStorage.setItem('refresh_token', data.refresh);
                
                // Decode SimpleJWT Payload safely
                try {
                    const tokenPayload = JSON.parse(atob(data.access.split('.')[1]));
                    localStorage.setItem('user_role', tokenPayload.role || 'admin');
                } catch(e) {
                    console.error("No se pudo decodificar el rol del JWT");
                    localStorage.setItem('user_role', 'admin');
                }
                
                router.push('/dashboard');
            } else {
                setError(data.detail || 'Credenciales incorrectas para Personal');
            }
        } catch (err) {
            setError('Error de conexión con el servidor Backend');
        }
        setLoading(false);
    };

    return (
        <section className="section" style={{ background: 'linear-gradient(to bottom, #f8f9fa, #ffffff)', minHeight: '90vh', display: 'flex', alignItems: 'center' }}>
            <div className="container" style={{ maxWidth: '450px' }}>
                <div className="appointment-card" style={{ padding: '3rem 2rem' }}>
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <div style={{ width: '60px', height: '60px', background: 'var(--primary-blue)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.5rem', margin: '0 auto 1rem auto' }}>
                            <i className="fas fa-user-lock"></i>
                        </div>
                        <h1 style={{ fontSize: '1.8rem', color: 'var(--primary-blue)', marginBottom: '0.5rem' }}>Iniciar Sesión</h1>
                        <p style={{ color: 'var(--text-gray)' }}>Selecciona tu tipo de perfil</p>
                    </div>

                    {/* Selector de Tipo de Login */}
                    <div style={{ display: 'flex', marginBottom: '1.5rem', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ddd' }}>
                        <button 
                            type="button"
                            onClick={() => { setLoginType('paciente'); setError(''); }}
                            style={{ flex: 1, padding: '10px', border: 'none', background: loginType === 'paciente' ? 'var(--primary-blue)' : '#f8f9fa', color: loginType === 'paciente' ? '#fff' : '#666', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s' }}
                        >
                            Paciente (OTP)
                        </button>
                        <button 
                            type="button"
                            onClick={() => { setLoginType('personal'); setError(''); }}
                            style={{ flex: 1, padding: '10px', border: 'none', background: loginType === 'personal' ? 'var(--primary-blue)' : '#f8f9fa', color: loginType === 'personal' ? '#fff' : '#666', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s' }}
                        >
                            Personal
                        </button>
                    </div>

                    {error && (
                        <div style={{ background: '#ffebee', color: '#c62828', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontSize: '0.9rem', textAlign: 'center' }}>
                            {error}
                        </div>
                    )}

                    {/* Flujo Paciente */}
                    {loginType === 'paciente' && !otpSent && (
                        <form onSubmit={handlePatientRequestOTP}>
                            <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Número de Documento</label>
                                <input 
                                    type="text" 
                                    value={documento}
                                    onChange={(e) => setDocumento(e.target.value)}
                                    placeholder="Ej. 1078458080" 
                                    required
                                    style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem', outline: 'none' }}
                                />
                                <small style={{ color: '#888', marginTop: '5px', display: 'block' }}>Enviaremos un código a tu celular registrado para validar tu identidad.</small>
                            </div>
                            <button type="submit" disabled={loading} className="btn-primary w-full" style={{ justifyContent: 'center', padding: '14px', fontSize: '1.1rem', borderRadius: '8px', opacity: loading ? 0.7 : 1 }}>
                                {loading ? 'Solicitando...' : 'Recibir Código OTP'}
                            </button>
                        </form>
                    )}

                    {loginType === 'paciente' && otpSent && (
                        <form onSubmit={handlePatientVerifyOTP}>
                            <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Ingresa tu Código (OTP)</label>
                                <input 
                                    type="text" 
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    placeholder="******" 
                                    maxLength={6}
                                    required
                                    style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1.5rem', outline: 'none', textAlign: 'center', letterSpacing: '5px' }}
                                />
                                <small style={{ color: '#888', marginTop: '5px', display: 'block', textAlign: 'center' }}>Revisa la consola del backend para obtener el número simulado.</small>
                            </div>
                            <button type="submit" disabled={loading} className="btn-primary w-full" style={{ justifyContent: 'center', padding: '14px', fontSize: '1.1rem', borderRadius: '8px', opacity: loading ? 0.7 : 1, background: '#28a745' }}>
                                {loading ? 'Verificando...' : 'Verificar y Entrar'}
                            </button>
                            <button type="button" onClick={() => setOtpSent(false)} style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', width: '100%', textAlign: 'center', marginTop: '15px', cursor: 'pointer', textDecoration: 'underline' }}>
                                Volver / Cambiar Documento
                            </button>
                        </form>
                    )}

                    {/* Flujo Personal */}
                    {loginType === 'personal' && (
                        <form onSubmit={handleStaffLogin}>
                            <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Usuario / Documento</label>
                                <input 
                                    type="text" 
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Tu usuario" 
                                    required
                                    style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem', outline: 'none' }}
                                />
                            </div>

                            <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Contraseña</label>
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••" 
                                    required
                                    style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem', outline: 'none' }}
                                />
                            </div>

                            <button type="submit" disabled={loading} className="btn-primary w-full" style={{ justifyContent: 'center', padding: '14px', fontSize: '1.1rem', borderRadius: '8px', opacity: loading ? 0.7 : 1 }}>
                                {loading ? 'Iniciando...' : 'Ingresar al Portal Interno'}
                            </button>
                        </form>
                    )}

                </div>
            </div>
        </section>
    );
}
