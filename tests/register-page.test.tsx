import { render, screen } from "@testing-library/react";
import Register from "@/app/register/page";

describe("Página Register", () => {
  it("muestra el formulario de registro", () => {
    render(<Register />);
    expect(screen.getByRole("heading", { name: /crea tu cuenta/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/juan pérez/i)).toBeInTheDocument();
  });
});
