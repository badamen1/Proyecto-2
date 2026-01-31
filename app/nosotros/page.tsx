import FeatureCard from '@/components/FeatureCard';

export const metadata = {
    title: 'Nosotros - Laboratorio Clínico BIOANALISIS',
    description: 'Conoce más sobre Laboratorio Clínico Bioanálisis, comprometidos con la salud del Chocó.'
};

export default function Nosotros() {
    const features = [
        {
            icon: 'fas fa-shield-alt',
            title: 'Excelencia Certificada',
            description: 'Cumplimos rigurosamente con estándares de calidad nacionales'
        },
        {
            icon: 'fas fa-users',
            title: 'Talento Humano',
            description: 'Profesionales expertos dedicados a su bienestar'
        },
        {
            icon: 'fas fa-microscope',
            title: 'Tecnología Avanzada',
            description: 'Equipos de última generación para diagnósticos precisos'
        },
        {
            icon: 'fas fa-bullseye',
            title: 'Resultados Confiables',
            description: 'Seguridad y precisión en cada prueba realizada'
        }
    ];

    const values = [
        {
            icon: 'fas fa-hand-holding-heart',
            title: 'Humanización',
            description: 'Tratamos a cada paciente con dignidad, respeto y calidez humana'
        },
        {
            icon: 'fas fa-balance-scale',
            title: 'Ética',
            description: 'Actuamos con integridad y transparencia en todos nuestros procesos'
        },
        {
            icon: 'fas fa-award',
            title: 'Excelencia',
            description: 'Buscamos la perfección en cada análisis y servicio que ofrecemos'
        }
    ];

    return (
        <>
            {/* Hero Section con imagen de fondo */}
            <section className="hero-section">
                <div className="hero-nosotros"></div>
                <div className="hero-gradient"></div>
                <div className="hero-content">
                    <h1 className="hero-title">
                        Comprometidos con la Salud del Chocó
                    </h1>
                    <p className="hero-subtitle">
                        En Laboratorio Clínico Bioanálisis entendemos que detrás de cada muestra
                        hay una vida y una familia esperando respuestas.
                    </p>
                </div>
            </section>

            {/* About Content Section */}
            <section className="section" style={{ backgroundColor: '#ffffff' }}>
                <div className="container">
                    <div style={{ maxWidth: '900px', margin: '0 auto', marginBottom: '3rem' }}>
                        <p style={{ fontSize: '1.1rem', color: 'var(--text-gray)', marginBottom: '20px', textAlign: 'justify' }}>
                            Nos dedicamos a ofrecer servicios de diagnóstico clínico caracterizados por la
                            <strong> humanización, la ética y la excelencia científica</strong>.
                        </p>
                        <p style={{ fontSize: '1.1rem', color: 'var(--text-gray)', marginBottom: '20px', textAlign: 'justify' }}>
                            Nuestro compromiso con la comunidad de Quibdó va más allá de entregar resultados. Buscamos ser un
                            aliado fundamental en el cuidado de la salud, con un equipo de profesionales apasionados y
                            tecnología de vanguardia que garantizan <strong>máxima precisión y confiabilidad</strong> en todos
                            nuestros procesos.
                        </p>
                        <p style={{ fontSize: '1.1rem', color: 'var(--text-gray)', textAlign: 'justify' }}>
                            Trabajamos incansablemente para brindar una atención cálida y oportuna, asegurando que cada paciente
                            reciba un trato digno y profesional. La confianza de nuestros pacientes es nuestra mayor motivación
                            para seguir mejorando día a día.
                        </p>
                    </div>

                    {/* Feature Cards Grid */}
                    <div className="cards-grid">
                        {features.map((feature, index) => (
                            <FeatureCard
                                key={index}
                                icon={feature.icon}
                                title={feature.title}
                                description={feature.description}
                            />
                        ))}
                    </div>

                    {/* Mission Section */}
                    <div className="mt-5">
                        <div className="mission-card">
                            <div className="icon">
                                <i className="fas fa-heart"></i>
                            </div>
                            <div>
                                <h3>Nuestra Misión</h3>
                                <p>
                                    Proporcionar servicios de análisis clínicos de la más alta calidad, con un enfoque
                                    humanizado y ético, contribuyendo al bienestar y cuidado de la salud de la comunidad
                                    de Quibdó y la región del Chocó. Nos comprometemos a utilizar tecnología de
                                    vanguardia y contar con un equipo altamente calificado para garantizar resultados
                                    precisos, confiables y oportunos.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Values Section */}
                    <div className="mt-5">
                        <h2 className="section-title text-center mb-4">Nuestros Valores</h2>
                        <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                            {values.map((value, index) => (
                                <div key={index} className="value-card">
                                    <div className="icon">
                                        <i className={value.icon}></i>
                                    </div>
                                    <h4>{value.title}</h4>
                                    <p>{value.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
