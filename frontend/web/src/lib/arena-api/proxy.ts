type ProxyFetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type ArenaProxyOptions = {
  runtimeOrigin?: string;
  fetcher?: ProxyFetcher;
};

function unavailable() {
  return Response.json(
    {
      schemaVersion: 1,
      error: { code: "NOT_READY", message: "Arena runtime unavailable" },
    },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function safeRuntimeOrigin(candidate?: string) {
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

export async function proxyArenaRequest(
  request: Request,
  options: ArenaProxyOptions = {},
) {
  const runtimeOrigin = safeRuntimeOrigin(options.runtimeOrigin);
  if (!runtimeOrigin) return unavailable();

  const incomingUrl = new URL(request.url);
  if (!incomingUrl.pathname.startsWith("/api/arenas/")) return unavailable();

  const headers = new Headers();
  const accept = request.headers.get("accept");
  const contentType = request.headers.get("content-type");
  const lastEventId = request.headers.get("last-event-id");
  if (accept) headers.set("Accept", accept);
  if (contentType) headers.set("Content-Type", contentType);
  if (lastEventId) headers.set("Last-Event-ID", lastEventId);

  const target = `${runtimeOrigin}${incomingUrl.pathname}${incomingUrl.search}`;
  const fetcher = options.fetcher ?? fetch;
  try {
    const method = request.method.toUpperCase();
    const body = method === "GET" || method === "HEAD"
      ? undefined
      : await request.arrayBuffer();
    const upstream = await fetcher(target, {
      method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
      signal: request.signal,
    });
    if (upstream.status >= 300 && upstream.status < 400) return unavailable();
    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    const upstreamContentType = upstream.headers.get("content-type");
    if (upstreamContentType) responseHeaders.set("Content-Type", upstreamContentType);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return unavailable();
  }
}
