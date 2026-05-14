import { render, screen } from "@testing-library/react";
import FloatingButtons from "@/shared/ui/FloatingButtons";

describe("FloatingButtons", () => {
  it("enlaza WhatsApp con el número configurado", () => {
    render(<FloatingButtons />);
    const wa = screen.getByRole("link", { name: /contactar por whatsapp/i });
    expect(wa).toHaveAttribute("href", "https://wa.me/573103661093");
    expect(wa).toHaveAttribute("target", "_blank");
  });

  it("enlaza Instagram", () => {
    render(<FloatingButtons />);
    const ig = screen.getByRole("link", { name: /instagram/i });
    expect(ig.getAttribute("href")).toContain("instagram.com");
  });
});
