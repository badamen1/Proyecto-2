import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import Register from "@/app/register/page";

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe("Página Register", () => {
  it("muestra el formulario de registro", () => {
    render(<Register />);
    expect(screen.getByRole("heading", { name: /crea tu cuenta/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/juan pérez/i)).toBeInTheDocument();
  });
});
