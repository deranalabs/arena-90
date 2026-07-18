import type { TxlineSseEvent } from "./domain.js";
import { TxlineDataError } from "./domain.js";

interface TxlineSseParser {
  push(chunk: Uint8Array): readonly TxlineSseEvent[];
  finish(): readonly TxlineSseEvent[];
}

function invalidResponse(): TxlineDataError {
  return new TxlineDataError(
    "PROVIDER_INVALID_RESPONSE",
    "Invalid TxLINE provider response",
  );
}

function responseLimit(): TxlineDataError {
  return new TxlineDataError(
    "PROVIDER_RESPONSE_LIMIT",
    "TxLINE provider response limit exceeded",
  );
}

export function createTxlineSseParser(
  maxResponseBytes: number,
  maxSseEvents: number,
): TxlineSseParser {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bufferedText = "";
  let receivedBytes = 0;
  let emittedEvents = 0;
  let dataLines: string[] = [];
  let frameCursor: string | undefined;
  let frameEvent: string | undefined;
  let lastCursor: string | undefined;

  function resetFrame(): void {
    dataLines = [];
    frameCursor = undefined;
    frameEvent = undefined;
  }

  function dispatchFrame(): TxlineSseEvent | undefined {
    if (dataLines.length === 0) {
      resetFrame();
      return undefined;
    }

    let data: unknown;
    try {
      data = JSON.parse(dataLines.join("\n")) as unknown;
    } catch {
      throw invalidResponse();
    }

    emittedEvents += 1;
    if (emittedEvents > maxSseEvents) throw responseLimit();
    if (frameCursor !== undefined) lastCursor = frameCursor;

    const result = Object.freeze({
      ...(lastCursor === undefined ? {} : { cursor: lastCursor }),
      ...(frameEvent === undefined ? {} : { event: frameEvent }),
      data,
    });
    resetFrame();
    return result;
  }

  function processLine(line: string): TxlineSseEvent | undefined {
    if (line === "") return dispatchFrame();
    if (line.startsWith(":")) return undefined;

    const colonIndex = line.indexOf(":");
    const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
    let value = colonIndex === -1 ? "" : line.slice(colonIndex + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "data") {
      dataLines.push(value);
    } else if (field === "id") {
      if (value.includes("\u0000")) throw invalidResponse();
      frameCursor = value;
    } else if (field === "event") {
      frameEvent = value;
    }

    return undefined;
  }

  function drainLines(final: boolean): TxlineSseEvent[] {
    const events: TxlineSseEvent[] = [];
    while (bufferedText.length > 0) {
      const lineEnd = bufferedText.search(/[\r\n]/);
      if (lineEnd === -1) break;

      const delimiter = bufferedText[lineEnd];
      if (
        delimiter === "\r" &&
        lineEnd === bufferedText.length - 1 &&
        !final
      ) {
        break;
      }

      const line = bufferedText.slice(0, lineEnd);
      const delimiterLength =
        delimiter === "\r" && bufferedText[lineEnd + 1] === "\n" ? 2 : 1;
      bufferedText = bufferedText.slice(lineEnd + delimiterLength);
      const event = processLine(line);
      if (event !== undefined) events.push(event);
    }

    if (final) {
      if (bufferedText !== "") {
        const event = processLine(bufferedText);
        if (event !== undefined) events.push(event);
        bufferedText = "";
      }
      const trailingEvent = dispatchFrame();
      if (trailingEvent !== undefined) events.push(trailingEvent);
    }

    return events;
  }

  return {
    push(chunk) {
      if (!(chunk instanceof Uint8Array)) throw invalidResponse();
      receivedBytes += chunk.byteLength;
      if (receivedBytes > maxResponseBytes) throw responseLimit();

      try {
        bufferedText += decoder.decode(chunk, { stream: true });
      } catch {
        throw invalidResponse();
      }
      return drainLines(false);
    },
    finish() {
      try {
        bufferedText += decoder.decode();
      } catch {
        throw invalidResponse();
      }
      return drainLines(true);
    },
  };
}
