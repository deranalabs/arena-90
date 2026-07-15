import {
  publicArenaEventV1Schema,
  type PublicArenaEventV1,
} from "./contracts";

import { ArenaTransportError } from "./transport-error";

const MAX_SSE_BUFFER_BYTES = 256 * 1024;

function abortError() {
  if (typeof DOMException !== "undefined") {
    return new DOMException("The operation was aborted", "AbortError");
  }

  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

function invalidStream(): never {
  throw new ArenaTransportError("INVALID_RESPONSE");
}

function parseFrame(
  frame: string,
  expectedArenaId: string,
): PublicArenaEventV1 | undefined {
  let id: string | undefined;
  let eventName: string | undefined;
  const data: string[] = [];
  let hasField = false;

  for (const line of frame.split(/\r\n|\n|\r/)) {
    if (line === "" || line.startsWith(":")) continue;
    hasField = true;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    let value = separator === -1 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "id") {
      if (id !== undefined) invalidStream();
      id = value;
    } else if (field === "event") {
      if (eventName !== undefined) invalidStream();
      eventName = value;
    } else if (field === "data") {
      data.push(value);
    } else {
      invalidStream();
    }
  }

  if (!hasField) return undefined;
  if (!id || eventName !== "arena-event" || data.length === 0) invalidStream();
  if (!/^[1-9]\d*$/.test(id)) invalidStream();

  const sequence = Number(id);
  if (!Number.isSafeInteger(sequence)) invalidStream();

  let payload: unknown;
  try {
    payload = JSON.parse(data.join("\n"));
  } catch {
    invalidStream();
  }

  const parsed = publicArenaEventV1Schema.safeParse(payload);
  if (
    !parsed.success ||
    parsed.data.arenaId !== expectedArenaId ||
    parsed.data.sequence !== sequence
  ) {
    invalidStream();
  }

  return parsed.data;
}

function takeFrame(buffer: string) {
  const match = /\r\n\r\n|\n\n|\r\r/.exec(buffer);
  if (!match || match.index === undefined) return undefined;

  return {
    frame: buffer.slice(0, match.index),
    remaining: buffer.slice(match.index + match[0].length),
  };
}

export async function* decodeArenaEventStream(
  body: ReadableStream<Uint8Array>,
  expectedArenaId: string,
  signal: AbortSignal,
): AsyncGenerator<PublicArenaEventV1> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let reachedEnd = false;
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };

  signal.addEventListener("abort", cancel, { once: true });

  try {
    while (true) {
      if (signal.aborted) throw abortError();

      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await reader.read();
      } catch {
        if (signal.aborted) throw abortError();
        throw new ArenaTransportError("NETWORK_FAILURE");
      }

      if (signal.aborted) throw abortError();

      if (result.done) {
        reachedEnd = true;
        buffer += decoder.decode();
        break;
      }

      buffer += decoder.decode(result.value, { stream: true });
      if (buffer.length > MAX_SSE_BUFFER_BYTES) invalidStream();

      let extracted = takeFrame(buffer);
      while (extracted) {
        buffer = extracted.remaining;
        const event = parseFrame(extracted.frame, expectedArenaId);
        if (event) yield event;
        extracted = takeFrame(buffer);
      }
    }

    if (buffer.trim()) {
      const event = parseFrame(buffer, expectedArenaId);
      if (event) yield event;
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    if (!reachedEnd) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
