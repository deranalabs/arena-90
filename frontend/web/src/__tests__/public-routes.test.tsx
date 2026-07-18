import { render, screen } from "@testing-library/react";

import AgentsPage from "@/app/agents/page";
import ArenaPage from "@/app/arena/[arenaId]/page";
import ArchivePage from "@/app/arena/[arenaId]/archive/page";
import ProofPage from "@/app/arena/[arenaId]/proof/page";
import ReplayPage from "@/app/arena/[arenaId]/replay/page";
import HowItWorksPage from "@/app/how-it-works/page";
import ReplaysPage from "@/app/replays/page";

const originalFetch = globalThis.fetch;

describe("Arena90 public product routes", () => {
  beforeAll(() => {
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => undefined));
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it.each([
    ["agents", AgentsPage, "Two minds. One rulebook."],
    ["replays", ReplaysPage, "Replay the evidence. Audit the decisions."],
    ["system workflow", HowItWorksPage, "From match feed to verified winner."],
  ])("gives the %s route a clear product job", (label, Page, heading) => {
    const { unmount } = render(<Page />);

    expect(screen.getByRole("main", { name: `Arena90 ${label}` })).toContainElement(
      screen.getByRole("heading", { level: 1, name: heading }),
    );
    unmount();
  });

  it("shows both named agent portraits on the strategy comparison", () => {
    render(<AgentsPage />);

    expect(screen.getByRole("img", { name: "Agent Alpha portrait" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Agent Beta portrait" })).toBeInTheDocument();
  });

  it("lists both recorded World Cup semifinals without presenting them as live", () => {
    render(<ReplaysPage />);

    expect(screen.getByRole("heading", { name: "France vs Spain" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "England vs Argentina" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("RECORDED TxLINE DATA").length).toBeGreaterThan(1);
    expect(screen.queryByText("DATA LIVE")).not.toBeInTheDocument();
  });

  it.each([
    ["arena", ArenaPage],
    ["archive", ArchivePage],
    ["replay", ReplayPage],
    ["proof", ProofPage],
  ])("mounts the dynamic %s spectator experience for the requested arena", async (label, Page) => {
    const page = await Page({ params: Promise.resolve({ arenaId: "arena-replay-001" }) });
    const { unmount } = render(page);

    expect(
      screen.getByRole("main", {
        name: `Arena90 ${label} arena-replay-001`,
      }),
    ).toHaveTextContent(/loading verified arena state/i);
    unmount();
  });
});
