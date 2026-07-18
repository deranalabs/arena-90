import { describe, expect, it } from "vitest";

import {
  createTxlineProviderClientFromEnv,
  createTxlineNodeTransports,
  type TxlineHttpRequest,
} from "../src/adapters/data/index.js";

function request(overrides: Partial<TxlineHttpRequest> = {}): TxlineHttpRequest {
  return {
    method: "GET",
    url: "https://provider.example.test/api/fixtures/snapshot",
    headers: {
      Authorization: "Bearer injected-jwt",
      "X-Api-Token": "injected-api-token",
    },
    signal: new AbortController().signal,
    maxResponseBytes: 1_024,
    ...overrides,
  };
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const value of iterable) values.push(value);
  return values;
}

describe("TxLINE Node transports", () => {
  it("performs a bounded buffered request without following redirects", async () => {
    const calls: Array<{
      input: string | URL | Request;
      init?: RequestInit;
    }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ input, ...(init === undefined ? {} : { init }) });
      return new Response('[{"FixtureId":18185036}]', { status: 200 });
    };
    const { transport } = createTxlineNodeTransports(fetchImpl);
    const inputRequest = request();

    await expect(transport(inputRequest)).resolves.toEqual({
      status: 200,
      body: '[{"FixtureId":18185036}]',
      bodyLimitExceeded: false,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      input: "https://provider.example.test/api/fixtures/snapshot",
      init: {
        method: "GET",
        redirect: "error",
        headers: {
          Authorization: "Bearer injected-jwt",
          "X-Api-Token": "injected-api-token",
        },
      },
    });
    expect(calls[0]?.init?.signal).toBe(inputRequest.signal);
  });

  it("does not open an SSE fetch for a pre-aborted request", async () => {
    let fetchCalls = 0;
    const fetchImpl: typeof fetch = async () => {
      fetchCalls += 1;
      return new Response('data: {"Seq":0}\n\n', { status: 200 });
    };
    const controller = new AbortController();
    controller.abort();
    const { sseTransport } = createTxlineNodeTransports(fetchImpl);

    await expect(
      collect(sseTransport(request({ signal: controller.signal }))),
    ).rejects.toThrow("TxLINE Node SSE transport failure");
    expect(fetchCalls).toBe(0);
  });

  it("does not open a buffered fetch for a pre-aborted request", async () => {
    let fetchCalls = 0;
    const fetchImpl: typeof fetch = async () => {
      fetchCalls += 1;
      return new Response("[]", { status: 200 });
    };
    const controller = new AbortController();
    controller.abort();
    const { transport } = createTxlineNodeTransports(fetchImpl);

    await expect(
      transport(request({ signal: controller.signal })),
    ).rejects.toThrow("TxLINE Node HTTP transport failure");
    expect(fetchCalls).toBe(0);
  });

  it("cancels a buffered response as soon as its byte limit is exceeded", async () => {
    let cancelCalls = 0;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("12345"));
      },
      cancel() {
        cancelCalls += 1;
      },
    });
    const { transport } = createTxlineNodeTransports(
      async () => new Response(body, { status: 200 }),
    );

    await expect(
      transport(request({ maxResponseBytes: 4 })),
    ).resolves.toEqual({
      status: 200,
      body: "",
      bodyLimitExceeded: true,
    });
    expect(cancelCalls).toBe(1);
  });

  it("cancels an open SSE response when its consumer stops", async () => {
    let cancelCalls = 0;
    const bytes = new TextEncoder().encode('data: {"Seq":0}\n\n');
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
      },
      cancel() {
        cancelCalls += 1;
      },
    });
    const { sseTransport } = createTxlineNodeTransports(
      async () => new Response(body, { status: 200 }),
    );
    const iterator = sseTransport(request())[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: bytes,
    });
    await iterator.return?.();

    expect(cancelCalls).toBe(1);
  });

  it("cancels an SSE error response and exposes only its status", async () => {
    let cancelCalls = 0;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("secret response body"));
      },
      cancel() {
        cancelCalls += 1;
      },
    });
    const { sseTransport } = createTxlineNodeTransports(
      async () => new Response(body, { status: 401 }),
    );

    await expect(collect(sseTransport(request()))).rejects.toMatchObject({
      name: "TxlineHttpStatusError",
      message: "TxLINE streaming transport returned an HTTP failure",
      status: 401,
    });
    expect(cancelCalls).toBe(1);
  });

  it("cancels and releases a buffered reader after a read failure", async () => {
    let cancelCalls = 0;
    let releaseCalls = 0;
    const reader = {
      read: async () => {
        throw new Error("raw read failure with credential-value");
      },
      cancel: async () => {
        cancelCalls += 1;
      },
      releaseLock: () => {
        releaseCalls += 1;
      },
    };
    const response = {
      status: 200,
      body: { getReader: () => reader },
    } as unknown as Response;
    const { transport } = createTxlineNodeTransports(async () => response);

    await expect(transport(request())).rejects.toThrow(
      "TxLINE Node HTTP transport failure",
    );
    expect({ cancelCalls, releaseCalls }).toEqual({
      cancelCalls: 1,
      releaseCalls: 1,
    });
  });
});

describe("TxLINE Node provider configuration", () => {
  it("creates the runtime client only from explicit environment values", async () => {
    const requests: Array<{
      input: string | URL | Request;
      init?: RequestInit;
    }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ input, ...(init === undefined ? {} : { init }) });
      return new Response("[]", { status: 200 });
    };
    const client = createTxlineProviderClientFromEnv({
      env: {
        TXLINE_BASE_URL: "https://provider.example.test",
        TXLINE_JWT: "runtime-jwt",
        TXLINE_API_TOKEN: "runtime-api-token",
        TXLINE_TIMEOUT_MS: "1000",
        TXLINE_MAX_RESPONSE_BYTES: "4096",
        TXLINE_MAX_SSE_EVENTS: "100",
        TXLINE_CREDENTIALS_FILE: "/must/not/be/read.json",
      },
      fetch: fetchImpl,
    });

    await expect(
      client.getFixtureSnapshot(new AbortController().signal),
    ).resolves.toEqual([]);
    expect(requests[0]).toMatchObject({
      input: "https://provider.example.test/api/fixtures/snapshot",
      init: {
        headers: {
          Authorization: "Bearer runtime-jwt",
          "X-Api-Token": "runtime-api-token",
        },
      },
    });
  });

  it("does not use the smoke-only credential file for runtime configuration", () => {
    expect(() =>
      createTxlineProviderClientFromEnv({
        env: {
          TXLINE_TIMEOUT_MS: "1000",
          TXLINE_MAX_RESPONSE_BYTES: "4096",
          TXLINE_MAX_SSE_EVENTS: "100",
          TXLINE_CREDENTIALS_FILE: "/outside-git/credentials.json",
        },
        fetch: async () => new Response("[]", { status: 200 }),
      }),
    ).toThrow(
      expect.objectContaining({
        code: "INVALID_PROVIDER_CONFIG",
      }),
    );
  });

  it("preserves response limit without retry when reader cancellation fails", async () => {
    let fetchCalls = 0;
    let cancelCalls = 0;
    const client = createTxlineProviderClientFromEnv({
      env: {
        TXLINE_BASE_URL: "https://provider.example.test",
        TXLINE_JWT: "runtime-jwt",
        TXLINE_API_TOKEN: "runtime-api-token",
        TXLINE_TIMEOUT_MS: "1000",
        TXLINE_MAX_RESPONSE_BYTES: "4",
        TXLINE_MAX_SSE_EVENTS: "100",
      },
      fetch: async () => {
        fetchCalls += 1;
        const reader = {
          read: async () => ({
            done: false as const,
            value: new TextEncoder().encode("12345"),
          }),
          cancel: async () => {
            cancelCalls += 1;
            throw new Error("raw cancellation failure with credential-value");
          },
          releaseLock: () => undefined,
        };
        return {
          status: 200,
          body: { getReader: () => reader },
        } as unknown as Response;
      },
    });

    await expect(
      client.getFixtureSnapshot(new AbortController().signal),
    ).rejects.toMatchObject({
      code: "PROVIDER_RESPONSE_LIMIT",
      message: "TxLINE provider response limit exceeded",
    });
    expect({ fetchCalls, cancelCalls }).toEqual({
      fetchCalls: 1,
      cancelCalls: 1,
    });
  });
});
