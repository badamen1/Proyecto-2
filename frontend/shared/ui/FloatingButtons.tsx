import Link from 'next/link';

export default function FloatingButtons() {
    return (
        <>
            {/* WhatsApp Floating Button */}
            <Link
                href="https://wa.me/573103661093"
                target="_blank"
                className="floating-btn whatsapp-btn"
                title="Contactar por WhatsApp"
                aria-label="Contactar por WhatsApp"
            >
                <i className="fab fa-whatsapp"></i>
            </Link>

            {/* Instagram Floating Button */}
            <Link
                href="https://www.instagram.com/bioanalisislab_?igsh=YjM0cmUxaG1zYzk2"
                target="_blank"
                rel="noopener"
                className="floating-btn instagram-btn"
                title="Instagram"
                aria-label="Instagram"
            >
                <i className="fab fa-instagram"></i>
            </Link>
        </>
    );
}
