import { render, screen } from "@testing-library/react";

import LandingPage from "../app/page";

describe("Arena90 landing page", () => {
  it("offers the committed Replay foundation arena as the truthful primary CTA", () => {
    render(<LandingPage />);

    const enterArena = screen.getByRole("link", {
      name: /enter arena.*replay foundation/i,
    });

    expect(enterArena).toHaveAttribute("href", "/arena/arena-replay-001");
  });

  it("introduces the spectator product without inventing an active arena", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /football is the stage\. strategy is the contest\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/momentum & repricing/i)).toBeInTheDocument();
    expect(
      screen.getByText(/structure & valuation control/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/runtime data not connected/i)).toBeInTheDocument();
    expect(screen.getByText(/awaiting verified arena data/i)).toBeInTheDocument();

    expect(screen.queryByText(/isagi|aiku/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/live txline|system_online|pool share|over 2\.5|under 2\.5/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/blink|escrow|kamino|yield|settlement/i),
    ).not.toBeInTheDocument();
  });

  it("provides keyboard-addressable editorial navigation", () => {
    render(<LandingPage />);

    expect(screen.getByRole("link", { name: /arena90 home/i })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: /meet the agents/i })).toHaveAttribute(
      "href",
      "#agents",
    );
    expect(
      screen.getByRole("link", { name: /how the arena works/i }),
    ).toHaveAttribute("href", "#format");
  });
});
