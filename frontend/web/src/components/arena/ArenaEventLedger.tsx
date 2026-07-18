"use client";

import { useEffect, useMemo, useState } from "react";

import type { PublicArenaEventV1 } from "@/lib/arena-api/contracts";

type LedgerFilter = "ALL" | "SYSTEM" | "ALPHA" | "BETA";

function eventOwner(event: PublicArenaEventV1): LedgerFilter {
  if ("agentId" in event) return event.agentId === "alpha" ? "ALPHA" : "BETA";
  return "SYSTEM";
}

function eventDetail(event: PublicArenaEventV1): string {
  switch (event.type) {
    case "ARENA_READY":
      return "Locked arena ready; waiting for verified checkpoint evidence.";
    case "CHECKPOINT_OPENED":
      return `Snapshot ${event.payload.snapshot.snapshotId.slice(0, 12)} locked.`;
    case "AGENTS_ANALYZING":
      return "Alpha and Beta invoked independently from the same evidence.";
    case "DECISION_RECEIVED":
      return "Structured decision received; allocation remains hidden.";
    case "RECHECKING_DECISION":
      return "Schema repair attempt started; no fallback trade created.";
    case "MISSED_DECISION_ROUND":
      return `Agent decision missed: ${event.payload.reason}.`;
    case "GLOBAL_MISSED_DECISION_ROUND":
      return `Checkpoint missed globally: ${event.payload.reason}.`;
    case "ROUND_REVEALED":
      return "Both outcomes revealed; deterministic execution committed.";
    case "ROUND_COMPLETE":
      return "Portfolio transition and public event sequence committed.";
    case "FINALIZING":
      return "Terminal evidence received; deterministic settlement running.";
    case "COMPLETED":
      return `Arena complete: ${event.payload.result.winner}.`;
  }
}

function eventProof(event: PublicArenaEventV1) {
  return {
    eventId: event.eventId,
    arenaId: event.arenaId,
    sequence: event.sequence,
    type: event.type,
    occurredAtUtc: event.occurredAtUtc,
    ...(eventOwner(event) === "SYSTEM" ? {} : { agentId: eventOwner(event).toLowerCase() }),
    ...("checkpointId" in event ? { checkpointId: event.checkpointId } : {}),
  };
}

export function ArenaEventLedger({
  events,
  connection,
  recordedPlayback = false,
}: {
  events: readonly PublicArenaEventV1[];
  connection: string;
  recordedPlayback?: boolean;
}) {
  const [filter, setFilter] = useState<LedgerFilter>("ALL");
  const [pausedEvents, setPausedEvents] = useState<readonly PublicArenaEventV1[] | null>(null);
  const [playbackCount, setPlaybackCount] = useState<number | null>(null);
  const [copyStatus, setCopyStatus] = useState<"IDLE" | "COPIED" | "FAILED">("IDLE");
  const playbackEvents = playbackCount === null ? null : events.slice(0, playbackCount);
  const source = playbackEvents ?? pausedEvents ?? events;
  const visible = useMemo(
    () =>
      source
        .filter((event) => filter === "ALL" || eventOwner(event) === filter)
        .slice(-24)
        .reverse(),
    [filter, source],
  );
  const latest = source.at(-1);

  useEffect(() => {
    if (playbackCount === null || playbackCount >= events.length) return;
    const timer = window.setTimeout(() => {
      setPlaybackCount((current) => current === null ? null : current + 1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [events.length, playbackCount]);

  function startRecordedPlayback() {
    setPausedEvents(null);
    setFilter("ALL");
    setPlaybackCount(events.length === 0 ? null : 1);
  }

  async function copyLatestProof() {
    if (!latest || !navigator.clipboard) {
      setCopyStatus("FAILED");
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(eventProof(latest), null, 2));
      setCopyStatus("COPIED");
    } catch {
      setCopyStatus("FAILED");
    }
  }

  return (
    <section className="arena-ledger" aria-labelledby="arena-ledger-title">
      <header className="arena-ledger__header">
        <div>
          <p className="product-eyebrow">
            {recordedPlayback ? "Recorded autonomous activity" : "Live agent activity"}
          </p>
          <h2 id="arena-ledger-title">Public Event Ledger</h2>
          <p>Verified runtime events only. No private reasoning or infrastructure logs.</p>
        </div>
        <div className="arena-ledger__status" aria-label="Ledger connection status">
          <span aria-hidden="true" />
          {playbackCount !== null
            ? playbackCount >= events.length
              ? "EVENT RECORD COMPLETE"
              : "PLAYING RECORDED EVENTS"
            : pausedEvents
              ? "DISPLAY PAUSED"
              : connection}
        </div>
      </header>

      <div className="arena-ledger__controls">
        <div aria-label="Filter ledger events" role="group">
          {(["ALL", "SYSTEM", "ALPHA", "BETA"] as const).map((value) => (
            <button
              aria-pressed={filter === value}
              key={value}
              onClick={() => setFilter(value)}
              type="button"
            >
              {value}
            </button>
          ))}
        </div>
        <div>
          {recordedPlayback ? (
            <button onClick={startRecordedPlayback} type="button">
              PLAY EVENT RECORD
            </button>
          ) : null}
          <button
            onClick={() => {
              setPlaybackCount(null);
              setPausedEvents(pausedEvents ? null : [...events]);
            }}
            type="button"
          >
            {pausedEvents ? "RESUME DISPLAY" : "PAUSE DISPLAY"}
          </button>
          <button disabled={!latest} onClick={() => void copyLatestProof()} type="button">
            {copyStatus === "COPIED"
              ? "PROOF COPIED"
              : copyStatus === "FAILED"
                ? "COPY FAILED"
                : "COPY LATEST PROOF"}
          </button>
        </div>
      </div>

      <ol className="arena-ledger__events" aria-live="polite">
        {visible.length === 0 ? (
          <li className="arena-ledger__empty">Waiting for the first verified public event.</li>
        ) : (
          visible.map((event) => (
            <li key={event.eventId}>
              <span className="arena-ledger__sequence">#{event.sequence.toString().padStart(3, "0")}</span>
              <span className={`arena-ledger__owner arena-ledger__owner--${eventOwner(event).toLowerCase()}`}>
                {eventOwner(event)}
              </span>
              <div>
                <strong>{event.type.replaceAll("_", " ")}</strong>
                <p>{eventDetail(event)}</p>
              </div>
              <time dateTime={event.occurredAtUtc}>
                {new Date(event.occurredAtUtc).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  timeZone: "UTC",
                })} UTC
              </time>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}
