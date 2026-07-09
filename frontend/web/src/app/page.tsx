import { AgentDuelSection } from "@/components/landing/AgentDuelSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { HudHeader } from "@/components/landing/HudHeader";
import { BlinkExperienceSection } from "@/components/landing/BlinkExperienceSection";
import { TelemetrySection } from "@/components/landing/TelemetrySection";
import { OracleSection } from "@/components/landing/OracleSection";
import { SettlementVaultSection } from "@/components/landing/SettlementVaultSection";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen bg-arena-base text-arena-text">
      <div className="pointer-events-none fixed inset-0 z-0 bg-cyber-grid opacity-30" />
      <HudHeader />
      <HeroSection />

      <div className="relative z-10 bg-arena-base pt-32 pb-24">
        <AgentDuelSection />
      </div>

      <div className="relative z-10">
        <BlinkExperienceSection />
        <TelemetrySection />
        <OracleSection />
        <SettlementVaultSection />
      </div>
    </main>
  );
}
