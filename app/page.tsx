import Link from 'next/link';
import FeatureCard from '@/components/FeatureCard';

export default function Home() {
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

  return (
    <>
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-background"></div>
        <div className="hero-gradient"></div>
        <div className="hero-content">
          <h1 className="hero-title">
            Precisión y Confianza en tus Resultados Clínicos
          </h1>
          <p className="hero-subtitle">
            Tu salud es nuestra prioridad en Quibdó, Chocó
          </p>
          <div className="hero-button-container">
            <Link
              href="https://wa.me/573103661093?text=Hola,%20me%20gustaría%20obtener%20información%20sobre%20sus%20servicios."
              target="_blank"
              rel="noopener noreferrer"
              className="hero-whatsapp-btn"
              aria-label="Contactar por WhatsApp"
            >
              <i className="fab fa-whatsapp"></i>
              Contactanos por WhatsApp
            </Link>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="section" style={{ backgroundColor: '#ffffff' }}>
        <div className="container">
          <div className="text-center mb-5">
            <h2 className="section-title">Comprometidos con la Salud del Chocó</h2>
          </div>

          <div style={{ maxWidth: '900px', margin: '0 auto', marginBottom: '3rem' }}>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-gray)', marginBottom: '20px' }}>
              En <strong>Laboratorio Clínico Bioanálisis</strong> entendemos que detrás de cada muestra hay una
              vida y una familia esperando respuestas. Por eso, nos dedicamos a ofrecer servicios de diagnóstico
              clínico caracterizados por la <strong>humanización, la ética y la excelencia científica</strong>.
            </p>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-gray)', marginBottom: '20px' }}>
              Nuestro compromiso con la comunidad de Quibdó va más allá de entregar resultados. Buscamos ser un
              aliado fundamental en el cuidado de la salud, con un equipo de profesionales apasionados y
              tecnología de vanguardia que garantizan <strong>máxima precisión y confiabilidad</strong> en todos
              nuestros procesos.
            </p>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-gray)' }}>
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
        </div>
      </section>
    </>
  );
}
