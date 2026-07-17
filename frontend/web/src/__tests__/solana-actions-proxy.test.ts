/** @jest-environment node */

import { proxySolanaActionRequest } from "@/lib/solana-actions/proxy";

describe("Solana Actions same-origin proxy", () => {
  it("forwards only Action GET and POST requests to the configured origin", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      Response.json({ type: "action", label: "Choose an agent" }),
    );

    const getResponse = await proxySolanaActionRequest(
      new Request("https://arena-90.vercel.app/actions/arena/arena-pda"),
      { actionsOrigin: "https://actions.internal.example", fetcher },
    );
    const postResponse = await proxySolanaActionRequest(
      new Request(
        "https://arena-90.vercel.app/actions/arena/arena-pda/back/alpha?amount=0.01",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ account: "supporter-wallet" }),
        },
      ),
      { actionsOrigin: "https://actions.internal.example", fetcher },
    );

    expect(getResponse.status).toBe(200);
    expect(postResponse.status).toBe(200);
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "https://actions.internal.example/actions/arena/arena-pda",
      expect.objectContaining({ method: "GET", redirect: "manual" }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://actions.internal.example/actions/arena/arena-pda/back/alpha?amount=0.01",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ account: "supporter-wallet" }) }),
    );
  });

  it("rejects unrelated paths, unsafe origins, oversized bodies, and other methods", async () => {
    const fetcher = jest.fn();
    const cases = [
      new Request("https://arena-90.vercel.app/not-actions"),
      new Request("https://arena-90.vercel.app/actions/arena/pda", { method: "DELETE" }),
      new Request("https://arena-90.vercel.app/actions/arena/pda", {
        method: "POST",
        body: "x".repeat(8_193),
      }),
    ];

    for (const request of cases) {
      const response = await proxySolanaActionRequest(request, {
        actionsOrigin: "https://actions.internal.example",
        fetcher,
      });
      expect(response.status).toBeGreaterThanOrEqual(400);
    }
    const unsafe = await proxySolanaActionRequest(
      new Request("https://arena-90.vercel.app/actions/arena/pda"),
      { actionsOrigin: "https://user:secret@actions.example", fetcher },
    );
    expect(unsafe.status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
