import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Servicios from "@/app/servicios/page";
import examenesData from "@/app/data/examenes.json";

describe("Página Servicios (catálogo)", () => {
  it("muestra el título y el buscador", () => {
    render(<Servicios />);
    expect(screen.getByRole("heading", { name: /catálogo de exámenes/i })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/buscar examen por nombre o código/i),
    ).toBeInTheDocument();
  });

  it("lista todos los exámenes cuando el buscador está vacío", () => {
    render(<Servicios />);
    expect(screen.getByText(new RegExp(`Mostrando ${examenesData.length}`))).toBeInTheDocument();
  });

  it("filtra por nombre o código", async () => {
    const user = userEvent.setup();
    render(<Servicios />);
    const input = screen.getByPlaceholderText(/buscar examen por nombre o código/i);

    await user.type(input, "ACIDO VALPROICO");
    const matches = examenesData.filter(
      (e) =>
        e.nombre.toLowerCase().includes("acido valproico") ||
        e.codigo.toLowerCase().includes("acido valproico"),
    );
    expect(screen.getByText(new RegExp(`Mostrando ${matches.length}`))).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "ZZZ_INEXISTENTE_999");
    expect(screen.getByText(/no se encontraron resultados/i)).toBeInTheDocument();
  });
});
