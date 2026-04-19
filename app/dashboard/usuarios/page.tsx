'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface UserData {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    documento: string;
    tipo_documento: string;
    telefono: string;
}

export default function UsuariosDashboard() {
    const router = useRouter();
    const [currentRole, setCurrentRole] = useState<string | null>(null);
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Formulario Nuevo Usuario
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        username: '', password: '', email: '', first_name: '', last_name: '',
        documento: '', tipo_documento: 'CC', telefono: '', role: 'bacteriologo'
    });
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        const role = localStorage.getItem('user_role');
        
        if (!token || role !== 'admin') {
            router.push('/dashboard');
            return;
        }
        
        setCurrentRole(role);
        fetchUsers(token);
    }, [router]);

    const fetchUsers = async (token: string) => {
        try {
            const res = await fetch(`${API_URL}/api/auth/users/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            } else {
                setError('Error al cargar usuarios. Token inválido o expirado.');
            }
        } catch(e) {
            setError('Error de conexión con el servidor (Backend).');
        }
        setLoading(false);
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true); setFormError('');
        const token = localStorage.getItem('access_token');
        
        try {
            const res = await fetch(`${API_URL}/api/auth/users/`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({
                    ...formData,
                    username: formData.documento // Por defecto el username es el documento
                })
            });
            
            const data = await res.json();
            
            if (res.ok) {
                setUsers([...users, data]);
                setShowForm(false);
                setFormData({ username: '', password: '', email: '', first_name: '', last_name: '', documento: '', tipo_documento: 'CC', telefono: '', role: 'bacteriologo' });
            } else {
                setFormError(data.detail || JSON.stringify(data));
            }
        } catch(err) {
            setFormError('Error de red al crear el usuario.');
        }
        setFormLoading(false);
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_role');
        router.push('/');
    };

    if (loading) return <div style={{ minHeight: '90vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Cargando portal...</div>;

    return (
        <section className="section" style={{ background: '#f4f6f9', minHeight: '90vh' }}>
            <div className="container">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem', background: '#fff', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', color: 'var(--primary-blue)', margin: 0 }}>Gst. Usuarios - BIOANALISIS</h1>
                        <p style={{ color: 'var(--text-gray)', margin: 0, fontSize: '0.9rem', textTransform: 'capitalize' }}>Rol Activo: {currentRole}</p>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Link href="/dashboard" style={{ padding: '8px 15px', background: 'var(--primary-blue)', color: '#fff', textDecoration: 'none', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                            <i className="fas fa-arrow-left"></i> Volver al Portal
                        </Link>
                        <button onClick={handleLogout} style={{ padding: '8px 15px', background: '#f1f1f1', color: '#555', border: 'none', borderRadius: '20px', fontSize: '0.9rem', marginLeft: '10px', cursor: 'pointer' }}>
                            <i className="fas fa-sign-out-alt"></i> Salir
                        </button>
                    </div>
                </div>

                {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>{error}</div>}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ color: 'var(--primary-blue)' }}>Listado de Personal y Usuarios</h2>
                    <button 
                        onClick={() => setShowForm(!showForm)} 
                        style={{ padding: '10px 20px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        {showForm ? 'Cancelar' : '+ Agregar Nuevo Registro'}
                    </button>
                </div>

                {/* Formulario Creacion */}
                {showForm && (
                    <div style={{ background: '#fff', padding: '2rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
                        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>Detalles del Nuevo Usuario</h3>
                        
                        {formError && <div style={{ background: '#ffebee', color: '#c62828', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>{formError}</div>}
                        
                        <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Nombres</label>
                                <input type="text" required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Apellidos</label>
                                <input type="text" required value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Tipo Documento</label>
                                <select value={formData.tipo_documento} onChange={e => setFormData({...formData, tipo_documento: e.target.value})} style={inputStyle}>
                                    <option value="CC">Cédula Ciudadanía (CC)</option>
                                    <option value="TI">Tarjeta Identidad (TI)</option>
                                    <option value="CE">Extranjería (CE)</option>
                                    <option value="PA">Pasaporte (PA)</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Número de Documento</label>
                                <input type="text" required value={formData.documento} onChange={e => setFormData({...formData, documento: e.target.value})} style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Correo Electrónico (Opcional)</label>
                                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Teléfono (Opcional)</label>
                                <input type="text" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Rol en el Sistema</label>
                                <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} style={inputStyle}>
                                    <option value="admin">Administrador Central</option>
                                    <option value="bacteriologo">Bacteriólogo / Médico</option>
                                    <option value="paciente">Paciente Regular</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Contraseña Temporal</label>
                                <input type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} style={inputStyle} placeholder="Ocho caracteres mínimo" />
                            </div>
                            <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                                <button type="submit" disabled={formLoading} className="btn-primary" style={{ padding: '12px 30px', borderRadius: '8px', fontSize: '1rem', background: 'var(--primary-blue)', color: 'white', border: 'none', cursor: 'pointer', width: '100%', opacity: formLoading ? 0.7 : 1 }}>
                                    {formLoading ? 'Guardando...' : 'Crear Usuario'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Tabla de Usuarios */}
                <div style={{ background: '#fff', borderRadius: '10px', padding: '1rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                                <th style={{ padding: '12px', color: '#555' }}>ID</th>
                                <th style={{ padding: '12px', color: '#555' }}>Usuario / Doc</th>
                                <th style={{ padding: '12px', color: '#555' }}>Nombre Completo</th>
                                <th style={{ padding: '12px', color: '#555' }}>Rol</th>
                                <th style={{ padding: '12px', color: '#555' }}>Teléfono</th>
                                <th style={{ padding: '12px', color: '#555' }}>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '12px', fontWeight: 'bold', color: '#888' }}>#{user.id}</td>
                                    <td style={{ padding: '12px' }}>{user.tipo_documento} {user.documento}</td>
                                    <td style={{ padding: '12px', fontWeight: '500' }}>{user.first_name} {user.last_name || '(Sin Nombre)'}</td>
                                    <td style={{ padding: '12px' }}>
                                        <span style={{ 
                                            background: user.role === 'admin' ? '#e8f4fd' : user.role === 'bacteriologo' ? '#eefcf1' : '#f8f9fa',
                                            color: user.role === 'admin' ? 'var(--primary-blue)' : user.role === 'bacteriologo' ? '#28a745' : '#666',
                                            padding: '4px 8px', borderRadius: '4px', textTransform: 'capitalize', fontSize: '0.85rem', fontWeight: 'bold'
                                        }}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px', fontSize: '0.9rem' }}>{user.telefono || '-'}</td>
                                    <td style={{ padding: '12px' }}><span style={{ color: '#28a745', fontSize: '0.85rem', fontWeight: 'bold' }}><i className="fas fa-check-circle"></i> Activo</span></td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>No hay usuarios para mostrar o ha ocurrido un error.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

            </div>
        </section>
    );
}

const inputStyle = {
    width: '100%',
    padding: '10px 15px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '0.95rem',
    outline: 'none',
    boxSizing: 'border-box' as const
};
