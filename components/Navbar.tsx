'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Navbar() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isHidden, setIsHidden] = useState(false);
    const [lastScrollTop, setLastScrollTop] = useState(0);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [portalHref, setPortalHref] = useState<'/login' | '/dashboard'>('/login');

    // Detectar sesión activa al montar el componente
    useEffect(() => {
        const token = localStorage.getItem('access_token');
        setPortalHref(token ? '/dashboard' : '/login');
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollThreshold = 100;

            // Add shadow when scrolled
            setIsScrolled(scrollTop > 50);

            // Show/hide navbar based on scroll direction
            if (scrollTop > scrollThreshold) {
                if (scrollTop > lastScrollTop) {
                    setIsHidden(true);
                } else {
                    setIsHidden(false);
                }
            } else {
                setIsHidden(false);
            }

            setLastScrollTop(scrollTop);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollTop]);

    return (
        <nav className={`navbar ${isScrolled ? 'scrolled' : ''} ${isHidden ? 'navbar-hidden' : ''}`}>
            <div className="navbar-container">
                <Link href="/" className="navbar-brand">
                    <Image
                        src="/images/logo.png"
                        alt="Laboratorio Clínico BIOANALISIS"
                        width={180}
                        height={45}
                        priority
                    />
                </Link>

                <button
                    className="navbar-toggle"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label="Toggle navigation"
                >
                    <span className="hamburger"></span>
                </button>

                <div className={`navbar-menu ${isMenuOpen ? 'open' : ''}`}>
                    <ul className="navbar-nav">
                        <li><Link href="/" className="nav-link" onClick={() => setIsMenuOpen(false)}>Inicio</Link></li>
                        <li><Link href="/nosotros" className="nav-link" onClick={() => setIsMenuOpen(false)}>Nosotros</Link></li>
                        <li><Link href="/servicios" className="nav-link" onClick={() => setIsMenuOpen(false)}>Servicios</Link></li>
                        <li><Link href="/agenda-tu-cita" className="nav-link" onClick={() => setIsMenuOpen(false)}>Agenda tu Cita</Link></li>
                        <li><Link href="/contacto" className="nav-link" onClick={() => setIsMenuOpen(false)}>Contacto</Link></li>
                        <li>
                            <Link
                                href={portalHref}
                                className="btn-contacto"
                                onClick={() => setIsMenuOpen(false)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                            >
                                <i className="fas fa-user-circle"></i> Mi Portal
                            </Link>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>
    );
}
