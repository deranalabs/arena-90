import {
  publicApiErrorEnvelopeV1Schema,
  publicArenaStateV1Schema,
  publicEventHistoryV1Schema,
  type PublicArenaEventV1,
  type PublicArenaStateV1,
  type PublicEventHistoryV1,
} from "./contracts";
import { decodeArenaEventStream } from "./sse";
import { ArenaTransportError } from "./transport-error";

export { ArenaTransportError } from "./transport-error";

export type RuntimeEventStream =
  | { status: "OPEN"; events: AsyncIterable<PublicArenaEventV1> }
  | { status: "TERMINAL" };

export interface RuntimeTransport {
  readState(arenaId: string, signal?: AbortSignal): Promise<PublicArenaStateV1>;
  readHistory(
    arenaId: string,
    afterSequence: number,
    signal?: AbortSignal,
  ): Promise<PublicEventHistoryV1>;
  streamEvents(
    arenaId: string,
    afterSequence: number,
    signal: AbortSignal,
  ): Promise<RuntimeEventStream>;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function validateArenaId(arenaId: string) {
  if (!arenaId || arenaId.trim() !== arenaId) {
    throw new ArenaTransportError("INVALID_REQUEST");
  }
  return encodeURIComponent(arenaId);
}

function validateCursor(afterSequence: number) {
  if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) {
    throw new ArenaTransportError("INVALID_REQUEST");
  }
}

function mediaType(response: Response) {
  return response.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
}

function isJson(response: Response) {
  return mediaType(response) === "application/json";
}

function isEventStream(response: Response) {
  return mediaType(response) === "text/event-stream";
}

async function request(fetcher: Fetcher, url: string, init: RequestInit) {
  try {
    return await fetcher(url, init);
  } catch (error) {
    if (init.signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw error;
    }
    throw new ArenaTransportError("NETWORK_FAILURE");
  }
}

async function apiFailure(response: Response): Promise<never> {
  if (!isJson(response)) throw new ArenaTransportError("INVALID_RESPONSE");

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new ArenaTransportError("INVALID_RESPONSE");
  }
  const parsed = publicApiErrorEnvelopeV1Schema.safeParse(value);
  if (!parsed.success) throw new ArenaTransportError("INVALID_RESPONSE");

  throw new ArenaTransportError("API_ERROR", {
    status: response.status,
    apiCode: parsed.data.error.code,
  });
}

async function strictJson<T>(
  response: Response,
  parse: (value: unknown) => T,
): Promise<T> {
  if (!response.ok) return apiFailure(response);
  if (!isJson(response)) throw new ArenaTransportError("INVALID_RESPONSE");

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new ArenaTransportError("INVALID_RESPONSE");
  }

  try {
    return parse(value);
  } catch {
    throw new ArenaTransportError("INVALID_RESPONSE");
  }
}

export function createRuntimeTransport(
  options: { fetcher?: Fetcher } = {},
): RuntimeTransport {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);

  return {
    async readState(arenaId, signal) {
      const encodedArenaId = validateArenaId(arenaId);
      const response = await request(fetcher, `/api/arenas/${encodedArenaId}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal,
      });
      const state = await strictJson(response, (value) =>
        publicArenaStateV1Schema.parse(value),
      );
      if (state.manifest.arenaId !== arenaId) {
        throw new ArenaTransportError("INVALID_RESPONSE");
      }
      return state;
    },

    async readHistory(arenaId, afterSequence, signal) {
      const encodedArenaId = validateArenaId(arenaId);
      validateCursor(afterSequence);
      const response = await request(
        fetcher,
        `/api/arenas/${encodedArenaId}/events?after=${afterSequence}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal,
        },
      );
      const history = await strictJson(response, (value) =>
        publicEventHistoryV1Schema.parse(value),
      );
      if (
        history.arenaId !== arenaId ||
        history.afterSequence !== afterSequence
      ) {
        throw new ArenaTransportError("INVALID_RESPONSE");
      }
      return history;
    },

    async streamEvents(arenaId, afterSequence, signal) {
      const encodedArenaId = validateArenaId(arenaId);
      validateCursor(afterSequence);
      const response = await request(
        fetcher,
        `/api/arenas/${encodedArenaId}/events/stream`,
        {
          method: "GET",
          headers: {
            Accept: "text/event-stream",
            "Last-Event-ID": String(afterSequence),
          },
          cache: "no-store",
          signal,
        },
      );

      if (response.status === 204) return { status: "TERMINAL" };
      if (!response.ok) return apiFailure(response);
      if (!isEventStream(response) || !response.body) {
        throw new ArenaTransportError("INVALID_RESPONSE");
      }

      return {
        status: "OPEN",
        events: decodeArenaEventStream(response.body, arenaId, signal),
      };
    },
  };
}
