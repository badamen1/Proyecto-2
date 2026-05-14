import { render, screen } from "@testing-library/react";
import ServiceCard from "@/shared/ui/ServiceCard";

describe("ServiceCard", () => {
  it("muestra título, descripción e icono", () => {
    render(
      <ServiceCard icon="fas fa-vial" title="Hemograma" description="Código: HMG" />,
    );

    expect(screen.getByRole("heading", { level: 4, name: "Hemograma" })).toBeInTheDocument();
    expect(screen.getByText("Código: HMG")).toBeInTheDocument();
    expect(document.querySelector(".fa-vial")).toBeInTheDocument();
  });
});
