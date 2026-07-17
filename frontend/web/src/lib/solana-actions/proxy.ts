type ProxyFetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type SolanaActionsProxyOptions = {
  actionsOrigin?: string;
  fetcher?: ProxyFetcher;
};

const MAX_BODY_BYTES = 8_192;
const ALLOWED_METHODS = new Set(["GET", "POST", "OPTIONS"]);

function errorResponse(status: number, message: string, allow?: string) {
  return Response.json(
    { message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(allow ? { Allow: allow } : {}),
      },
    },
  );
}

function safeOrigin(candidate?: string) {
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    if (
      url.protocol !== "https:" ||
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

function isActionPath(pathname: string) {
  return pathname === "/actions.json" || pathname.startsWith("/actions/arena/");
}

export async function proxySolanaActionRequest(
  request: Request,
  options: SolanaActionsProxyOptions = {},
) {
  const method = request.method.toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    return errorResponse(405, "Method not allowed", "GET, POST, OPTIONS");
  }
  const actionsOrigin = safeOrigin(options.actionsOrigin);
  if (!actionsOrigin) return errorResponse(503, "Solana Actions unavailable");

  const incomingUrl = new URL(request.url);
  if (!isActionPath(incomingUrl.pathname)) {
    return errorResponse(404, "Action route not found");
  }

  let body: string | undefined;
  if (method === "POST") {
    body = await request.text();
    if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
      return errorResponse(413, "Action request is too large");
    }
  }

  const headers = new Headers();
  for (const name of ["accept", "content-type", "origin"] as const) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const fetcher = options.fetcher ?? fetch;
    const upstream = await fetcher(
      `${actionsOrigin}${incomingUrl.pathname}${incomingUrl.search}`,
      {
        method,
        headers,
        ...(body === undefined ? {} : { body }),
        cache: "no-store",
        redirect: "manual",
        signal: request.signal,
      },
    );
    if (upstream.status >= 300 && upstream.status < 400) {
      return errorResponse(503, "Solana Actions unavailable");
    }

    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    for (const name of [
      "content-type",
      "access-control-allow-origin",
      "access-control-allow-methods",
      "access-control-allow-headers",
    ] as const) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return errorResponse(503, "Solana Actions unavailable");
  }
}
