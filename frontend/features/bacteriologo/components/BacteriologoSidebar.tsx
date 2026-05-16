'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/dashboard/bacteriologo', label: 'Panel de Trabajo', icon: 'fa-chart-line', exact: true },
  { href: '/dashboard/bacteriologo/ingresar', label: 'Ingresar Resultado', icon: 'fa-vials', exact: false },
  { href: '/dashboard/bacteriologo/validar', label: 'Validar Exámenes', icon: 'fa-check-double', exact: false },
  { href: '/dashboard/bacteriologo/buscar', label: 'Buscar Paciente', icon: 'fa-search', exact: false },
];

export function BacteriologoSidebar() {
  const pathname = usePathname();

  return (
    <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', alignSelf: 'start' }}>
      <h3 style={{ fontSize: '1rem', color: 'var(--text-gray)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>
        Menú Bacteriólogo
      </h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {links.map(({ href, label, icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 15px',
                  color: isActive ? '#fff' : '#555',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontWeight: '500' as const,
                  background: isActive ? 'var(--primary-blue)' : 'transparent',
                  boxShadow: isActive ? '0 4px 6px rgba(45, 83, 162, 0.2)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                <i className={`fas ${icon}`} style={{ width: '25px' }} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
