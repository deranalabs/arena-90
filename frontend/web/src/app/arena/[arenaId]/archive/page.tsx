import type { Metadata } from "next";

import { ArenaExperience } from "@/components/arena/ArenaExperience";

type ArchivePageProps = { params: Promise<{ arenaId: string }> };

export async function generateMetadata({ params }: ArchivePageProps): Promise<Metadata> {
  const { arenaId } = await params;
  return {
    title: `Archived Autonomous Run ${arenaId} | Arena90`,
    description:
      "Playback and audit of a completed Arena90 autonomous run over recorded TxLINE data.",
  };
}

export default async function ArchivePage({ params }: ArchivePageProps) {
  const { arenaId } = await params;
  return <ArenaExperience arenaId={arenaId} experience="archive" />;
}
