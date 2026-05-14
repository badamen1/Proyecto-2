import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AgendarMuestra from "@/app/agendar-muestra/page";

describe("Página Agendar muestra a domicilio", () => {
  it("renderiza el formulario inicial", () => {
    render(<AgendarMuestra />);
    expect(
      screen.getByRole("heading", { name: /agenda tu toma de muestra a domicilio/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar solicitud/i })).toBeInTheDocument();
  });

  it("muestra confirmación tras enviar el formulario con datos mínimos", async () => {
    const user = userEvent.setup();
    render(<AgendarMuestra />);

    await user.type(screen.getByPlaceholderText(/nombre del paciente/i), "María Pérez");
    await user.type(screen.getByPlaceholderText(/^número$/i), "12345678");
    await user.type(screen.getByPlaceholderText(/300 000 0000/i), "3001234567");
    await user.type(screen.getByPlaceholderText(/barrio, calle/i), "Centro, Calle 10 #5");
    await user.type(
      screen.getByPlaceholderText(/perfil lipídico/i),
      "Cuadro hemático",
    );

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput).toBeTruthy();
    await user.type(dateInput, "2026-12-15");

    await user.click(screen.getByRole("button", { name: /enviar solicitud/i }));

    expect(await screen.findByRole("heading", { name: /solicitud recibida/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /volver al inicio/i })).toHaveAttribute("href", "/");
  });
});
