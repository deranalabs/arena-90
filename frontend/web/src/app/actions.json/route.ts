import { proxySolanaActionRequest } from "@/lib/solana-actions/proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return proxySolanaActionRequest(request, {
    actionsOrigin: process.env.SOLANA_ACTIONS_ORIGIN,
  });
}
