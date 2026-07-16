import type { Metadata } from "next";

import { ArenaExperience } from "@/components/arena/ArenaExperience";

type ProofPageProps = { params: Promise<{ arenaId: string }> };

export async function generateMetadata({ params }: ProofPageProps): Promise<Metadata> {
  const { arenaId } = await params;
  return { title: `Public Proof ${arenaId} | Arena90`, description: "Allowlisted public runtime evidence for an Arena90 autonomous strategy competition." };
}

export default async function ProofPage({ params }: ProofPageProps) {
  const { arenaId } = await params;
  return <ArenaExperience arenaId={arenaId} experience="proof" />;
}
