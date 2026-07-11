import { render, screen } from "@testing-library/react";

import LandingPage from "../app/page";

const originalTxLineMode = process.env.NEXT_PUBLIC_TXLINE_MODE;
const originalXBlinkUrl = process.env.NEXT_PUBLIC_X_BLINK_URL;

function restoreEnvironment() {
  if (originalTxLineMode === undefined) {
    delete process.env.NEXT_PUBLIC_TXLINE_MODE;
  } else {
    process.env.NEXT_PUBLIC_TXLINE_MODE = originalTxLineMode;
  }

  if (originalXBlinkUrl === undefined) {
    delete process.env.NEXT_PUBLIC_X_BLINK_URL;
  } else {
    process.env.NEXT_PUBLIC_X_BLINK_URL = originalXBlinkUrl;
  }
}

describe("Arena90 landing page", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_TXLINE_MODE;
    delete process.env.NEXT_PUBLIC_X_BLINK_URL;
  });

  afterAll(restoreEnvironment);

  it("explains the product and defaults safely to simulation status", () => {
    render(<LandingPage />);

    expect(screen.getAllByText(/ARENA90/i)[0]).toBeInTheDocument();
    expect(
      screen.getByText(/Two agents\. One feed\. Opposite strategies\./i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/TxLINE simulation/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Deterministic test run/i)).toBeInTheDocument();
    expect(screen.queryByText(/Live TxLINE/i)).not.toBeInTheDocument();
  });

  it("provides working internal navigation and repository links", () => {
    const { container } = render(<LandingPage />);

    expect(screen.getByRole("link", { name: /Watch the clash/i })).toHaveAttribute(
      "href",
      "#agents",
    );
    expect(
      screen.getByRole("link", { name: /View Arena90 source code on GitHub/i }),
    ).toHaveAttribute("href", "https://github.com/deranalabs/arena-90");

    for (const id of ["agents", "blink-experience", "agent-trace", "oracle", "settlement"]) {
      expect(container.querySelector(`#${id}`)).toBeInTheDocument();
    }
  });

  it("shows the X Blink CTA only for a valid HTTPS URL", () => {
    process.env.NEXT_PUBLIC_X_BLINK_URL = "https://x.com/arena90/status/123";
    const { unmount } = render(<LandingPage />);

    expect(screen.getByRole("link", { name: /Open Blink on X/i })).toHaveAttribute(
      "href",
      "https://x.com/arena90/status/123",
    );

    unmount();
    process.env.NEXT_PUBLIC_X_BLINK_URL = "javascript:alert(1)";
    render(<LandingPage />);
    expect(screen.queryByRole("link", { name: /Open Blink on X/i })).not.toBeInTheDocument();
  });

  it("renders verified live labels when live mode is enabled", () => {
    process.env.NEXT_PUBLIC_TXLINE_MODE = "live";
    render(<LandingPage />);

    expect(screen.getAllByText(/Live TxLINE/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Autonomous agents online/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Devnet escrow armed/i).length).toBeGreaterThan(0);
  });

  it("renders all proof sections", () => {
    render(<LandingPage />);

    expect(screen.getByText(/SIGNALS IN/i)).toBeInTheDocument();
    expect(screen.getByText(/FUND FROM YOUR/i)).toBeInTheDocument();
    expect(screen.getByText(/AGENT EXECUTION TRACE/i)).toBeInTheDocument();
    expect(screen.getByText(/CRYPTOGRAPHIC/i)).toBeInTheDocument();
    expect(screen.getByText(/JUST THE ESCROW/i)).toBeInTheDocument();
  });
});
