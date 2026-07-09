"use client";

import { GlobalArenaLayout } from "@/components/layout/GlobalArenaLayout";
import { RiotHero } from "@/components/landing/Hero";
import { AgentsSection } from "@/components/landing/AgentsSection";
import { BlinkExperienceSection } from "@/components/landing/BlinkExperienceSection";
import { AgentTelemetrySection } from "@/components/landing/AgentTelemetrySection";
import { OracleSection } from "@/components/landing/OracleSection";
import { SettlementVaultSection } from "@/components/landing/SettlementVaultSection";
import { FooterSection } from "@/components/landing/FooterSection";

export default function LandingPage() {
  return (
    <GlobalArenaLayout>
      <RiotHero />
      <AgentsSection />
      <BlinkExperienceSection />
      <AgentTelemetrySection />
      <OracleSection />
      <SettlementVaultSection />
      <FooterSection />
    </GlobalArenaLayout>
  );
}
