import Link from 'next/link';

export const metadata = {
    title: 'Agenda tu toma de muestra a domicilio - Laboratorio Clínico BIOANALISIS',
    description: 'Agenda tu toma de muestra a domicilio para toma de muestra a domicilio sin costo adicional. Atención de lunes a sábado.'
};

export default function AgendaTuCita() {
    return (
        <section className="section" style={{ background: 'linear-gradient(to bottom, #f8f9fa, #ffffff)', minHeight: '80vh' }}>
            <div className="container">
                {/* Section Header */}
                <div className="text-center mb-5">
                    <h1 className="section-title" style={{ fontSize: '2.5rem' }}>
                        Agenda tu toma de muestra a domicilio
                    </h1>
                    <p className="section-subtitle" style={{ fontSize: '1.1rem', maxWidth: '700px', margin: '0 auto' }}>
                        Las tomas de muestra a domicilio son una opción rápida y cómoda para ti.
                        Esta no tiene ningún costo adicional y tenemos horarios de atención de lunes a sábado de 7:00 a.m. a
                        9:00 a.m.
                    </p>
                </div>

                {/* Appointment Card */}
                <div className="appointment-card">
                    <h3>Completa el formulario</h3>
                    <p className="subtitle">
                        Nos pondremos en contacto contigo a la brevedad para confirmar los detalles de tu toma de muestra a domicilio.
                    </p>

                    {/* Call to Action */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <Link
                            href="/agendar-muestra"
                            className="btn-primary btn-lg"
                            aria-label="Agendar toma de muestra a domicilio"
                        >
                            <i className="fas fa-calendar-check"></i>
                            Agenda tu toma de muestra aquí
                        </Link>

                        <span style={{ color: 'var(--text-gray)', fontSize: '1rem', fontWeight: '500' }}>o</span>

                        <Link
                            href="https://wa.me/573103661093?text=Hola,%20quiero%20agendar%20una%20toma%20de%20muestra%20a%20domicilio."
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-contacto"
                            aria-label="Escribir por WhatsApp"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                        >
                            <i className="fab fa-whatsapp"></i>
                            Escríbenos a nuestro WhatsApp
                        </Link>

                    </div>
                </div>
            </div>
        </section>
    );
}
