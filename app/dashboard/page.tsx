'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { PaginatedResponse, ResultadoLista } from '@/lib/types';

type Role = 'paciente' | 'bacteriologo' | 'admin' | null;

export default function Dashboard() {
    const router = useRouter();
    const [currentRole, setCurrentRole] = useState<Role>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [resultadosCount, setResultadosCount] = useState<number | null>(null);

    useEffect(() => {
        // Verificar autenticación
        const token = localStorage.getItem('access_token');
        const role = localStorage.getItem('user_role') as Role;

        if (!token || !role) {
            router.push('/login');
        } else {
            setCurrentRole(role);
            if (role === 'paciente') {
                apiFetch<PaginatedResponse<ResultadoLista>>('/api/resultados/')
                    .then((data) => setResultadosCount(data.count))
                    .catch(() => setResultadosCount(0));
            }
        }
        setIsLoading(false);
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_role');
        router.push('/');
    };

    if (isLoading || !currentRole) {
        return <div style={{ minHeight: '90vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Cargando portal...</div>;
    }

    return (
        <section className="section" style={{ background: '#f4f6f9', minHeight: '90vh' }}>
            <div className="container">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem', background: '#fff', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', color: 'var(--primary-blue)', margin: 0 }}>Mi Portal - BIOANALISIS</h1>
                        <p style={{ color: 'var(--text-gray)', margin: 0, fontSize: '0.9rem', textTransform: 'capitalize' }}>Rol Activo: {currentRole}</p>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button onClick={handleLogout} style={{ padding: '8px 15px', background: '#f1f1f1', color: '#555', border: 'none', borderRadius: '20px', fontSize: '0.9rem', marginLeft: '10px', cursor: 'pointer' }}>
                            <i className="fas fa-sign-out-alt"></i> Salir
                        </button>
                    </div>
                </div>

                {/* Dashboard Grid Content based on Role */}
                <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '2rem' }}>
                    
                    {/* Sidebar Navigation */}
                    <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', alignSelf: 'start' }}>
                        <h3 style={{ fontSize: '1rem', color: 'var(--text-gray)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>Menú Principal</h3>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            
                            {/* Paciente Menu */}
                            {currentRole === 'paciente' && (
                                <>
                                    <li><Link href="#" style={activeNavItemStyle}><i className="fas fa-home" style={{width: '25px'}}></i> Inicio</Link></li>
                                    <li><Link href="#" style={navItemStyle}><i className="fas fa-file-medical-alt" style={{width: '25px'}}></i> Mis Resultados</Link></li>
                                    <li><Link href="/agendar-muestra" style={navItemStyle}><i className="fas fa-calendar-alt" style={{width: '25px'}}></i> Agendar Domicilio</Link></li>
                                    <li><Link href="#" style={navItemStyle}><i className="fas fa-history" style={{width: '25px'}}></i> Historial Clínico</Link></li>
                                    <li><Link href="#" style={navItemStyle}><i className="fas fa-user-edit" style={{width: '25px'}}></i> Mi Perfil</Link></li>
                                </>
                            )}

                            {/* Bacteriólogo Menu */}
                            {currentRole === 'bacteriologo' && (
                                <>
                                    <li><Link href="#" style={activeNavItemStyle}><i className="fas fa-chart-line" style={{width: '25px'}}></i> Panel Trabajo</Link></li>
                                    <li><Link href="#" style={navItemStyle}><i className="fas fa-vials" style={{width: '25px'}}></i> Ingresar Resultados</Link></li>
                                    <li><Link href="#" style={navItemStyle}><i className="fas fa-check-double" style={{width: '25px'}}></i> Validar Exámenes</Link></li>
                                    <li><Link href="#" style={navItemStyle}><i className="fas fa-search" style={{width: '25px'}}></i> Buscar Paciente</Link></li>
                                </>
                            )}

                            {/* Admin Menu */}
                            {currentRole === 'admin' && (
                                <>
                                    <li><Link href="#" style={activeNavItemStyle}><i className="fas fa-tachometer-alt" style={{width: '25px'}}></i> Resumen Total</Link></li>
                                    <li><Link href="/dashboard/usuarios" style={navItemStyle}><i className="fas fa-users-cog" style={{width: '25px'}}></i> Gestión de Usuarios</Link></li>
                                    <li><Link href="#" style={navItemStyle}><i className="fas fa-box-open" style={{width: '25px'}}></i> Inventario</Link></li>
                                    <li><Link href="#" style={navItemStyle}><i className="fas fa-list" style={{width: '25px'}}></i> Catálogo de Tarifas</Link></li>
                                    <li><Link href="#" style={navItemStyle}><i className="fas fa-chart-pie" style={{width: '25px'}}></i> Reportes y Estadísticas</Link></li>
                                </>
                            )}
                        </ul>
                    </div>

                    {/* Main Content Area */}
                    <div>
                        {currentRole === 'paciente' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', textAlign: 'center' }}>
                                    <div style={{ width: '60px', height: '60px', background: '#e8f4fd', color: 'var(--primary-blue)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', margin: '0 auto 1rem auto' }}>
                                        <i className="fas fa-file-medical-alt"></i>
                                    </div>
                                    <h3 style={{ color: '#333', marginBottom: '0.5rem' }}>Resultados Recientes</h3>
                                    <p style={{ color: 'var(--text-gray)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                        {resultadosCount === null
                                            ? 'Cargando...'
                                            : resultadosCount === 0
                                            ? 'No tienes resultados aún.'
                                            : `Tienes ${resultadosCount} resultado${resultadosCount > 1 ? 's' : ''} disponible${resultadosCount > 1 ? 's' : ''}.`}
                                    </p>
                                    <Link href="/dashboard/resultados" className="btn-primary" style={{ padding: '10px 20px', borderRadius: '25px', fontSize: '0.9rem', textDecoration: 'none', display: 'inline-block' }}>Ver Resultados</Link>
                                </div>
                                <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', textAlign: 'center' }}>
                                    <div style={{ width: '60px', height: '60px', background: '#eefcf1', color: '#28a745', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', margin: '0 auto 1rem auto' }}>
                                        <i className="fas fa-calendar-alt"></i>
                                    </div>
                                    <h3 style={{ color: '#333', marginBottom: '0.5rem' }}>Próxima Cita</h3>
                                    <p style={{ color: 'var(--text-gray)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Toma de muestra a domicilio: 24 Mar, 08:00 AM</p>
                                    <Link href="/agendar-muestra" style={{ color: 'var(--primary-blue)', fontWeight: 'bold' }}>Modificar cita</Link>
                                </div>
                            </div>
                        )}

                        {currentRole === 'bacteriologo' && (
                            <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                                <h2 style={{ color: 'var(--primary-blue)', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>Muestras Pendientes por Procesar</h2>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                                            <th style={{ padding: '12px' }}>ID Orden</th>
                                            <th style={{ padding: '12px' }}>Paciente</th>
                                            <th style={{ padding: '12px' }}>Examen</th>
                                            <th style={{ padding: '12px' }}>Estado</th>
                                            <th style={{ padding: '12px' }}>Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '12px', fontWeight: 'bold' }}>#ORD-1092</td>
                                            <td style={{ padding: '12px' }}>María González</td>
                                            <td style={{ padding: '12px' }}>Perfil Lipídico</td>
                                            <td style={{ padding: '12px' }}><span style={{ background: '#fff3cd', color: '#856404', padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>Esperando Resultados</span></td>
                                            <td style={{ padding: '12px' }}><button style={{ background: 'var(--primary-blue)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Ingresar</button></td>
                                        </tr>
                                        <tr style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '12px', fontWeight: 'bold' }}>#ORD-1093</td>
                                            <td style={{ padding: '12px' }}>Carlos Ruiz</td>
                                            <td style={{ padding: '12px' }}>Cuadro Hemático</td>
                                            <td style={{ padding: '12px' }}><span style={{ background: '#d4edda', color: '#155724', padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>Para Validar</span></td>
                                            <td style={{ padding: '12px' }}><button style={{ background: '#28a745', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Validar</button></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {currentRole === 'admin' && (
                            <div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                                    <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{ width: '50px', height: '50px', background: '#e8f4fd', color: 'var(--primary-blue)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}><i className="fas fa-users"></i></div>
                                        <div>
                                            <h4 style={{ color: 'var(--text-gray)', margin: 0, fontSize: '0.9rem' }}>Pacientes Hoy</h4>
                                            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '5px 0 0 0', color: '#333' }}>45</p>
                                        </div>
                                    </div>
                                    <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{ width: '50px', height: '50px', background: '#fdf3e8', color: '#fd7e14', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}><i className="fas fa-flask"></i></div>
                                        <div>
                                            <h4 style={{ color: 'var(--text-gray)', margin: 0, fontSize: '0.9rem' }}>Exámenes Proc.</h4>
                                            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '5px 0 0 0', color: '#333' }}>128</p>
                                        </div>
                                    </div>
                                    <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{ width: '50px', height: '50px', background: '#eefcf1', color: '#28a745', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}><i className="fas fa-dollar-sign"></i></div>
                                        <div>
                                            <h4 style={{ color: 'var(--text-gray)', margin: 0, fontSize: '0.9rem' }}>Ingresos Mensuales</h4>
                                            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '5px 0 0 0', color: '#333' }}>$12.5M</p>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                                    <h2 style={{ color: '#333', marginBottom: '1rem', fontSize: '1.2rem' }}>Personal Activo</h2>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                        <li style={{ padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <div style={{ width: '40px', height: '40px', background: '#ddd', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fas fa-user text-white"></i></div>
                                                <div>
                                                    <p style={{ margin: 0, fontWeight: 'bold' }}>Dra. Ana López</p>
                                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-gray)' }}>Bacterióloga</p>
                                                </div>
                                            </div>
                                            <span style={{ color: '#28a745', fontSize: '0.85rem', fontWeight: 'bold' }}><i className="fas fa-circle" style={{ fontSize: '8px', marginRight: '5px' }}></i> En línea</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

const navItemStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 15px',
    color: '#555',
    textDecoration: 'none',
    borderRadius: '8px',
    transition: 'all 0.2s',
    fontWeight: '500' as const
};

const activeNavItemStyle = {
    ...navItemStyle,
    background: 'var(--primary-blue)',
    color: '#fff',
    boxShadow: '0 4px 6px rgba(45, 83, 162, 0.2)'
};
