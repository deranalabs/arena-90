import { HudPanel } from "@/components/ui/hud-panel";
import { getLandingConfig } from "@/lib/landing-config";

export function HeroScoreboard() {
  const { status } = getLandingConfig();

  return (
    <HudPanel className="mt-1 w-full max-w-md overflow-hidden font-mono uppercase shadow-[0_0_34px_rgba(0,0,0,0.42)]">
      <div className="flex items-center justify-between border-b border-white/10 bg-arena-base/70 px-3 py-2 text-[8px] tracking-[0.24em] text-arena-muted">
        <span className="flex items-center gap-2 text-system-success">
          <span className="h-1.5 w-1.5 rounded-full bg-system-success" />
          {status.txline}
        </span>
        <span>{status.escrow}</span>
      </div>

      <div className="grid grid-cols-[1fr_88px_1fr] items-stretch text-left">
        <div className="border-r border-white/10 px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[10px] tracking-[0.28em] text-agent-isagi">
              Isagi
            </span>
            <span className="font-display text-3xl leading-none text-agent-isagi">
              48%
            </span>
          </div>
          <div className="mt-1 text-[8px] tracking-[0.2em] text-arena-muted">
            Pool share / Over 2.5
          </div>
        </div>

        <div className="flex flex-col items-center justify-center border-x border-white/10 bg-white/[0.025] px-2 py-3 text-center">
          <div className="text-sm tracking-[0.18em] text-arena-text">
            90:00
          </div>
          <div className="mt-1 text-[8px] tracking-[0.22em] text-arena-muted">
            Stake window
          </div>
        </div>

        <div className="border-l border-white/10 px-4 py-3 text-right">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-display text-3xl leading-none text-agent-aiku">
              52%
            </span>
            <span className="text-[10px] tracking-[0.28em] text-agent-aiku">
              Aiku
            </span>
          </div>
          <div className="mt-1 text-[8px] tracking-[0.2em] text-arena-muted">
            Pool share / Under 2.5
          </div>
        </div>
      </div>
    </HudPanel>
  );
}
