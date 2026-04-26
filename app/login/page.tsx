'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loginType, setLoginType] = useState<'paciente' | 'personal'>('paciente');

    const [documento, setDocumento] = useState('');
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const [error, setError] = useState('');
    const [notRegistered, setNotRegistered] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (searchParams.get('registered') === '1') {
            setSuccessMsg('¡Cuenta creada exitosamente! Ingresa tu documento para iniciar sesión.');
        }
    }, [searchParams]);

    const handlePatientRequestOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setNotRegistered(false);
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/auth/otp/request/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documento }),
            });
            const data = await res.json();
            if (res.ok) {
                setOtpSent(true);
                setSuccessMsg('Código enviado. Revisa la consola del backend Django para obtener el OTP simulado.');
            } else if (res.status === 404) {
                setNotRegistered(true);
                setError(data.detail || 'No encontramos una cuenta con ese documento.');
            } else {
                setError(data.detail || 'Error al solicitar OTP');
            }
        } catch {
            setError('Error de conexión. Asegúrate que Django está corriendo en el puerto 8000.');
        }
        setLoading(false);
    };

    const handlePatientVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/auth/otp/verify/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documento, otp }),
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
        } catch {
            setError('Error de conexión con el servidor Backend');
        }
        setLoading(false);
    };

    const handleStaffLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/auth/login/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('access_token', data.access);
                localStorage.setItem('refresh_token', data.refresh);
                try {
                    const payload = JSON.parse(atob(data.access.split('.')[1]));
                    localStorage.setItem('user_role', payload.role || 'admin');
                } catch {
                    localStorage.setItem('user_role', 'admin');
                }
                router.push('/dashboard');
            } else {
                setError(data.detail || 'Credenciales incorrectas para Personal');
            }
        } catch {
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

                    <div style={{ display: 'flex', marginBottom: '1.5rem', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ddd' }}>
                        <button
                            type="button"
                            onClick={() => { setLoginType('paciente'); setError(''); setNotRegistered(false); setSuccessMsg(''); }}
                            style={{ flex: 1, padding: '10px', border: 'none', background: loginType === 'paciente' ? 'var(--primary-blue)' : '#f8f9fa', color: loginType === 'paciente' ? '#fff' : '#666', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            Paciente (OTP)
                        </button>
                        <button
                            type="button"
                            onClick={() => { setLoginType('personal'); setError(''); setNotRegistered(false); setSuccessMsg(''); }}
                            style={{ flex: 1, padding: '10px', border: 'none', background: loginType === 'personal' ? 'var(--primary-blue)' : '#f8f9fa', color: loginType === 'personal' ? '#fff' : '#666', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            Personal
                        </button>
                    </div>

                    {successMsg && (
                        <div style={{ background: '#d4edda', color: '#155724', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontSize: '0.9rem', textAlign: 'center' }}>
                            {successMsg}
                        </div>
                    )}

                    {error && (
                        <div style={{ background: '#ffebee', color: '#c62828', padding: '10px', borderRadius: '5px', marginBottom: '10px', fontSize: '0.9rem', textAlign: 'center' }}>
                            {error}
                            {notRegistered && (
                                <div style={{ marginTop: '8px' }}>
                                    <Link href="/register" style={{ color: '#c62828', fontWeight: 'bold', textDecoration: 'underline' }}>
                                        ¿No tienes cuenta? Regístrate aquí →
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}

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
                                <small style={{ color: '#888', marginTop: '5px', display: 'block' }}>
                                    Te enviaremos un código OTP para validar tu identidad.
                                </small>
                            </div>
                            <button type="submit" disabled={loading} className="btn-primary w-full" style={{ justifyContent: 'center', padding: '14px', fontSize: '1.1rem', borderRadius: '8px', opacity: loading ? 0.7 : 1 }}>
                                {loading ? 'Solicitando...' : 'Recibir Código OTP'}
                            </button>
                            <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-gray)' }}>
                                ¿Eres nuevo paciente?{' '}
                                <Link href="/register" style={{ color: 'var(--primary-blue)', fontWeight: '600' }}>
                                    Regístrate aquí
                                </Link>
                            </p>
                        </form>
                    )}

                    {loginType === 'paciente' && otpSent && (
                        <form onSubmit={handlePatientVerifyOTP}>
                            <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>Ingresa tu Código OTP</label>
                                <input
                                    type="text"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    placeholder="······"
                                    maxLength={6}
                                    required
                                    style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1.5rem', outline: 'none', textAlign: 'center', letterSpacing: '5px' }}
                                />
                                <small style={{ color: '#888', marginTop: '5px', display: 'block', textAlign: 'center' }}>
                                    Revisa la consola del backend para obtener el código simulado.
                                </small>
                            </div>
                            <button type="submit" disabled={loading} className="btn-primary w-full" style={{ justifyContent: 'center', padding: '14px', fontSize: '1.1rem', borderRadius: '8px', opacity: loading ? 0.7 : 1, background: '#28a745' }}>
                                {loading ? 'Verificando...' : 'Verificar y Entrar'}
                            </button>
                            <button type="button" onClick={() => { setOtpSent(false); setError(''); setSuccessMsg(''); }} style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', width: '100%', textAlign: 'center', marginTop: '15px', cursor: 'pointer', textDecoration: 'underline' }}>
                                Volver / Cambiar Documento
                            </button>
                        </form>
                    )}

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

export default function Login() {
    return (
        <Suspense fallback={<div style={{ minHeight: '90vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Cargando...</div>}>
            <LoginForm />
        </Suspense>
    );
}
