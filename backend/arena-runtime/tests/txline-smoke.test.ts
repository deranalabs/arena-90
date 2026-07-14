import { describe, expect, it } from "vitest";

import {
  formatTxlineConnectivitySmokeResult,
  runTxlineConnectivitySmoke,
} from "../src/adapters/data/txline/connectivity-smoke.js";

describe("TxLINE connectivity smoke", () => {
  it("uses only mapped file credentials and lets explicit environment values win", async () => {
    const readPaths: string[] = [];
    const requests: Array<{
      input: string | URL | Request;
      init?: RequestInit;
    }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ input, ...(init === undefined ? {} : { init }) });
      const url = String(input);
      if (url.includes("/api/scores/stream?")) {
        return new Response('data: {"Seq":0}\n\n', { status: 200 });
      }
      return new Response(url.includes("/historical/") ? "" : "[]", {
        status: 200,
      });
    };

    const result = await runTxlineConnectivitySmoke({
      env: {
        TXLINE_BASE_URL: "https://environment.example.test",
        TXLINE_JWT: "environment-jwt",
        TXLINE_API_TOKEN: "environment-api-token",
        TXLINE_TIMEOUT_MS: "1000",
        TXLINE_MAX_RESPONSE_BYTES: "4096",
        TXLINE_MAX_SSE_EVENTS: "100",
        TXLINE_FIXTURE_ID: "18185036",
        TXLINE_CREDENTIALS_FILE: "/outside-git/credentials.json",
      },
      fetch: fetchImpl,
      readFile: async (path) => {
        readPaths.push(path);
        return JSON.stringify({
          apiOrigin: "https://file.example.test",
          jwt: "file-jwt",
          apiToken: "file-api-token",
          walletSecret: "must-not-be-mapped",
        });
      },
    });

    expect(result).toEqual({ status: "PASSED" });
    expect(formatTxlineConnectivitySmokeResult(result)).toBe(
      "TxLINE connectivity smoke passed.",
    );
    expect(readPaths).toEqual(["/outside-git/credentials.json"]);
    expect(requests).toHaveLength(6);
    for (const request of requests) {
      expect(
        String(request.input).startsWith(
          "https://environment.example.test/",
        ),
      ).toBe(true);
      expect(request.init?.headers).toEqual({
        Authorization: "Bearer environment-jwt",
        "X-Api-Token": "environment-api-token",
      });
    }
  });

  it("maps only apiOrigin, jwt, and apiToken from the explicit credential file", async () => {
    const requests: Array<{
      input: string | URL | Request;
      init?: RequestInit;
    }> = [];
    const result = await runTxlineConnectivitySmoke({
      env: {
        TXLINE_TIMEOUT_MS: "1000",
        TXLINE_MAX_RESPONSE_BYTES: "4096",
        TXLINE_MAX_SSE_EVENTS: "100",
        TXLINE_FIXTURE_ID: "18185036",
        TXLINE_CREDENTIALS_FILE: "/outside-git/credentials.json",
      },
      fetch: async (input, init) => {
        requests.push({ input, ...(init === undefined ? {} : { init }) });
        const url = String(input);
        return new Response(
          url.includes("/api/scores/stream?")
            ? 'data: {"Seq":0}\n\n'
            : url.includes("/historical/")
              ? ""
              : "[]",
          { status: 200 },
        );
      },
      readFile: async () =>
        JSON.stringify({
          apiOrigin: "https://file.example.test",
          jwt: "file-jwt",
          apiToken: "file-api-token",
          TXLINE_BASE_URL: "https://must-be-ignored.example.test",
          walletSecret: "must-not-be-mapped",
        }),
    });

    expect(result).toEqual({ status: "PASSED" });
    expect(requests[0]).toMatchObject({
      input: "https://file.example.test/api/fixtures/snapshot",
      init: {
        headers: {
          Authorization: "Bearer file-jwt",
          "X-Api-Token": "file-api-token",
        },
      },
    });
  });

  it("uses credential file values when credential environment values are empty", async () => {
    const requests: Array<{
      input: string | URL | Request;
      init?: RequestInit;
    }> = [];
    const result = await runTxlineConnectivitySmoke({
      env: {
        TXLINE_BASE_URL: "",
        TXLINE_JWT: "",
        TXLINE_API_TOKEN: "",
        TXLINE_TIMEOUT_MS: "1000",
        TXLINE_MAX_RESPONSE_BYTES: "4096",
        TXLINE_MAX_SSE_EVENTS: "100",
        TXLINE_FIXTURE_ID: "18185036",
        TXLINE_CREDENTIALS_FILE: "/outside-git/credentials.json",
      },
      fetch: async (input, init) => {
        requests.push({ input, ...(init === undefined ? {} : { init }) });
        const url = String(input);
        return new Response(
          url.includes("/api/scores/stream?")
            ? 'data: {"Seq":0}\n\n'
            : url.includes("/historical/")
              ? ""
              : "[]",
          { status: 200 },
        );
      },
      readFile: async () =>
        JSON.stringify({
          apiOrigin: "https://file.example.test",
          jwt: "file-jwt",
          apiToken: "file-api-token",
        }),
    });

    expect(result).toEqual({ status: "PASSED" });
    expect(requests[0]).toMatchObject({
      input: "https://file.example.test/api/fixtures/snapshot",
      init: {
        headers: {
          Authorization: "Bearer file-jwt",
          "X-Api-Token": "file-api-token",
        },
      },
    });
  });

  it("reduces credential file failures to a sanitized config category", async () => {
    let fetchCalls = 0;
    const result = await runTxlineConnectivitySmoke({
      env: {
        TXLINE_TIMEOUT_MS: "1000",
        TXLINE_MAX_RESPONSE_BYTES: "4096",
        TXLINE_MAX_SSE_EVENTS: "100",
        TXLINE_FIXTURE_ID: "18185036",
        TXLINE_CREDENTIALS_FILE: "/private/path-containing-secret.json",
      },
      fetch: async () => {
        fetchCalls += 1;
        return new Response("[]", { status: 200 });
      },
      readFile: async () => {
        throw new Error("raw file error with jwt-value");
      },
    });

    expect(result).toEqual({ status: "CONFIG_FAILURE" });
    expect(formatTxlineConnectivitySmokeResult(result)).toBe(
      "TxLINE connectivity smoke failed: CONFIG_FAILURE.",
    );
    expect(fetchCalls).toBe(0);
  });

  it("requires TXLINE_FIXTURE_ID separately from credential file content", async () => {
    let fetchCalls = 0;
    const result = await runTxlineConnectivitySmoke({
      env: {
        TXLINE_TIMEOUT_MS: "1000",
        TXLINE_MAX_RESPONSE_BYTES: "4096",
        TXLINE_MAX_SSE_EVENTS: "100",
        TXLINE_CREDENTIALS_FILE: "/outside-git/credentials.json",
      },
      fetch: async () => {
        fetchCalls += 1;
        return new Response("[]", { status: 200 });
      },
      readFile: async () =>
        JSON.stringify({
          apiOrigin: "https://file.example.test",
          jwt: "file-jwt",
          apiToken: "file-api-token",
          fixtureId: 18_185_036,
        }),
    });

    expect(result).toEqual({ status: "CONFIG_FAILURE" });
    expect(fetchCalls).toBe(0);
  });

  it("never exposes an authentication response body", async () => {
    let fetchCalls = 0;
    const result = await runTxlineConnectivitySmoke({
      env: {
        TXLINE_BASE_URL: "https://provider.example.test",
        TXLINE_JWT: "environment-jwt",
        TXLINE_API_TOKEN: "environment-api-token",
        TXLINE_TIMEOUT_MS: "1000",
        TXLINE_MAX_RESPONSE_BYTES: "4096",
        TXLINE_MAX_SSE_EVENTS: "100",
        TXLINE_FIXTURE_ID: "18185036",
      },
      fetch: async () => {
        fetchCalls += 1;
        return new Response("secret response body with token-value", {
          status: 401,
        });
      },
      readFile: async () => {
        throw new Error("credential file must not be discovered implicitly");
      },
    });

    expect(result).toEqual({ status: "AUTHENTICATION_FAILURE" });
    expect(formatTxlineConnectivitySmokeResult(result)).toBe(
      "TxLINE connectivity smoke failed: AUTHENTICATION_FAILURE.",
    );
    expect(fetchCalls).toBe(1);
  });

  it(
    "times out when the score stream sends heartbeats without JSON data",
    async () => {
      let streamCancelCalls = 0;
      const result = await runTxlineConnectivitySmoke({
        env: {
          TXLINE_BASE_URL: "https://provider.example.test",
          TXLINE_JWT: "environment-jwt",
          TXLINE_API_TOKEN: "environment-api-token",
          TXLINE_TIMEOUT_MS: "20",
          TXLINE_MAX_RESPONSE_BYTES: "4096",
          TXLINE_MAX_SSE_EVENTS: "100",
          TXLINE_FIXTURE_ID: "18185036",
        },
        fetch: async (input) => {
          const url = String(input);
          if (url.includes("/api/scores/stream?")) {
            return new Response(
              new ReadableStream<Uint8Array>({
                async pull(controller) {
                  await new Promise((resolve) => setTimeout(resolve, 1));
                  controller.enqueue(
                    new TextEncoder().encode(": heartbeat\n\n"),
                  );
                },
                cancel() {
                  streamCancelCalls += 1;
                },
              }),
              { status: 200 },
            );
          }
          return new Response(url.includes("/historical/") ? "" : "[]", {
            status: 200,
          });
        },
        readFile: async () => {
          throw new Error("credential file must not be discovered implicitly");
        },
      });

      expect(result).toEqual({ status: "TIMEOUT_FAILURE" });
      expect(streamCancelCalls).toBe(1);
    },
    200,
  );
});
