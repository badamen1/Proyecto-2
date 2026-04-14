import { render, screen } from "@testing-library/react";
import Contacto from "@/app/contacto/page";

describe("Página Contacto", () => {
  it("muestra dirección y enlaces de contacto", () => {
    render(<Contacto />);
    expect(screen.getByRole("heading", { name: /visítanos en quibdó/i })).toBeInTheDocument();
    expect(screen.getByText(/cra\. 5 #29-79/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /whatsapp business/i })).toHaveAttribute(
      "href",
      "https://wa.me/573103661093",
    );
  });

  it("incluye mapa embebido y acceso a Google Maps", () => {
    render(<Contacto />);
    expect(
      screen.getByTitle(/ubicación del laboratorio clínico bioanalisis/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ver ubicación en google maps/i })).toHaveAttribute(
      "href",
      expect.stringContaining("google.com/maps"),
    );
  });
});
