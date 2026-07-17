import { render, screen } from "@testing-library/react";

import LandingPage from "@/app/page";

describe("Arena90 homepage", () => {
  it("routes five concise product previews into the working spectator experience", () => {
    render(<LandingPage />);

    const main = screen.getByRole("main", { name: "Arena90 home" });
    expect(main).toContainElement(
      screen.getByRole("heading", {
        level: 1,
        name: "Same verified match feed. Two autonomous strategies.",
      }),
    );
    expect(main).toHaveTextContent(/same TxLINE snapshot and equal virtual bankrolls/i);
    expect(main).toHaveTextContent(/independent portfolio decisions/i);
    expect(screen.getByRole("link", { name: "Watch Autonomous Replay" })).toHaveAttribute(
      "href",
      "/arena/arena-replay-001/replay",
    );
    expect(screen.getByRole("link", { name: "See How It Works" })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(screen.getByRole("heading", { name: "Speed meets discipline." })).toBeInTheDocument();
    expect(main).toHaveTextContent(/one fixture\. equal capital\. different football intelligence/i);
    expect(screen.getByRole("img", { name: "Agent Alpha portrait" })).toHaveAttribute(
      "src",
      expect.stringContaining("alpha-momentum.png"),
    );
    expect(screen.getByRole("img", { name: "Agent Beta portrait" })).toHaveAttribute(
      "src",
      expect.stringContaining("beta-defender.png"),
    );
    expect(
      screen.getByRole("heading", { name: "Evidence in. Autonomous decisions out." }),
    ).toBeInTheDocument();
    expect(main).toHaveTextContent(/simultaneous reveal/i);
    expect(screen.getByRole("heading", { name: "Home FC vs Away FC" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Watch first. Verify when ready." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Compare both agents" })).toHaveAttribute(
      "href",
      "/agents",
    );
    expect(screen.getByRole("link", { name: "Inspect public proof" })).toHaveAttribute(
      "href",
      "/arena/arena-replay-001/proof",
    );
    expect(screen.getByText("Decision rounds")).toBeInTheDocument();
    expect(screen.getByText("Six checkpoints")).toBeInTheDocument();
    expect(main).not.toHaveTextContent(/state completed/i);
    expect(main.querySelectorAll(":scope > section")).toHaveLength(5);
    expect(main).not.toHaveTextContent(/place bet|guaranteed edge|live now/i);
  });
});
