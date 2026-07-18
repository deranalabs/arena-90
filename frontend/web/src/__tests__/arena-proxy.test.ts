/** @jest-environment node */

import { proxyArenaRequest } from "@/lib/arena-api/proxy";
import { publicState } from "@/test-support/arena-api-fixtures";

describe("Arena runtime same-origin proxy", () => {
  it("preserves the configured runtime response mode without alternate fallback", async () => {
    const replayState = publicState();
    const fetcher = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(replayState), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      }),
    );
    const request = new Request(
      "http://frontend.local/api/arenas/arena-replay-001?view=state",
      { headers: { Accept: "application/json" } },
    );

    const response = await proxyArenaRequest(request, {
      runtimeOrigin: "http://127.0.0.1:3100",
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:3100/api/arenas/arena-replay-001?view=state",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
    expect(await response.json()).toMatchObject({
      manifest: { mode: "REPLAY" },
    });
  });

  it("does not retry another runtime when the configured origin fails", async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error("upstream unavailable"));
    const response = await proxyArenaRequest(
      new Request("http://frontend.local/api/arenas/arena-replay-001"),
      { runtimeOrigin: "http://127.0.0.1:3100", fetcher },
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      schemaVersion: 1,
      error: { code: "NOT_READY", message: "Arena runtime unavailable" },
    });
  });

  it("forwards the SSE cursor and streams the upstream body unchanged", async () => {
    const frame = "id: 2\nevent: arena-event\ndata: {\"sequence\":2}\n\n";
    const fetcher = jest.fn().mockResolvedValue(
      new Response(frame, {
        headers: { "content-type": "text/event-stream; charset=utf-8" },
      }),
    );
    const response = await proxyArenaRequest(
      new Request(
        "http://frontend.local/api/arenas/arena-replay-001/events/stream",
        {
          headers: {
            Accept: "text/event-stream",
            "Last-Event-ID": "1",
          },
        },
      ),
      { runtimeOrigin: "http://127.0.0.1:3100", fetcher },
    );

    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Last-Event-ID")).toBe("1");
    expect(response.headers.get("content-type")).toBe(
      "text/event-stream; charset=utf-8",
    );
    expect(await response.text()).toBe(frame);
  });

  it("rejects public write methods without contacting the runtime", async () => {
    const fetcher = jest.fn();
    const response = await proxyArenaRequest(
      new Request(
        "http://frontend.local/api/arenas/arena-replay-001/run?source=foundation",
        {
          method: "POST",
          body: JSON.stringify({ requestedBy: "spectator" }),
        },
      ),
      { runtimeOrigin: "http://127.0.0.1:3100", fetcher },
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects upstream redirects instead of following or exposing them", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(null, {
        status: 307,
        headers: { Location: "http://alternate-runtime.local/api/arenas" },
      }),
    );

    const response = await proxyArenaRequest(
      new Request("http://frontend.local/api/arenas/arena-replay-001"),
      { runtimeOrigin: "http://127.0.0.1:3100", fetcher },
    );

    expect(response.status).toBe(503);
    expect(response.headers.has("location")).toBe(false);
    expect(await response.json()).toEqual({
      schemaVersion: 1,
      error: { code: "NOT_READY", message: "Arena runtime unavailable" },
    });
  });

  it("fails closed when the runtime origin is absent or unsafe", async () => {
    const fetcher = jest.fn();

    for (const runtimeOrigin of [undefined, "http://user:pass@runtime.local"] as const) {
      const response = await proxyArenaRequest(
        new Request("http://frontend.local/api/arenas/arena-replay-001"),
        { runtimeOrigin, fetcher },
      );
      expect(response.status).toBe(503);
    }

    expect(fetcher).not.toHaveBeenCalled();
  });
});
