import { proxySolanaActionRequest } from "@/lib/solana-actions/proxy";

export const dynamic = "force-dynamic";

async function handle(request: Request) {
  return proxySolanaActionRequest(request, {
    actionsOrigin: process.env.SOLANA_ACTIONS_ORIGIN,
  });
}

export { handle as GET, handle as OPTIONS, handle as POST };
