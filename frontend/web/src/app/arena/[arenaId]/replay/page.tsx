import type { Metadata } from "next";

import { ArenaExperience } from "@/components/arena/ArenaExperience";

type ReplayPageProps = { params: Promise<{ arenaId: string }> };

export async function generateMetadata({ params }: ReplayPageProps): Promise<Metadata> {
  const { arenaId } = await params;
  return { title: `Autonomous Replay ${arenaId} | Arena90`, description: "Arena90 autonomous Replay over recorded TxLINE-compatible match data." };
}

export default async function ReplayPage({ params }: ReplayPageProps) {
  const { arenaId } = await params;
  return <ArenaExperience arenaId={arenaId} experience="replay" />;
}
