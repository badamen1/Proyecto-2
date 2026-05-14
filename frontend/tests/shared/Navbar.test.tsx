import { render, screen } from "@testing-library/react";
import Navbar from "@/shared/layout/Navbar";

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

describe("Navbar", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("expone enlaces principales de navegación", () => {
    render(<Navbar />);

    expect(screen.getByRole("link", { name: /inicio/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /nosotros/i })).toHaveAttribute("href", "/nosotros");
    expect(screen.getByRole("link", { name: /servicios/i })).toHaveAttribute("href", "/servicios");
    expect(screen.getByRole("link", { name: /agenda tu cita/i })).toHaveAttribute(
      "href",
      "/agenda-tu-cita",
    );
    expect(screen.getByRole("link", { name: /contacto/i })).toHaveAttribute("href", "/contacto");
  });

  it("Mi Portal apunta a /login cuando no hay sesión activa", () => {
    render(<Navbar />);
    expect(screen.getByRole("link", { name: /mi portal/i })).toHaveAttribute("href", "/login");
  });

  it("Mi Portal apunta a /dashboard cuando hay sesión activa", () => {
    localStorageMock.setItem("access_token", "fake-token");
    render(<Navbar />);
    expect(screen.getByRole("link", { name: /mi portal/i })).toHaveAttribute("href", "/dashboard");
  });
});
