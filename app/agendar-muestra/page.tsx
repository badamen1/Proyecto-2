import Link from 'next/link';

export const metadata = {
    title: 'Agendar Toma de Muestra - Laboratorio Clínico BIOANALISIS',
    description: 'Agenda tu toma de muestra a domicilio usando nuestro sistema de citas en línea.'
};

export default function AgendarMuestra() {
    return (
        <section className="section" style={{ background: 'linear-gradient(to bottom, #f8f9fa, #ffffff)', minHeight: '90vh' }}>
            <div className="container">
                {/* Header */}
                <div className="text-center mb-5">
                    <h1 className="section-title" style={{ fontSize: '2.5rem' }}>
                        Agenda tu Toma de Muestra a Domicilio
                    </h1>
                    <p className="section-subtitle" style={{ fontSize: '1.1rem', maxWidth: '700px', margin: '0 auto' }}>
                        Sigue las instrucciones para agendar tu cita de manera rápida y sencilla
                    </p>
                </div>

                {/* Instructions Card */}
                <div className="appointment-card" style={{ maxWidth: '800px', textAlign: 'left' }}>
                    <h3 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <i className="fas fa-info-circle" style={{ marginRight: '10px', color: 'var(--primary-blue)' }}></i>
                        Instrucciones Importantes
                    </h3>

                    {/* Horarios */}
                    <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', borderLeft: '4px solid var(--primary-blue)' }}>
                        <h4 style={{ color: 'var(--primary-blue)', marginBottom: '0.5rem' }}>
                            <i className="fas fa-clock" style={{ marginRight: '8px' }}></i>
                            Horarios de Atención
                        </h4>
                        <p style={{ color: 'var(--text-gray)', margin: 0 }}>
                            <strong>Lunes a Sábado:</strong> 7:00 a.m. a 9:00 a.m.<br />
                            Las tomas de muestra a domicilio <strong>no tienen ningún costo adicional</strong>.
                        </p>
                    </div>

                    {/* Cómo funciona */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h4 style={{ color: 'var(--primary-blue)', marginBottom: '1rem' }}>
                            <i className="fas fa-list-ol" style={{ marginRight: '8px' }}></i>
                            ¿Cómo funciona?
                        </h4>
                        <ol style={{ color: 'var(--text-gray)', paddingLeft: '1.5rem', lineHeight: '1.8' }}>
                            <li><strong>Selecciona la fecha y hora</strong> disponible que más te convenga.</li>
                            <li><strong>Completa tus datos personales</strong> (nombre, correo electrónico, teléfono).</li>
                            <li><strong>En la última casilla</strong> ("Por favor comparta cualquier cosa que pueda ayudar..."), escribe:
                                <ul style={{ marginTop: '0.5rem' }}>
                                    <li>Los <strong>exámenes que deseas realizarte</strong></li>
                                    <li>Tu <strong>dirección completa</strong> (barrio, calle, número de casa y referencias)</li>
                                </ul>
                            </li>
                            <li><strong>Confirma tu cita</strong> y recibirás un correo de confirmación.</li>
                        </ol>
                    </div>

                    {/* Dirección */}
                    <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#fff3cd', borderRadius: '8px', borderLeft: '4px solid #ffc107' }}>
                        <h4 style={{ color: '#856404', marginBottom: '0.5rem' }}>
                            <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px' }}></i>
                            ¡Importante sobre la dirección!
                        </h4>
                        <p style={{ color: '#856404', margin: 0 }}>
                            Por favor, asegúrate de escribir tu <strong>dirección completa y correcta</strong> incluyendo barrio,
                            nombre de la calle, número de casa y cualquier referencia que nos ayude a ubicarte fácilmente.
                        </p>
                    </div>

                    {/* Botón de agendar */}
                    <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                        <Link
                            href="https://calendly.com/impulsodgt7/30min"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-primary btn-lg"
                            style={{ fontSize: '1.1rem', padding: '1rem 2rem' }}
                        >
                            <i className="fas fa-calendar-check" style={{ marginRight: '10px' }}></i>
                            Agendar Mi Toma de Muestra
                        </Link>

                        <p style={{ marginTop: '1.5rem', color: 'var(--text-gray)', fontSize: '0.9rem' }}>
                            ¿Tienes dudas? <Link href="https://wa.me/573103661093" target="_blank" style={{ color: 'var(--primary-blue)' }}>
                                <i className="fab fa-whatsapp"></i> Escríbenos por WhatsApp
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Botón de regresar */}
                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <Link href="/agenda-tu-cita" style={{ color: 'var(--primary-blue)' }}>
                        <i className="fas fa-arrow-left" style={{ marginRight: '8px' }}></i>
                        Volver a la página anterior
                    </Link>
                </div>
            </div>
        </section>
    );
}
