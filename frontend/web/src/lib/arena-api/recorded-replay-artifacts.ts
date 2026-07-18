import englandArgentinaInput from "@/data/replays/world-cup-2026-england-argentina-semifinal-replay.json";
import franceSpainInput from "@/data/replays/world-cup-2026-france-spain-semifinal-replay.json";

import {
  publicArenaStateV1Schema,
  publicEventHistoryV1Schema,
  type PublicArenaStateV1,
  type PublicEventHistoryV1,
} from "./contracts";

type RecordedReplayArtifact = Readonly<{
  recordedSource: Readonly<{
    label: "RECORDED TxLINE DATA";
    fixtureId: string;
    matchDateUtc: string;
    capturedAtUtc: string;
    scoreEventCount: number;
    oddsUpdateCount: number;
    inputHash: string;
  }>;
  state: PublicArenaStateV1;
  history: PublicEventHistoryV1;
}>;

function parseArtifact(input: unknown): RecordedReplayArtifact {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new TypeError("Invalid recorded Replay artifact");
  }
  const record = input as Record<string, unknown>;
  const source = record["recordedSource"];
  if (typeof source !== "object" || source === null || Array.isArray(source)) {
    throw new TypeError("Invalid recorded Replay source");
  }
  const sourceRecord = source as Record<string, unknown>;
  if (
    sourceRecord["label"] !== "RECORDED TxLINE DATA" ||
    typeof sourceRecord["fixtureId"] !== "string" ||
    typeof sourceRecord["matchDateUtc"] !== "string" ||
    typeof sourceRecord["capturedAtUtc"] !== "string" ||
    typeof sourceRecord["scoreEventCount"] !== "number" ||
    typeof sourceRecord["oddsUpdateCount"] !== "number" ||
    typeof sourceRecord["inputHash"] !== "string" ||
    !/^[a-f0-9]{64}$/u.test(sourceRecord["inputHash"])
  ) {
    throw new TypeError("Invalid recorded Replay source");
  }
  const recordedSource = {
    label: sourceRecord["label"],
    fixtureId: sourceRecord["fixtureId"],
    matchDateUtc: sourceRecord["matchDateUtc"],
    capturedAtUtc: sourceRecord["capturedAtUtc"],
    scoreEventCount: sourceRecord["scoreEventCount"],
    oddsUpdateCount: sourceRecord["oddsUpdateCount"],
    inputHash: sourceRecord["inputHash"],
  } as const;
  const state = publicArenaStateV1Schema.parse(record["state"]);
  const history = publicEventHistoryV1Schema.parse(record["history"]);
  if (
    history.arenaId !== state.manifest.arenaId ||
    history.afterSequence !== 0 ||
    history.lastEventSequence !== state.lastEventSequence ||
    recordedSource.fixtureId !== state.manifest.fixtureId ||
    state.phase !== "COMPLETED" ||
    state.checkpoints.length !== 6 ||
    state.checkpoints.some((checkpoint) => checkpoint.failures.length > 0) ||
    !state.checkpoints.some(
      (checkpoint) =>
        checkpoint.revealedDecisions.alpha?.action === "TARGET_ALLOCATION",
    ) ||
    !state.checkpoints.some(
      (checkpoint) =>
        checkpoint.revealedDecisions.beta?.action === "TARGET_ALLOCATION",
    )
  ) {
    throw new TypeError("Inconsistent recorded Replay artifact");
  }
  return Object.freeze({ recordedSource, state, history });
}

const artifacts = new Map<string, RecordedReplayArtifact>(
  [franceSpainInput, englandArgentinaInput].map((input) => {
    const artifact = parseArtifact(input);
    return [artifact.state.manifest.arenaId, artifact];
  }),
);

export function listRecordedReplayArtifacts() {
  return [...artifacts.values()]
    .map((artifact) => ({
      arenaId: artifact.state.manifest.arenaId,
      competition: artifact.state.manifest.competition,
      homeTeam: artifact.state.manifest.homeTeam.name,
      awayTeam: artifact.state.manifest.awayTeam.name,
      matchDateUtc: artifact.recordedSource.matchDateUtc,
      sourceLabel: artifact.recordedSource.label,
      eventCount: artifact.history.events.length,
      inputHash: artifact.recordedSource.inputHash,
      winner: artifact.state.finalResult?.winner ?? "DRAW",
      alphaFinalNavMicros:
        artifact.state.finalResult?.alphaFinalNavMicros ??
        artifact.state.portfolios.alpha.navMicros,
      betaFinalNavMicros:
        artifact.state.finalResult?.betaFinalNavMicros ??
        artifact.state.portfolios.beta.navMicros,
      watchHref: `/arena/${artifact.state.manifest.arenaId}/archive`,
      proofHref: `/arena/${artifact.state.manifest.arenaId}/proof`,
    }))
    .sort((left, right) => left.matchDateUtc.localeCompare(right.matchDateUtc));
}

export function isRecordedReplayArtifact(arenaId: string): boolean {
  return artifacts.has(arenaId);
}

function invalidRequest() {
  return Response.json(
    {
      schemaVersion: 1,
      error: { code: "INVALID_REQUEST", message: "Invalid arena request" },
    },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}

function cursorFrom(value: string | null): number | undefined {
  if (value === null || !/^(0|[1-9]\d*)$/u.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function serveRecordedReplayRequest(
  request: Request,
): Response | undefined {
  if (request.method.toUpperCase() !== "GET") return undefined;
  const url = new URL(request.url);
  const match = /^\/api\/arenas\/([^/]+)(?:\/(events)(?:\/(stream))?)?$/u.exec(
    url.pathname,
  );
  if (match === null) return undefined;

  let arenaId: string;
  try {
    arenaId = decodeURIComponent(match[1] ?? "");
  } catch {
    return invalidRequest();
  }
  const artifact = artifacts.get(arenaId);
  if (artifact === undefined) return undefined;

  const isEvents = match[2] === "events";
  const isStream = match[3] === "stream";
  if (!isEvents) {
    return Response.json(artifact.state, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const cursor = cursorFrom(
    isStream
      ? request.headers.get("last-event-id") ?? url.searchParams.get("after")
      : url.searchParams.get("after") ?? "0",
  );
  if (cursor === undefined || cursor > artifact.history.lastEventSequence) {
    return invalidRequest();
  }
  const events = artifact.history.events.filter(
    (event) => event.sequence > cursor,
  );

  if (!isStream) {
    return Response.json(
      {
        schemaVersion: 1,
        arenaId,
        afterSequence: cursor,
        lastEventSequence: artifact.history.lastEventSequence,
        events,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (events.length === 0) {
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const body = events
    .map((event) => `id: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`)
    .join("");
  return new Response(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}
