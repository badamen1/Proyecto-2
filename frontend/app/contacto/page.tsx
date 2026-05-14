import Link from 'next/link';

export const metadata = {
    title: 'Contacto - Laboratorio Clínico BIOANALISIS',
    description: 'Visítanos en Quibdó, Chocó. Encuentra nuestra ubicación, horarios y datos de contacto.'
};

export default function Contacto() {
    return (
        <section className="section" style={{ backgroundColor: '#ffffff' }}>
            <div className="container">
                {/* Section Header */}
                <div className="text-center mb-5">
                    <h1 className="section-title" style={{ fontSize: '2.5rem' }}>
                        Visítanos en Quibdó
                    </h1>
                    <p className="section-subtitle" style={{ fontSize: '1.1rem' }}>
                        Estamos ubicados en el corazón de Quibdó para servirte mejor
                    </p>
                </div>

                <div className="contact-grid">
                    {/* Left Column - Contact Information */}
                    <div>
                        {/* Address */}
                        <div className="contact-info-item">
                            <div className="contact-icon">
                                <i className="fas fa-map-marker-alt"></i>
                            </div>
                            <div className="contact-info">
                                <h5>Dirección</h5>
                                <p>
                                    Cra. 5 #29-79<br />
                                    Quibdó, Chocó<br />
                                    Colombia
                                </p>
                            </div>
                        </div>

                        {/* Business Hours */}
                        <div className="contact-info-item">
                            <div className="contact-icon">
                                <i className="fas fa-clock"></i>
                            </div>
                            <div className="contact-info">
                                <h5>Horarios de Atención</h5>
                                <div className="hours-item">
                                    <strong>Lunes a Viernes:</strong> 7:00 AM - 5:00 PM
                                </div>
                                <div className="hours-item">
                                    <strong>Sábados:</strong> 8:00 AM - 1:00 PM
                                </div>
                                <div className="hours-item closed">
                                    <strong>Domingos:</strong> Cerrado
                                </div>
                            </div>
                        </div>

                        {/* Contact Methods */}
                        <div className="contact-info-item">
                            <div className="contact-icon">
                                <i className="fas fa-phone"></i>
                            </div>
                            <div className="contact-info">
                                <h5>Contacto</h5>
                                <p style={{ marginBottom: '8px' }}>
                                    <i className="fas fa-phone" style={{ marginRight: '8px' }}></i> +57 310 3661093
                                </p>
                                <p style={{ marginBottom: '8px' }}>
                                    <i className="fab fa-whatsapp" style={{ marginRight: '8px' }}></i>
                                    <Link
                                        href="https://wa.me/573103661093"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: 'var(--text-gray)' }}
                                    >
                                        WhatsApp Business
                                    </Link>
                                </p>
                                <p style={{ margin: 0 }}>
                                    <i className="fas fa-envelope" style={{ marginRight: '8px' }}></i>
                                    <Link
                                        href="mailto:labclinicobioanalisis@hotmail.com"
                                        style={{ color: 'var(--text-gray)' }}
                                    >
                                        labclinicobioanalisis@hotmail.com
                                    </Link>
                                </p>
                            </div>
                        </div>

                        {/* Google Maps Button */}
                        <div className="mt-4">
                            <Link
                                href="https://www.google.com/maps/place/Laboratorio+Cl%C3%ADnico+Bioanalisis/@5.6903,-76.6608,15z"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-primary w-full"
                                aria-label="Ver ubicación en Google Maps"
                                style={{ display: 'block', textAlign: 'center' }}
                            >
                                <i className="fas fa-map-marked-alt" style={{ marginRight: '8px' }}></i>
                                Ver en Google Maps
                            </Link>
                        </div>
                    </div>

                    {/* Right Column - Google Maps Embed */}
                    <div className="map-container">
                        <iframe
                            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3966.5!2d-76.6608!3d5.6903!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e6a4b8b8b8b8b8b%3A0x8e6a4b8b8b8b8b8b!2sCarrera%205%20%2329-79%2C%20Quibd%C3%B3%2C%20Choc%C3%B3!5e0!3m2!1ses!2sco!4v1234567890123!5m2!1ses!2sco"
                            allowFullScreen
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            title="Ubicación del Laboratorio Clínico BIOANALISIS"
                        ></iframe>
                    </div>
                </div>
            </div>
        </section>
    );
}
