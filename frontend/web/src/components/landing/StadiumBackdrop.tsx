import { FootballPitch } from "@/components/landing/FootballPitch";
import { StadiumBowl } from "@/components/landing/StadiumBowl";

export function StadiumBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="arena-ambient-pulse absolute inset-x-0 top-0 h-[72%] bg-[radial-gradient(ellipse_at_top,rgba(0,229,155,0.11),transparent_36%),radial-gradient(ellipse_at_center,rgba(255,255,255,0.08),transparent_62%)]" />
      <StadiumBowl />
      <div className="absolute inset-x-[18%] top-[34%] h-px bg-gradient-to-r from-transparent via-agent-isagi/35 to-transparent" />
      <div className="absolute inset-x-[24%] top-[38%] h-px bg-gradient-to-r from-transparent via-agent-aiku/30 to-transparent" />

      <FootballPitch />

      <div className="arena-fog absolute inset-x-[-10%] bottom-[6%] h-[22%] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08),transparent_66%)] blur-2xl" />
      <div className="arena-spotlight-left absolute left-[10%] top-[16%] h-[62%] w-px rotate-12 bg-gradient-to-b from-agent-isagi/70 via-white/20 to-transparent blur-[1px]" />
      <div className="arena-spotlight-right absolute right-[10%] top-[16%] h-[62%] w-px -rotate-12 bg-gradient-to-b from-agent-aiku/60 via-white/20 to-transparent blur-[1px]" />
      <div className="arena-light-sweep absolute top-[18%] h-[48%] w-1/3 bg-gradient-to-r from-transparent via-white/14 to-transparent blur-xl" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_34%,rgba(10,11,16,0.18)_68%,rgba(10,11,16,0.86)_100%)]" />
    </div>
  );
}
