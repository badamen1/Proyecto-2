import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Servicios from "@/app/servicios/page";

const MOCK_EXAMENES = [
  { slug: "glucosa-basal", nombre: "Glucosa Basal", codigo: "GLU", categoria: "Metabolismo", precio: 15000, sintomas: ["sed"] },
  { slug: "hemograma-completo", nombre: "Hemograma Completo", codigo: "HEM", categoria: "Hematología", precio: 25000, sintomas: ["fatiga"] },
  { slug: "acido-valproico", nombre: "Ácido Valproico", codigo: "VAL", categoria: "Otras", precio: 60000, sintomas: [] },
];

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ results: MOCK_EXAMENES }),
  } as Response);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Página Servicios (catálogo)", () => {
  it("muestra el título y el buscador", () => {
    render(<Servicios />);
    expect(screen.getByRole("heading", { name: /catálogo de exámenes/i })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/buscar examen por nombre o código/i),
    ).toBeInTheDocument();
  });

  it("lista todos los exámenes cuando el buscador está vacío", async () => {
    render(<Servicios />);
    await waitFor(() =>
      expect(screen.getByText(new RegExp(`Mostrando ${MOCK_EXAMENES.length}`))).toBeInTheDocument(),
    );
  });

  it("filtra por nombre o código", async () => {
    const user = userEvent.setup();
    render(<Servicios />);

    await waitFor(() =>
      expect(screen.getByText(/Mostrando 3/)).toBeInTheDocument(),
    );

    const input = screen.getByPlaceholderText(/buscar examen por nombre o código/i);
    await user.type(input, "glucosa");
    expect(screen.getByText(/Mostrando 1/)).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "ZZZ_INEXISTENTE_999");
    expect(screen.getByText(/no se encontraron resultados/i)).toBeInTheDocument();
  });
});
