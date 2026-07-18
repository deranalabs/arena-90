import { proxyArenaRequest } from "@/lib/arena-api/proxy";
import { serveRecordedReplayRequest } from "@/lib/arena-api/recorded-replay-artifacts";

export const dynamic = "force-dynamic";

async function handle(request: Request) {
  const recordedReplay = serveRecordedReplayRequest(request);
  if (recordedReplay !== undefined) return recordedReplay;
  return proxyArenaRequest(request, {
    runtimeOrigin: process.env.ARENA90_RUNTIME_ORIGIN,
  });
}

export { handle as GET };
