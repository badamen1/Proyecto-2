import ServiceCard from '@/components/ServiceCard';

export const metadata = {
    title: 'Servicios - Laboratorio Clínico BIOANALISIS',
    description: 'Conoce nuestros servicios de análisis clínicos: hematología, microbiología, uroanálisis, química sanguínea y pruebas especializadas.'
};

export default function Servicios() {
    const services = [
        {
            icon: 'fas fa-tint',
            title: 'Hematología',
            description: 'Análisis completo de sangre, conteo de células y estudios de coagulación'
        },
        {
            icon: 'fas fa-microscope',
            title: 'Microbiología',
            description: 'Cultivos, antibiogramas y diagnóstico de infecciones bacterianas'
        },
        {
            icon: 'fas fa-flask',
            title: 'Uroanálisis',
            description: 'Examen físico, químico y microscópico de la orina'
        },
        {
            icon: 'fas fa-heartbeat',
            title: 'Química Sanguínea',
            description: 'Perfil lipídico, glucosa, función renal y hepática'
        },
        {
            icon: 'fas fa-star',
            title: 'Pruebas Especializadas',
            description: 'Hormonas, marcadores tumorales y estudios inmunológicos'
        }
    ];

    return (
        <section className="section" style={{ background: 'linear-gradient(to bottom, #f8f9fa, #ffffff)', minHeight: '80vh' }}>
            <div className="container">
                {/* Section Header */}
                <div className="text-center mb-5">
                    <h1 className="section-title" style={{ fontSize: '2.5rem' }}>
                        Nuestros Servicios
                    </h1>
                    <p className="section-subtitle" style={{ fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
                        Ofrecemos una amplia gama de análisis clínicos con la más alta precisión y rapidez
                    </p>
                </div>

                {/* Service Cards Grid */}
                <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                    {services.map((service, index) => (
                        <ServiceCard
                            key={index}
                            icon={service.icon}
                            title={service.title}
                            description={service.description}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
