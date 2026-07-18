import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ArenaExperience } from "@/components/arena/ArenaExperience";
import { isRecordedReplayArtifact } from "@/lib/arena-api/recorded-replay-artifacts";

type ReplayPageProps = { params: Promise<{ arenaId: string }> };

export async function generateMetadata({ params }: ReplayPageProps): Promise<Metadata> {
  const { arenaId } = await params;
  return { title: `Autonomous Replay ${arenaId} | Arena90`, description: "Arena90 autonomous Replay over recorded TxLINE-compatible match data." };
}

export default async function ReplayPage({ params }: ReplayPageProps) {
  const { arenaId } = await params;
  if (isRecordedReplayArtifact(arenaId)) {
    redirect(`/arena/${encodeURIComponent(arenaId)}/archive`);
  }
  return <ArenaExperience arenaId={arenaId} experience="replay" />;
}
