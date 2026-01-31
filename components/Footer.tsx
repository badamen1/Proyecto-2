'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
    const footerSectionsRef = useRef<NodeListOf<Element> | null>(null);

    useEffect(() => {
        const footerSections = document.querySelectorAll('.footer-section');
        footerSectionsRef.current = footerSections;

        if (footerSections.length > 0) {
            const observerOptions = {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            };

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animate');
                        observer.unobserve(entry.target);
                    }
                });
            }, observerOptions);

            footerSections.forEach(section => {
                observer.observe(section);
            });

            return () => {
                footerSections.forEach(section => {
                    observer.unobserve(section);
                });
            };
        }
    }, []);

    const currentYear = new Date().getFullYear();

    return (
        <footer>
            <div className="container">
                <div className="footer-grid">
                    {/* Logo & About */}
                    <div className="footer-section">
                        <Image
                            src="/images/Imagen de WhatsApp 2025-11-27 a las 15.32.42_69d146e1.jpg"
                            alt="Laboratorio Clínico BIOANALISIS"
                            width={250}
                            height={63}
                            className="footer-logo"
                        />
                        <p className="footer-about">
                            Comprometidos con la excelencia en análisis clínicos. Brindamos servicios de salud confiables y
                            precisos a la comunidad de Quibdó, utilizando tecnología de vanguardia y un equipo humano
                            altamente calificado.
                        </p>
                    </div>

                    {/* Contact Info */}
                    <div className="footer-section">
                        <h3>Contacto</h3>
                        <div>
                            <div className="footer-contact-item">
                                <i className="fas fa-phone"></i>
                                <span>+57 310 3661093</span>
                            </div>
                            <Link
                                href="https://wa.me/573103661093?text=Hola,%20me%20gustaría%20obtener%20información%20sobre%20sus%20servicios."
                                target="_blank"
                                className="footer-contact-item"
                            >
                                <i className="fab fa-whatsapp"></i>
                                <span>WhatsApp Business</span>
                            </Link>
                            <div className="footer-contact-item">
                                <i className="fas fa-envelope"></i>
                                <Link href="mailto:labclinicobioanalisis@hotmail.com">labclinicobioanalisis@hotmail.com</Link>
                            </div>
                            <div className="footer-contact-item">
                                <i className="fas fa-map-marker-alt"></i>
                                <span>Cra 5 #29-79, Quibdó, Chocó</span>
                            </div>
                        </div>
                    </div>

                    {/* Legal Links */}
                    <div className="footer-section">
                        <h3>Legal</h3>
                        <div>
                            <Link href="#privacy" className="footer-legal-link">Política de Privacidad</Link>
                            <Link href="#terms" className="footer-legal-link">Términos de Servicio</Link>
                            <Link href="#data" className="footer-legal-link">Protección de Datos</Link>
                        </div>
                    </div>
                </div>

                {/* Copyright */}
                <div className="footer-copyright footer-section">
                    <p>© {currentYear} Laboratorio Clínico Bioanálisis. Todos los derechos reservados.</p>
                </div>
            </div>
        </footer>
    );
}
