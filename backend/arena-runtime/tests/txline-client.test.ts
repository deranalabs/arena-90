import { getEventListeners } from "node:events";

import { describe, expect, it } from "vitest";

import {
  TxlineDataError,
  TxlineHttpStatusError,
  createTxlineProviderClient,
  type TxlineHttpRequest,
  type TxlineHttpTransport,
  type TxlineSseTransport,
} from "../src/adapters/data/index.js";

const unusedHttpTransport: TxlineHttpTransport = async () => ({
  status: 200,
  body: "[]",
  bodyLimitExceeded: false,
});

const unusedSseTransport: TxlineSseTransport = async function* () {};

function createConfig() {
  return {
    baseUrl: "https://provider.example.test",
    jwt: "injected-jwt",
    apiToken: "injected-api-token",
    timeoutMs: 1_000,
    maxResponseBytes: 4_096,
    maxSseEvents: 100,
    transport: unusedHttpTransport,
    sseTransport: unusedSseTransport,
  } as const;
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const value of iterable) values.push(value);
  return values;
}

describe("TxLINE provider client", () => {
  it("rejects an invalid base URL before any provider request", () => {
    expect(() =>
      createTxlineProviderClient({
        ...createConfig(),
        baseUrl: "/relative-provider",
      }),
    ).toThrow(
      expect.objectContaining({
        code: "INVALID_PROVIDER_CONFIG",
        message: "Invalid TxLINE provider client configuration",
      }),
    );
  });

  it.each([
    " https://provider.example.test",
    "https://provider.example.test ",
    "HTTPS://provider.example.test",
  ])("rejects noncanonical base URL %j", (baseUrl) => {
    expect(() =>
      createTxlineProviderClient({
        ...createConfig(),
        baseUrl,
      }),
    ).toThrow(
      expect.objectContaining({
        code: "INVALID_PROVIDER_CONFIG",
        message: "Invalid TxLINE provider client configuration",
      }),
    );
  });

  it.each([
    ["timeout", { timeoutMs: 0 }],
    ["byte limit", { maxResponseBytes: 0 }],
    ["event limit", { maxSseEvents: 0 }],
  ])("rejects an invalid %s before any provider request", (_case, override) => {
    expect(() =>
      createTxlineProviderClient({
        ...createConfig(),
        ...override,
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_PROVIDER_CONFIG" }));
  });

  it("rejects control characters in injected authentication config", () => {
    expect(() =>
      createTxlineProviderClient({
        ...createConfig(),
        jwt: "fake-jwt\nInjected-Header: value",
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_PROVIDER_CONFIG" }));
  });

  it("rejects an invalid fixture ID before any provider request", () => {
    let requestCount = 0;
    const client = createTxlineProviderClient({
      ...createConfig(),
      transport: async () => {
        requestCount += 1;
        return { status: 200, body: "[]", bodyLimitExceeded: false };
      },
    });

    expect(() =>
      client.getOddsSnapshot(0, new AbortController().signal),
    ).toThrow(
      expect.objectContaining({
        code: "INVALID_PROVIDER_INPUT",
        message: "Invalid TxLINE fixture ID",
      }),
    );
    expect(requestCount).toBe(0);
  });

  it("sends authenticated bounded GET requests and returns parsed JSON", async () => {
    const requests: TxlineHttpRequest[] = [];
    const transport: TxlineHttpTransport = async (request) => {
      requests.push(request);
      return {
        status: 200,
        body: '{"fixtures":[18185036]}',
        bodyLimitExceeded: false,
      };
    };
    const client = createTxlineProviderClient({
      ...createConfig(),
      transport,
    });
    const callerSignal = new AbortController().signal;

    await expect(client.getFixtureSnapshot(callerSignal)).resolves.toEqual({
      fixtures: [18_185_036],
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: "GET",
      url: "https://provider.example.test/api/fixtures/snapshot",
      headers: {
        Authorization: "Bearer injected-jwt",
        "X-Api-Token": "injected-api-token",
      },
      maxResponseBytes: 4_096,
    });
    expect(requests[0]?.signal).not.toBe(callerSignal);
  });

  it("uses the three approved fixture-scoped JSON endpoints", async () => {
    const urls: string[] = [];
    const client = createTxlineProviderClient({
      ...createConfig(),
      transport: async (request) => {
        urls.push(request.url);
        return { status: 200, body: "[]", bodyLimitExceeded: false };
      },
    });
    const signal = new AbortController().signal;

    await client.getOddsSnapshot(18_185_036, signal);
    await client.getOddsUpdates(18_185_036, signal);
    await client.getScoreSnapshot(18_185_036, signal);

    expect(urls).toEqual([
      "https://provider.example.test/api/odds/snapshot/18185036",
      "https://provider.example.test/api/odds/updates/18185036",
      "https://provider.example.test/api/scores/snapshot/18185036",
    ]);
  });

  it("retries one network failure after the injected 250 ms delay", async () => {
    let attempts = 0;
    const delays: number[] = [];
    const client = createTxlineProviderClient({
      ...createConfig(),
      transport: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("raw transport detail");
        return { status: 200, body: '{"ok":true}', bodyLimitExceeded: false };
      },
      retryDelay: async (delayMs) => {
        delays.push(delayMs);
      },
    });

    await expect(
      client.getFixtureSnapshot(new AbortController().signal),
    ).resolves.toEqual({ ok: true });
    expect(attempts).toBe(2);
    expect(delays).toEqual([250]);
  });

  it("removes the default retry delay abort listener after resolving", async () => {
    let attempts = 0;
    const controller = new AbortController();
    const client = createTxlineProviderClient({
      ...createConfig(),
      transport: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("network failure");
        return { status: 200, body: "[]", bodyLimitExceeded: false };
      },
    });

    await expect(client.getFixtureSnapshot(controller.signal)).resolves.toEqual([]);
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
  });

  it("removes the default retry delay abort listener after caller abort", async () => {
    let attempts = 0;
    const controller = new AbortController();
    const client = createTxlineProviderClient({
      ...createConfig(),
      transport: async () => {
        attempts += 1;
        throw new Error("network failure");
      },
    });
    const request = client.getFixtureSnapshot(controller.signal);
    setTimeout(() => controller.abort(), 5);

    await expect(request).rejects.toMatchObject({
      code: "PROVIDER_ABORTED",
      message: "TxLINE provider request aborted",
    });
    expect(attempts).toBe(1);
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
  });

  it.each([408, 429, 500, 599])(
    "retries approved HTTP status %s exactly once",
    async (status) => {
      let attempts = 0;
      const delays: number[] = [];
      const client = createTxlineProviderClient({
        ...createConfig(),
        transport: async () => {
          attempts += 1;
          return attempts === 1
            ? { status, body: "provider body", bodyLimitExceeded: false }
            : { status: 200, body: "[]", bodyLimitExceeded: false };
        },
        retryDelay: async (delayMs) => {
          delays.push(delayMs);
        },
      });

      await expect(
        client.getFixtureSnapshot(new AbortController().signal),
      ).resolves.toEqual([]);
      expect(attempts).toBe(2);
      expect(delays).toEqual([250]);
    },
  );

  it.each([
    [400, "PROVIDER_HTTP_FAILURE", "TxLINE provider HTTP failure"],
    [
      401,
      "PROVIDER_AUTHENTICATION_FAILURE",
      "TxLINE provider authentication failure",
    ],
    [
      403,
      "PROVIDER_AUTHORIZATION_FAILURE",
      "TxLINE provider authorization failure",
    ],
  ])(
    "does not retry HTTP status %s and returns a sanitized category",
    async (status, code, message) => {
      let attempts = 0;
      let delays = 0;
      const client = createTxlineProviderClient({
        ...createConfig(),
        transport: async () => {
          attempts += 1;
          return {
            status,
            body: "secret provider response body",
            bodyLimitExceeded: false,
          };
        },
        retryDelay: async () => {
          delays += 1;
        },
      });

      await expect(
        client.getFixtureSnapshot(new AbortController().signal),
      ).rejects.toMatchObject({ code, message });
      expect(attempts).toBe(1);
      expect(delays).toBe(0);
    },
  );

  it("sanitizes an exhausted network failure after two attempts", async () => {
    let attempts = 0;
    const client = createTxlineProviderClient({
      ...createConfig(),
      transport: async () => {
        attempts += 1;
        throw new Error("token=secret-value path=/private/provider-config");
      },
      retryDelay: async () => {},
    });

    await expect(
      client.getFixtureSnapshot(new AbortController().signal),
    ).rejects.toMatchObject({
      code: "PROVIDER_NETWORK_FAILURE",
      message: "TxLINE provider network failure",
    });
    expect(attempts).toBe(2);
  });

  it("does not trust or expose a domain-shaped error thrown by transport", async () => {
    let attempts = 0;
    const client = createTxlineProviderClient({
      ...createConfig(),
      transport: async () => {
        attempts += 1;
        throw new TxlineDataError(
          "PROVIDER_NETWORK_FAILURE",
          "secret supplied by transport",
        );
      },
      retryDelay: async () => {},
    });

    await expect(
      client.getFixtureSnapshot(new AbortController().signal),
    ).rejects.toMatchObject({
      code: "PROVIDER_NETWORK_FAILURE",
      message: "TxLINE provider network failure",
    });
    expect(attempts).toBe(2);
  });

  it("sanitizes hostile transport response property access without retry", async () => {
    let attempts = 0;
    const client = createTxlineProviderClient({
      ...createConfig(),
      transport: async () => {
        attempts += 1;
        return Object.defineProperty(
          { body: "[]", bodyLimitExceeded: false },
          "status",
          {
            get() {
              throw new Error("secret hostile response getter");
            },
          },
        ) as never;
      },
      retryDelay: async () => {},
    });

    await expect(
      client.getFixtureSnapshot(new AbortController().signal),
    ).rejects.toMatchObject({
      code: "PROVIDER_INVALID_RESPONSE",
      message: "Invalid TxLINE provider response",
    });
    expect(attempts).toBe(1);
  });

  it("does not retry invalid JSON", async () => {
    let attempts = 0;
    const client = createTxlineProviderClient({
      ...createConfig(),
      transport: async () => {
        attempts += 1;
        return { status: 200, body: "not-json", bodyLimitExceeded: false };
      },
      retryDelay: async () => {},
    });

    await expect(
      client.getFixtureSnapshot(new AbortController().signal),
    ).rejects.toMatchObject({
      code: "PROVIDER_INVALID_RESPONSE",
      message: "Invalid TxLINE provider response",
    });
    expect(attempts).toBe(1);
  });

  it.each([
    ["transport flag", true, 4_096],
    ["client byte count", false, 2],
  ])(
    "enforces the response byte limit using %s",
    async (_case, bodyLimitExceeded, maxResponseBytes) => {
      let attempts = 0;
      const client = createTxlineProviderClient({
        ...createConfig(),
        maxResponseBytes,
        transport: async () => {
          attempts += 1;
          return { status: 200, body: "[] ", bodyLimitExceeded };
        },
        retryDelay: async () => {},
      });

      await expect(
        client.getFixtureSnapshot(new AbortController().signal),
      ).rejects.toMatchObject({ code: "PROVIDER_RESPONSE_LIMIT" });
      expect(attempts).toBe(1);
    },
  );

  it("aborts each timed-out attempt and reports a sanitized timeout", async () => {
    let attempts = 0;
    let abortedAttempts = 0;
    const client = createTxlineProviderClient({
      ...createConfig(),
      timeoutMs: 5,
      transport: (request) => {
        attempts += 1;
        request.signal.addEventListener(
          "abort",
          () => {
            abortedAttempts += 1;
          },
          { once: true },
        );
        return new Promise(() => {});
      },
      retryDelay: async () => {},
    });

    await expect(
      client.getFixtureSnapshot(new AbortController().signal),
    ).rejects.toMatchObject({
      code: "PROVIDER_TIMEOUT",
      message: "TxLINE provider request timed out",
    });
    expect(attempts).toBe(2);
    expect(abortedAttempts).toBe(2);
  });

  it("does not request or retry when the caller signal is already aborted", async () => {
    let attempts = 0;
    const controller = new AbortController();
    controller.abort();
    const client = createTxlineProviderClient({
      ...createConfig(),
      transport: async () => {
        attempts += 1;
        return { status: 200, body: "[]", bodyLimitExceeded: false };
      },
      retryDelay: async () => {},
    });

    await expect(client.getFixtureSnapshot(controller.signal)).rejects.toMatchObject({
      code: "PROVIDER_ABORTED",
      message: "TxLINE provider request aborted",
    });
    expect(attempts).toBe(0);
  });

  it("aborts an injected pending retry delay without a second request", async () => {
    let attempts = 0;
    const controller = new AbortController();
    const client = createTxlineProviderClient({
      ...createConfig(),
      transport: async () => {
        attempts += 1;
        throw new Error("network failure");
      },
      retryDelay: (_delayMs, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          });
          queueMicrotask(() => controller.abort());
        }),
    });

    await expect(client.getFixtureSnapshot(controller.signal)).rejects.toMatchObject({
      code: "PROVIDER_ABORTED",
      message: "TxLINE provider request aborted",
    });
    expect(attempts).toBe(1);
  });

  it("parses bounded historical SSE and ignores frames without JSON data", async () => {
    const urls: string[] = [];
    const client = createTxlineProviderClient({
      ...createConfig(),
      transport: async (request) => {
        urls.push(request.url);
        return {
          status: 200,
          body: [
            ": heartbeat\r\n",
            "\r\n",
            "id: cursor-0\r\n",
            "event: score\r\n",
            'data: {"FixtureId":18185036,\r\n',
            'data: "Seq":0}\r\n',
            "\r\n",
            "id: ignored-heartbeat\n",
            "\n",
            'data: {"Seq":1}',
          ].join(""),
          bodyLimitExceeded: false,
        };
      },
    });

    await expect(
      client.getHistoricalScoreReplay(
        18_185_036,
        new AbortController().signal,
      ),
    ).resolves.toEqual([
      {
        cursor: "cursor-0",
        event: "score",
        data: { FixtureId: 18_185_036, Seq: 0 },
      },
      { cursor: "cursor-0", data: { Seq: 1 } },
    ]);
    expect(urls).toEqual([
      "https://provider.example.test/api/scores/historical/18185036",
    ]);
  });

  it("does not retry malformed historical SSE JSON", async () => {
    let attempts = 0;
    const client = createTxlineProviderClient({
      ...createConfig(),
      transport: async () => {
        attempts += 1;
        return {
          status: 200,
          body: "data: not-json\n\n",
          bodyLimitExceeded: false,
        };
      },
      retryDelay: async () => {},
    });

    await expect(
      client.getHistoricalScoreReplay(
        18_185_036,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      code: "PROVIDER_INVALID_RESPONSE",
      message: "Invalid TxLINE provider response",
    });
    expect(attempts).toBe(1);
  });

  it("enforces the historical SSE event limit", async () => {
    const client = createTxlineProviderClient({
      ...createConfig(),
      maxSseEvents: 1,
      transport: async () => ({
        status: 200,
        body: 'data: {"Seq":0}\n\ndata: {"Seq":1}\n\n',
        bodyLimitExceeded: false,
      }),
    });

    await expect(
      client.getHistoricalScoreReplay(
        18_185_036,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_RESPONSE_LIMIT" });
  });

  it("streams parsed score events across arbitrary UTF-8 chunk boundaries", async () => {
    const requests: TxlineHttpRequest[] = [];
    let bufferedRequests = 0;
    const streamText = [
      ": keepalive\r\n\r\n",
      "id: stream-0\r\n",
      "event: score\r\n",
      'data: {"Seq":0,"team":"Garuda 🦅"}\r\n\r\n',
      'data: {"Seq":1}\n\n',
    ].join("");
    const bytes = new TextEncoder().encode(streamText);
    const client = createTxlineProviderClient({
      ...createConfig(),
      transport: async () => {
        bufferedRequests += 1;
        return { status: 200, body: "[]", bodyLimitExceeded: false };
      },
      sseTransport: async function* (request) {
        requests.push(request);
        for (let offset = 0; offset < bytes.length; offset += 7) {
          yield bytes.subarray(offset, offset + 7);
        }
      },
    });

    const stream = client.getScoreStream(
      18_185_036,
      new AbortController().signal,
    );
    expect(Symbol.asyncIterator in stream).toBe(true);
    await expect(collect(stream)).resolves.toEqual([
      {
        cursor: "stream-0",
        event: "score",
        data: { Seq: 0, team: "Garuda 🦅" },
      },
      { cursor: "stream-0", data: { Seq: 1 } },
    ]);
    expect(bufferedRequests).toBe(0);
    expect(requests[0]).toMatchObject({
      url: "https://provider.example.test/api/scores/stream?fixtureId=18185036",
      headers: {
        Authorization: "Bearer injected-jwt",
        "X-Api-Token": "injected-api-token",
      },
    });
  });

  it("enforces the streaming byte limit inside the client parser", async () => {
    let attempts = 0;
    const client = createTxlineProviderClient({
      ...createConfig(),
      maxResponseBytes: 10,
      sseTransport: async function* () {
        attempts += 1;
        yield new TextEncoder().encode('data: {"Seq":0}\n\n');
      },
      retryDelay: async () => {},
    });

    await expect(
      collect(
        client.getScoreStream(18_185_036, new AbortController().signal),
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_RESPONSE_LIMIT" });
    expect(attempts).toBe(1);
  });

  it("enforces the streaming event limit inside the parser", async () => {
    const client = createTxlineProviderClient({
      ...createConfig(),
      maxSseEvents: 1,
      sseTransport: async function* () {
        yield new TextEncoder().encode(
          'data: {"Seq":0}\n\ndata: {"Seq":1}\n\n',
        );
      },
    });

    await expect(
      collect(
        client.getScoreStream(18_185_036, new AbortController().signal),
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_RESPONSE_LIMIT" });
  });

  it("retries one retryable streaming HTTP failure before emitting data", async () => {
    let attempts = 0;
    const delays: number[] = [];
    const client = createTxlineProviderClient({
      ...createConfig(),
      sseTransport: async function* () {
        attempts += 1;
        if (attempts === 1) throw new TxlineHttpStatusError(500);
        yield new TextEncoder().encode('data: {"Seq":0}\n\n');
      },
      retryDelay: async (delayMs) => {
        delays.push(delayMs);
      },
    });

    await expect(
      collect(
        client.getScoreStream(18_185_036, new AbortController().signal),
      ),
    ).resolves.toEqual([{ data: { Seq: 0 } }]);
    expect(attempts).toBe(2);
    expect(delays).toEqual([250]);
  });

  it("does not retry a stream failure after an event was emitted", async () => {
    let attempts = 0;
    const client = createTxlineProviderClient({
      ...createConfig(),
      sseTransport: async function* () {
        attempts += 1;
        yield new TextEncoder().encode('data: {"Seq":0}\n\n');
        throw new Error("secret stream failure detail");
      },
      retryDelay: async () => {},
    });
    const iterator = client
      .getScoreStream(18_185_036, new AbortController().signal)
      [Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: { data: { Seq: 0 } },
    });
    await expect(iterator.next()).rejects.toMatchObject({
      code: "PROVIDER_NETWORK_FAILURE",
      message: "TxLINE provider network failure",
    });
    expect(attempts).toBe(1);
  });

  it("stops before yielding another parsed event after caller abort", async () => {
    let attempts = 0;
    const controller = new AbortController();
    const client = createTxlineProviderClient({
      ...createConfig(),
      sseTransport: async function* () {
        attempts += 1;
        yield new TextEncoder().encode(
          'data: {"Seq":0}\n\ndata: {"Seq":1}\n\n',
        );
      },
    });
    const iterator = client
      .getScoreStream(18_185_036, controller.signal)
      [Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: { data: { Seq: 0 } },
    });
    controller.abort();
    await expect(iterator.next()).rejects.toMatchObject({
      code: "PROVIDER_ABORTED",
      message: "TxLINE provider request aborted",
    });
    expect(attempts).toBe(1);
  });

  it("does not trust or expose a domain-shaped streaming transport error", async () => {
    let attempts = 0;
    const client = createTxlineProviderClient({
      ...createConfig(),
      sseTransport: async function* () {
        attempts += 1;
        throw new TxlineDataError(
          "PROVIDER_NETWORK_FAILURE",
          "secret supplied by streaming transport",
        );
      },
      retryDelay: async () => {},
    });

    await expect(
      collect(
        client.getScoreStream(18_185_036, new AbortController().signal),
      ),
    ).rejects.toMatchObject({
      code: "PROVIDER_NETWORK_FAILURE",
      message: "TxLINE provider network failure",
    });
    expect(attempts).toBe(2);
  });

  it("times out and aborts two stalled streaming attempts", async () => {
    let attempts = 0;
    let abortedAttempts = 0;
    const client = createTxlineProviderClient({
      ...createConfig(),
      timeoutMs: 5,
      sseTransport(request) {
        attempts += 1;
        request.signal.addEventListener(
          "abort",
          () => {
            abortedAttempts += 1;
          },
          { once: true },
        );
        return {
          [Symbol.asyncIterator]() {
            return {
              next: () => new Promise<IteratorResult<Uint8Array>>(() => {}),
              return: async () => ({ done: true, value: undefined }),
            };
          },
        };
      },
      retryDelay: async () => {},
    });

    await expect(
      collect(
        client.getScoreStream(18_185_036, new AbortController().signal),
      ),
    ).rejects.toMatchObject({
      code: "PROVIDER_TIMEOUT",
      message: "TxLINE provider request timed out",
    });
    expect(attempts).toBe(2);
    expect(abortedAttempts).toBe(2);
  });

  it("does not open a stream for a pre-aborted caller signal", async () => {
    let attempts = 0;
    const controller = new AbortController();
    controller.abort();
    const client = createTxlineProviderClient({
      ...createConfig(),
      sseTransport: async function* () {
        attempts += 1;
        yield new Uint8Array();
      },
    });

    await expect(
      collect(client.getScoreStream(18_185_036, controller.signal)),
    ).rejects.toMatchObject({ code: "PROVIDER_ABORTED" });
    expect(attempts).toBe(0);
  });

  it.each([
    [401, "PROVIDER_AUTHENTICATION_FAILURE"],
    [403, "PROVIDER_AUTHORIZATION_FAILURE"],
  ])("does not retry streaming HTTP status %s", async (status, code) => {
    let attempts = 0;
    const client = createTxlineProviderClient({
      ...createConfig(),
      sseTransport: async function* () {
        attempts += 1;
        throw new TxlineHttpStatusError(status);
      },
      retryDelay: async () => {},
    });

    await expect(
      collect(
        client.getScoreStream(18_185_036, new AbortController().signal),
      ),
    ).rejects.toMatchObject({ code });
    expect(attempts).toBe(1);
  });

  it("rejects malformed UTF-8 streaming data without retry", async () => {
    let attempts = 0;
    const client = createTxlineProviderClient({
      ...createConfig(),
      sseTransport: async function* () {
        attempts += 1;
        yield Uint8Array.from([0xff]);
      },
      retryDelay: async () => {},
    });

    await expect(
      collect(
        client.getScoreStream(18_185_036, new AbortController().signal),
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });
    expect(attempts).toBe(1);
  });

  it("never exposes a streaming iterator cleanup failure", async () => {
    const client = createTxlineProviderClient({
      ...createConfig(),
      sseTransport() {
        return {
          [Symbol.asyncIterator]() {
            return {
              next: async () => {
                throw new Error("raw stream failure with secret");
              },
              return: async () => {
                throw new Error("raw cleanup failure with secret");
              },
            };
          },
        };
      },
      retryDelay: async () => {},
    });

    await expect(
      collect(
        client.getScoreStream(18_185_036, new AbortController().signal),
      ),
    ).rejects.toMatchObject({
      code: "PROVIDER_NETWORK_FAILURE",
      message: "TxLINE provider network failure",
    });
  });
});
