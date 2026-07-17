import { render, screen } from "@testing-library/react";

import { SiteHeader } from "@/components/site/SiteHeader";

describe("Arena90 site header", () => {
  it("exposes the public product routes and an honest Replay entry", () => {
    render(<SiteHeader />);

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
    expect(screen.getByRole("link", { name: "Replay Arena" })).toHaveAttribute(
      "href",
      "/arena/arena-replay-001",
    );
    expect(screen.getByRole("link", { name: "Agents" })).toHaveAttribute(
      "href",
      "/agents",
    );
    expect(screen.getByRole("link", { name: "Replays" })).toHaveAttribute(
      "href",
      "/replays",
    );
    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(screen.getByRole("link", { name: "Public proof" })).toHaveAttribute(
      "href",
      "/arena/arena-replay-001/proof",
    );
    expect(screen.getByRole("link", { name: /watch replay/i })).toHaveAttribute(
      "href",
      "/arena/arena-replay-001/replay",
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
  });
});
