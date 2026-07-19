import { render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";

import ReplayPage from "@/app/arena/[arenaId]/replay/page";
import { ArenaExperience } from "@/components/arena/ArenaExperience";
import recoveryReplayInput from "@/data/replays/world-cup-2026-france-england-third-place-recovery-replay-01.json";
import { parseRecordedReplayArtifact } from "@/lib/arena-api/recorded-replay-artifacts";
import type { RuntimeTransport } from "@/lib/arena-api/transport";

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

const mockRedirect = jest.mocked(redirect);

const arenaId =
  "world-cup-2026-france-england-third-place-recovery-replay-01";

function recordedTransport() {
  const artifact = parseRecordedReplayArtifact(recoveryReplayInput);
  return {
    readState: jest.fn().mockResolvedValue(artifact.state),
    readHistory: jest.fn().mockImplementation(async (_arenaId, afterSequence) => ({
      ...artifact.history,
      afterSequence,
      events: artifact.history.events.filter(
        (event) => event.sequence > afterSequence,
      ),
    })),
    streamEvents: jest.fn().mockResolvedValue({ status: "TERMINAL" }),
  } satisfies RuntimeTransport;
}

describe("third-place Recovery Replay route", () => {
  beforeEach(() => mockRedirect.mockClear());

  it("redirects the individual Replay URL to its completed archive", async () => {
    await ReplayPage({ params: Promise.resolve({ arenaId }) });

    expect(mockRedirect).toHaveBeenCalledWith(`/arena/${arenaId}/archive`);
  });

  it("shows the exact disclosure without supporter or Solana lifecycle controls", async () => {
    render(
      <ArenaExperience
        arenaId={arenaId}
        experience="archive"
        transport={recordedTransport()}
      />,
    );

    expect(
      await screen.findByText(
        "RECOVERY REPLAY — recorded data, not live execution",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("COMPLETED").length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: /back the strategy/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /back alpha|back beta/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /claim|refund/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/supporter backing verified|solana devnet/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /transaction proof|claim proof/i })).not.toBeInTheDocument();
  });
});
