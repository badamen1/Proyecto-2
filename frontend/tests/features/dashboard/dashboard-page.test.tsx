import { render, screen, waitFor } from "@testing-library/react";
import { vi, beforeEach } from "vitest";
import Dashboard from "@/app/dashboard/page";

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));
const mockApiFetch = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: mockApiFetch,
  apiFetchBlob: vi.fn(),
  logoutAndRedirect: vi.fn(),
}));

// Mock de localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("Página Dashboard (roles)", () => {
  beforeEach(() => {
    localStorageMock.clear();
    mockPush.mockClear();
    mockApiFetch.mockReset();
    mockApiFetch.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
  });

  it("muestra menú de paciente por defecto", () => {
    localStorageMock.setItem("access_token", "fake-token");
    localStorageMock.setItem("user_role", "paciente");

    render(<Dashboard />);

    expect(screen.getByText(/mis resultados/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /agendar domicilio/i })).toHaveAttribute(
      "href",
      "/agendar-muestra",
    );
  });

  it("muestra panel de bacteriólogo cuando el rol es bacteriologo", () => {
    localStorageMock.setItem("access_token", "fake-token");
    localStorageMock.setItem("user_role", "bacteriologo");

    render(<Dashboard />);

    expect(screen.getByText(/ingresar resultados/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /muestras pendientes por procesar/i })).toBeInTheDocument();
  });

  it("muestra panel de administración cuando el rol es admin", () => {
    localStorageMock.setItem("access_token", "fake-token");
    localStorageMock.setItem("user_role", "admin");

    render(<Dashboard />);

    expect(screen.getByText(/gestión de usuarios/i)).toBeInTheDocument();
    expect(screen.getByText(/pacientes hoy/i)).toBeInTheDocument();
  });

  it("redirige a login si no hay token de autenticación", () => {
    render(<Dashboard />);

    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("muestra el conteo real de resultados del paciente", async () => {
    localStorageMock.setItem("access_token", "fake-token");
    localStorageMock.setItem("user_role", "paciente");
    mockApiFetch.mockResolvedValue({
      count: 3, next: null, previous: null, results: [],
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/tienes 3 resultados disponibles/i)).toBeInTheDocument();
    });

    const link = screen.getByText(/ver resultados/i).closest("a");
    expect(link).toHaveAttribute("href", "/dashboard/resultados");
  });
});
