import { fireEvent, render, screen, within } from "@testing-library/react";
import { usePathname } from "next/navigation";

import { SiteHeader } from "@/components/site/SiteHeader";

jest.mock("next/navigation", () => ({ usePathname: jest.fn() }));

describe("Arena90 site header", () => {
  beforeEach(() => {
    jest.mocked(usePathname).mockReturnValue("/");
  });

  it("exposes the public product routes and the configured Live Arena", () => {
    render(<SiteHeader />);
    const navigation = screen.getByRole("navigation", { name: "Primary" });

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Arena90 home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.getByRole("img", { name: "Arena90 arena mark" }),
    ).toHaveAttribute("src", expect.stringContaining("arena90-mark.png"));
    expect(
      screen.getByRole("img", { name: "World Cup Hackathon 2026" }),
    ).toHaveAttribute("src", expect.stringContaining("wc-hackathon.png"));
    expect(within(navigation).getByRole("link", { name: "Live Arena" })).toHaveAttribute(
      "href",
      "/arena/world-cup-2026-france-england-third-place-v4",
    );
    expect(within(navigation).getByRole("link", { name: "Replays" })).toHaveAttribute(
      "href",
      "/replays",
    );
    expect(within(navigation).getByRole("link", { name: "Agents" })).toHaveAttribute(
      "href",
      "/agents",
    );
    expect(within(navigation).getByRole("link", { name: "How it works" })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(screen.queryByRole("link", { name: "Public proof" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view arena/i })).toHaveAttribute(
      "href",
      "/arena/world-cup-2026-france-england-third-place-v4",
    );
    expect(document.body).not.toHaveTextContent(/log in|sign up|live now/i);
  });

  it("keeps the global header clean without an evergreen announcement", () => {
    render(<SiteHeader />);

    expect(
      screen.queryByText(/txline data · two autonomous agents/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Dismiss announcement" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    const menu = screen.getByRole("button", { name: "Menu" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(menu);
    const mobileNavigation = screen.getByRole("navigation", { name: "Mobile primary" });
    expect(mobileNavigation).toBeInTheDocument();
    expect(within(mobileNavigation).getByRole("link", { name: /view arena/i })).toHaveAttribute(
      "href",
      "/arena/world-cup-2026-france-england-third-place-v4",
    );
  });

  it("marks the current product route in both navigation surfaces", () => {
    jest.mocked(usePathname).mockReturnValue("/replays");
    render(<SiteHeader />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    expect(screen.getAllByRole("link", { name: "Replays" })).toHaveLength(2);
    for (const link of screen.getAllByRole("link", { name: "Replays" })) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
  });
});
