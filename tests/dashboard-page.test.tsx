import { render, screen } from "@testing-library/react";
import { vi, beforeEach } from "vitest";
import Dashboard from "@/app/dashboard/page";

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
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
});
