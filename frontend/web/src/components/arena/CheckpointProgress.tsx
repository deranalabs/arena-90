import type {
  PublicArenaEventV1,
  PublicArenaStateV1,
} from "@/lib/arena-api/contracts";
import { Surface } from "@/components/ui/surface";

const checkpoints = ["KICKOFF", "M15", "M30", "HALFTIME", "M60", "M75"] as const;

type CheckpointProgressProps = {
  state: PublicArenaStateV1;
  events: readonly PublicArenaEventV1[];
};

function isAnalyzing(state: PublicArenaStateV1, events: readonly PublicArenaEventV1[]) {
  if (state.phase !== "RUNNING") return false;
  const checkpointId = state.nextCheckpointId;
  if (!checkpointId || checkpointId === "FINAL") return false;
  const latest = [...events]
    .reverse()
    .find((event) => "checkpointId" in event && event.checkpointId === checkpointId);
  return Boolean(
    latest &&
      ["AGENTS_ANALYZING", "DECISION_RECEIVED", "RECHECKING_DECISION"].includes(
        latest.type,
      ),
  );
}

function isSnapshotLocked(
  state: PublicArenaStateV1,
  events: readonly PublicArenaEventV1[],
) {
  if (state.phase !== "RUNNING") return false;
  const checkpointId = state.nextCheckpointId;
  if (!checkpointId || checkpointId === "FINAL") return false;
  return (
    state.currentSnapshot?.checkpointId === checkpointId ||
    events.some(
      (event) =>
        event.type === "CHECKPOINT_OPENED" &&
        event.checkpointId === checkpointId,
    )
  );
}

export function CheckpointProgress({ state, events }: CheckpointProgressProps) {
  const complete = new Set(state.checkpoints.map((checkpoint) => checkpoint.checkpointId));
  const analyzing = isAnalyzing(state, events);
  const snapshotLocked = isSnapshotLocked(state, events);
  const current = state.nextCheckpointId;

  return (
    <Surface className="checkpoint-panel">
      <div className="checkpoint-panel__heading">
        <div>
          <p className="eyebrow">Checkpoint progress</p>
          <h2>Six decision rounds</h2>
        </div>
        <strong>{complete.size} / 6 complete</strong>
      </div>
      <ol className="checkpoint-track" aria-label="Arena checkpoint progress">
        {checkpoints.map((checkpoint) => {
          const status = complete.has(checkpoint)
            ? "COMPLETE"
            : checkpoint === current
              ? analyzing
                ? "ANALYZING"
                : snapshotLocked
                  ? "SNAPSHOT LOCKED"
                  : "NEXT"
              : "WAITING";
          return (
            <li className={`checkpoint-track__item checkpoint-track__item--${status.toLowerCase().replace(" ", "-")}`} key={checkpoint}>
              <span>{checkpoint}</span>
              <strong>{status}</strong>
            </li>
          );
        })}
      </ol>
      {snapshotLocked && state.currentSnapshot ? (
        <p className="checkpoint-panel__notice">
          Locked public snapshot · {state.currentSnapshot.checkpointId}
        </p>
      ) : null}
      {state.phase === "FINALIZING" ? (
        <p className="checkpoint-panel__notice">Verifying final result</p>
      ) : null}
    </Surface>
  );
}
