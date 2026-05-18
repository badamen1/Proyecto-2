'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { InventarioSidebar } from '@/features/inventario/components/InventarioSidebar';

export default function InventarioLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [role, setRole] = useState<'admin' | 'bacteriologo' | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem('access_token');
    const r = window.localStorage.getItem('user_role');
    if (!token) { router.push('/login'); return; }
    if (r !== 'admin' && r !== 'bacteriologo') { router.push('/dashboard'); return; }
    setRole(r as 'admin' | 'bacteriologo');
  }, [router]);

  const handleLogout = () => {
    window.localStorage.removeItem('access_token');
    window.localStorage.removeItem('refresh_token');
    window.localStorage.removeItem('user_role');
    router.push('/');
  };

  if (!role) return null;

  return (
    <section className="section" style={{ background: '#f4f6f9', minHeight: '90vh' }}>
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem', background: '#fff', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', color: 'var(--primary-blue)', margin: 0 }}>Inventario — BIOANALISIS</h1>
            <p style={{ color: 'var(--text-gray)', margin: 0, fontSize: '0.9rem', textTransform: 'capitalize' }}>Rol Activo: {role}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link href="/dashboard" style={{ padding: '8px 15px', color: 'var(--primary-blue)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500' }}>
              ← Dashboard
            </Link>
            <button onClick={handleLogout} style={{ padding: '8px 15px', background: '#f1f1f1', color: '#555', border: 'none', borderRadius: '20px', fontSize: '0.9rem', cursor: 'pointer' }}>
              <i className="fas fa-sign-out-alt" /> Salir
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '2rem' }}>
          <InventarioSidebar role={role} />
          <div>{children}</div>
        </div>
      </div>
    </section>
  );
}
