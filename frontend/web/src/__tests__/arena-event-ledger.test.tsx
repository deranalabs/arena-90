import { fireEvent, render, screen } from "@testing-library/react";

import { ArenaEventLedger } from "@/components/arena/ArenaEventLedger";
import type { PublicArenaEventV1 } from "@/lib/arena-api/contracts";
import { publicEvent } from "@/test-support/arena-api-fixtures";

function events(): PublicArenaEventV1[] {
  return [
    publicEvent(1) as PublicArenaEventV1,
    publicEvent(2, "DECISION_RECEIVED", {
      checkpointId: "KICKOFF",
      agentId: "alpha",
      payload: { status: "RECEIVED" },
    }) as PublicArenaEventV1,
    publicEvent(3, "DECISION_RECEIVED", {
      checkpointId: "KICKOFF",
      agentId: "beta",
      payload: { status: "RECEIVED" },
    }) as PublicArenaEventV1,
  ];
}

describe("Public Event Ledger", () => {
  it("shows only verified public events and filters by event owner", () => {
    render(<ArenaEventLedger connection="LIVE UPDATES" events={events()} />);

    expect(screen.getByRole("heading", { name: "Public Event Ledger" })).toBeInTheDocument();
    expect(screen.getByText(/no private reasoning or infrastructure logs/i)).toBeInTheDocument();
    expect(screen.getAllByText("DECISION RECEIVED")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "ALPHA" }));
    expect(screen.getAllByText("ALPHA")).toHaveLength(2);
    expect(screen.queryByText("BETA", { selector: "span" })).not.toBeInTheDocument();
    expect(screen.queryByText("ARENA READY")).not.toBeInTheDocument();
  });

  it("pauses the display without claiming the SSE runtime is paused", () => {
    const initial = events().slice(0, 1);
    const view = render(
      <ArenaEventLedger connection="LIVE UPDATES" events={initial} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "PAUSE DISPLAY" }));
    view.rerender(<ArenaEventLedger connection="LIVE UPDATES" events={events()} />);

    expect(screen.getByLabelText("Ledger connection status")).toHaveTextContent(
      "DISPLAY PAUSED",
    );
    expect(screen.queryByText("DECISION RECEIVED")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "RESUME DISPLAY" }));
    expect(screen.getAllByText("DECISION RECEIVED")).toHaveLength(2);
  });
});
