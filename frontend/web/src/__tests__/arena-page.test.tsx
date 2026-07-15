import { render, screen } from "@testing-library/react";

import ArenaPage from "../app/arena/[arenaId]/page";

describe("Arena visual foundation", () => {
  it("renders an arena-specific spectator shell without fabricating match state", async () => {
    const page = await ArenaPage({
      params: Promise.resolve({ arenaId: "arena-foundation-001" }),
    });
    render(page);

    expect(
      screen.getByRole("heading", { level: 1, name: /arena broadcast/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("arena-foundation-001")).toBeInTheDocument();
    expect(
      screen.getByText(/waiting for verified runtime state/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /agent alpha/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /agent beta/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/momentum & repricing/i)).toBeInTheDocument();
    expect(
      screen.getByText(/structure & valuation control/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/awaiting public state/i)).toHaveLength(2);
    expect(screen.getByText(/no public events loaded/i)).toBeInTheDocument();

    expect(screen.queryByText(/isagi|aiku|over 2\.5|under 2\.5/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/live txline|system online/i)).not.toBeInTheDocument();
  });

  it("keeps a clear route back to product context", async () => {
    const page = await ArenaPage({
      params: Promise.resolve({ arenaId: "arena-foundation-001" }),
    });
    render(page);

    expect(screen.getByRole("link", { name: /back to arena90/i })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
