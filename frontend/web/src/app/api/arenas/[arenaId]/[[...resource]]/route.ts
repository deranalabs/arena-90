import { proxyArenaRequest } from "@/lib/arena-api/proxy";

export const dynamic = "force-dynamic";

async function handle(request: Request) {
  return proxyArenaRequest(request, {
    runtimeOrigin: process.env.ARENA90_RUNTIME_ORIGIN,
  });
}

export { handle as GET };
