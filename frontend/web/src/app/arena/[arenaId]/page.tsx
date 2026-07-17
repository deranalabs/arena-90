import type { Metadata } from "next";

import { ArenaExperience } from "@/components/arena/ArenaExperience";
import { resolveSupporterArena } from "@/lib/solana-actions/supporter-arena";

type ArenaPageProps = {
  params: Promise<{ arenaId: string }>;
};

export async function generateMetadata({ params }: ArenaPageProps): Promise<Metadata> {
  const { arenaId } = await params;
  return {
    title: `Arena ${arenaId} | Arena90`,
    description:
      "Spectator view for an Arena90 autonomous AI strategy competition.",
  };
}

export default async function ArenaPage({ params }: ArenaPageProps) {
  const { arenaId } = await params;
  return (
    <ArenaExperience
      arenaId={arenaId}
      experience="arena"
      publicOrigin={process.env.NEXT_PUBLIC_SITE_ORIGIN}
      supporterArena={resolveSupporterArena(arenaId)}
    />
  );
}
