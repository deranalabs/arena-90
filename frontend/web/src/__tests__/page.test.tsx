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
    expect(main).toHaveTextContent(/same verified snapshot and equal virtual bankrolls/i);
    expect(main).toHaveTextContent(/independently manage portfolios/i);
    expect(main.querySelector(".home-typographic-hero__primary")).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/arena\//),
    );
    expect(screen.getByRole("link", { name: "See How It Works" })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(screen.getByRole("heading", { name: "Two edges. One evidence set." })).toBeInTheDocument();
    expect(main).toHaveTextContent(
      /Alpha tests whether price overshot\. Beta tests whether evidence is still ahead of price/i,
    );
    expect(screen.getAllByText("Reversion").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Continuation").length).toBeGreaterThan(0);
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
    expect(screen.getByRole("article", { name: "Home FC vs Away FC" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Watch first. Verify when ready." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Compare both agents" })).toHaveAttribute(
      "href",
      "/agents",
    );
    expect(screen.getByRole("link", { name: "Inspect public proof" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/arena\/.*\/proof$/),
    );
    expect(main).not.toHaveTextContent(/state completed/i);
    expect(screen.getByRole("heading", { name: "World Cup arenas" })).toBeInTheDocument();
    const franceEngland = screen.getAllByRole("article", { name: "France vs England" });
    expect(franceEngland.some((article) => /UPCOMING|UNAVAILABLE/.test(article.textContent ?? ""))).toBe(true);
    expect(franceEngland.some((article) => /ARCHIVED/.test(article.textContent ?? ""))).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "View Replay Archive →" })
        .some(
          (link) =>
            link.getAttribute("href") ===
            "/arena/world-cup-2026-france-england-third-place-recovery-replay-01/archive",
        ),
    ).toBe(true);
    expect(screen.getByRole("article", { name: "Spain vs Argentina" })).toHaveTextContent(/UPCOMING|UNAVAILABLE/);
    expect(screen.getByRole("article", { name: "Home FC vs Away FC" })).toHaveTextContent("REPLAY");
    expect(main).not.toHaveTextContent(/backing open/i);
    expect(main.querySelectorAll(":scope > section")).toHaveLength(5);
    expect(main).not.toHaveTextContent(/place bet|guaranteed edge|live now/i);
  });
});
