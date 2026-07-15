import type {
  PublicSnapshotV1,
} from "@/lib/arena-api/contracts";
import type { SpectatorSessionStatus } from "@/lib/arena-api/spectator-session";

type ConnectionBannerProps = {
  status: SpectatorSessionStatus;
  snapshot?: PublicSnapshotV1;
};

function copyFor(status: SpectatorSessionStatus) {
  switch (status) {
    case "CONNECTING":
      return ["Connecting", "Connecting to public event stream"] as const;
    case "FOLLOWING":
      return ["Connected", "Public event stream active"] as const;
    case "RECONNECTING":
      return ["Reconnecting", "Reconnecting to public event stream"] as const;
    case "TERMINAL":
      return ["Terminal", "Arena record complete"] as const;
    case "FAILED":
      return ["Unavailable", "Verified public data could not be continued"] as const;
    case "DISPOSED":
      return ["Closed", "Spectator session closed"] as const;
    case "IDLE":
    case "BOOTSTRAPPING":
    default:
      return ["Loading arena", "Loading verified public state"] as const;
  }
}

export function ConnectionBanner({ status, snapshot }: ConnectionBannerProps) {
  const canBeDegraded = status === "FOLLOWING" || status === "RECONNECTING";
  const degraded = canBeDegraded
    ? snapshot?.freshness.suspended
      ? "Public market data suspended"
      : snapshot?.freshness.delayed
        ? "Public data delayed"
        : undefined
    : undefined;
  const [label, detail] = degraded ? ["Degraded", degraded] : copyFor(status);
  const modifier = label.toLowerCase().replaceAll(" ", "-");

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className={`arena-state-label arena-state-label--${modifier}`}
      role="status"
    >
      <span aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}
