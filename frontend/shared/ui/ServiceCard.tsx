interface ServiceCardProps {
    icon: string;
    title: string;
    description: string;
}

export default function ServiceCard({ icon, title, description }: ServiceCardProps) {
    return (
        <div className="service-card">
            <div className="service-icon">
                <i className={icon}></i>
            </div>
            <h4>{title}</h4>
            <p>{description}</p>
        </div>
    );
}
