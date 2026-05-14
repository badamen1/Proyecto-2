import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import Login from "@/app/login/page";

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("Página Login", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renderiza el formulario de acceso con selector de perfil", () => {
    render(<Login />);
    expect(screen.getByRole("heading", { name: /iniciar sesión/i })).toBeInTheDocument();
    // El formulario por defecto es Paciente (OTP), muestra campo de documento
    expect(screen.getByPlaceholderText(/ej\. 1078458080/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /recibir código otp/i })).toBeInTheDocument();
  });

  it("cambia al formulario de personal al hacer clic en Personal", async () => {
    const user = userEvent.setup();
    render(<Login />);

    await user.click(screen.getByRole("button", { name: /personal/i }));

    expect(screen.getByPlaceholderText(/tu usuario/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ingresar al portal interno/i })).toBeInTheDocument();
  });

  it("envía login de personal y redirige al dashboard (flujo simulado)", async () => {
    const user = userEvent.setup();
    render(<Login />);

    // Cambiar a pestaña Personal
    await user.click(screen.getByRole("button", { name: /personal/i }));

    // Simular respuesta exitosa del backend
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access: "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYWRtaW4ifQ.abc",
        refresh: "fake-refresh-token",
      }),
    });

    await user.type(screen.getByPlaceholderText(/tu usuario/i), "admin");
    await user.type(screen.getByPlaceholderText(/••••••••/i), "secreto123");
    await user.click(screen.getByRole("button", { name: /ingresar al portal interno/i }));

    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });
});
