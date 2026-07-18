import { ReadableStream } from "node:stream/web";
import { TextDecoder as NodeTextDecoder, TextEncoder } from "node:util";

import {
  ArenaTransportError,
  createRuntimeTransport,
} from "@/lib/arena-api/transport";

import { publicEvent, publicHistory, publicState } from "../test-support/arena-api-fixtures";

Object.defineProperty(globalThis, "TextDecoder", {
  configurable: true,
  value: NodeTextDecoder,
});

function headers(contentType: string) {
  return { get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null) };
}

function jsonResponse(
  value: unknown,
  status = 200,
  contentType = "application/json; charset=utf-8",
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headers(contentType),
    json: async () => value,
  } as Response;
}

function sseResponse(
  chunks: string[],
  status = 200,
  contentType = "text/event-stream; charset=utf-8",
) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headers(contentType),
    body,
  } as unknown as Response;
}

async function collect<T>(values: AsyncIterable<T>) {
  const collected: T[] = [];
  for await (const value of values) collected.push(value);
  return collected;
}

describe("same-origin runtime transport", () => {
  it("reads strict state and history from relative same-origin URLs", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(publicState()))
      .mockResolvedValueOnce(
        jsonResponse(publicHistory([publicEvent(2), publicEvent(3)], 1)),
      );
    const transport = createRuntimeTransport({ fetcher });

    await expect(transport.readState("arena-replay-001")).resolves.toMatchObject({
      phase: "READY",
    });
    await expect(transport.readHistory("arena-replay-001", 1)).resolves.toMatchObject({
      lastEventSequence: 3,
    });

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/arenas/arena-replay-001",
      "/api/arenas/arena-replay-001/events?after=1",
    ]);
    expect(fetcher.mock.calls.every(([url]) => String(url).startsWith("/"))).toBe(true);
  });

  it("fails closed when an HTTP payload contains non-public fields", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      jsonResponse(publicState({ rawProviderPayload: { private: true } })),
    );
    const transport = createRuntimeTransport({ fetcher });

    await expect(transport.readState("arena-replay-001")).rejects.toMatchObject({
      name: "ArenaTransportError",
      category: "INVALID_RESPONSE",
    });
  });

  it("rejects valid-shaped HTTP data bound to a different arena or cursor", async () => {
    const otherArena = publicState();
    otherArena.manifest.arenaId = "other-arena";
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(otherArena))
      .mockResolvedValueOnce(
        jsonResponse({
          schemaVersion: 1,
          arenaId: "arena-replay-001",
          afterSequence: 2,
          lastEventSequence: 2,
          events: [],
        }),
      );
    const transport = createRuntimeTransport({ fetcher });

    await expect(transport.readState("arena-replay-001")).rejects.toMatchObject({
      category: "INVALID_RESPONSE",
    });
    await expect(transport.readHistory("arena-replay-001", 1)).rejects.toMatchObject({
      category: "INVALID_RESPONSE",
    });
  });

  it("requires non-success HTTP responses to use the strict public error envelope", async () => {
    const transport = createRuntimeTransport({
      fetcher: jest.fn().mockResolvedValue(
        jsonResponse(
          {
            schemaVersion: 1,
            error: {
              code: "ARENA_NOT_FOUND",
              message: "Arena not found",
              rawStoreError: "private",
            },
          },
          404,
        ),
      ),
    });

    await expect(transport.readState("arena-replay-001")).rejects.toMatchObject({
      category: "INVALID_RESPONSE",
    });
  });

  it("rejects MIME prefixes with invalid suffixes", async () => {
    const jsonTransport = createRuntimeTransport({
      fetcher: jest
        .fn()
        .mockResolvedValue(jsonResponse(publicState(), 200, "application/json-junk")),
    });
    await expect(jsonTransport.readState("arena-replay-001")).rejects.toMatchObject({
      category: "INVALID_RESPONSE",
    });

    const sseTransport = createRuntimeTransport({
      fetcher: jest
        .fn()
        .mockResolvedValue(sseResponse([], 200, "text/event-stream-junk")),
    });
    await expect(
      sseTransport.streamEvents(
        "arena-replay-001",
        0,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ category: "INVALID_RESPONSE" });
  });

  it("accepts normalized JSON and SSE media types with parameters", async () => {
    const event = publicEvent(1);
    const wire = `id: 1\nevent: arena-event\ndata: ${JSON.stringify(event)}\n\n`;
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(publicState(), 200, "Application/JSON; Charset=UTF-8"),
      )
      .mockResolvedValueOnce(
        sseResponse([wire], 200, "Text/Event-Stream ; charset=utf-8"),
      );
    const transport = createRuntimeTransport({ fetcher });

    await expect(transport.readState("arena-replay-001")).resolves.toMatchObject({
      phase: "READY",
    });
    const stream = await transport.streamEvents(
      "arena-replay-001",
      0,
      new AbortController().signal,
    );
    if (stream.status !== "OPEN") throw new Error("Expected open stream");
    await expect(collect(stream.events)).resolves.toEqual([event]);
  });

  it("streams chunked arena events, ignores heartbeat comments, and validates IDs", async () => {
    const second = publicEvent(2);
    const third = publicEvent(3, "AGENTS_ANALYZING", {
      checkpointId: "KICKOFF",
    });
    const wire =
      `: heartbeat\n\n` +
      `id: 2\nevent: arena-event\ndata: ${JSON.stringify(second)}\n\n` +
      `id: 3\nevent: arena-event\ndata: ${JSON.stringify(third)}\n\n`;
    const fetcher = jest
      .fn()
      .mockResolvedValue(sseResponse([wire.slice(0, 31), wire.slice(31)]));
    const transport = createRuntimeTransport({ fetcher });
    const stream = await transport.streamEvents(
      "arena-replay-001",
      1,
      new AbortController().signal,
    );

    expect(stream.status).toBe("OPEN");
    if (stream.status !== "OPEN") throw new Error("Expected open stream");
    await expect(collect(stream.events)).resolves.toEqual([second, third]);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/arenas/arena-replay-001/events/stream",
      expect.objectContaining({
        headers: expect.objectContaining({ "Last-Event-ID": "1" }),
      }),
    );
  });

  it("rejects mismatched SSE IDs and reports terminal 204 without opening a stream", async () => {
    const invalidWire = `id: 9\nevent: arena-event\ndata: ${JSON.stringify(publicEvent(2))}\n\n`;
    const invalidTransport = createRuntimeTransport({
      fetcher: jest.fn().mockResolvedValue(sseResponse([invalidWire])),
    });
    const invalid = await invalidTransport.streamEvents(
      "arena-replay-001",
      1,
      new AbortController().signal,
    );

    if (invalid.status !== "OPEN") throw new Error("Expected open stream");
    await expect(collect(invalid.events)).rejects.toBeInstanceOf(ArenaTransportError);

    const terminalTransport = createRuntimeTransport({
      fetcher: jest.fn().mockResolvedValue(sseResponse([], 204)),
    });
    await expect(
      terminalTransport.streamEvents(
        "arena-replay-001",
        3,
        new AbortController().signal,
      ),
    ).resolves.toEqual({ status: "TERMINAL" });
  });

  it("aborts and cancels a hanging SSE reader", async () => {
    let readerCancelled = false;
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        readerCancelled = true;
      },
    });
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: headers("text/event-stream"),
      body,
    } as unknown as Response);
    const transport = createRuntimeTransport({ fetcher });
    const controller = new AbortController();
    const stream = await transport.streamEvents(
      "arena-replay-001",
      0,
      controller.signal,
    );
    if (stream.status !== "OPEN") throw new Error("Expected open stream");

    const reading = collect(stream.events);
    await Promise.resolve();
    controller.abort();

    await expect(reading).rejects.toMatchObject({ name: "AbortError" });
    expect(readerCancelled).toBe(true);
  });
});
