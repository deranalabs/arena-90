import { ArrowRightIcon, CodeXmlIcon } from "lucide-react";

import { Reveal } from "@/components/ui/reveal";
import { FootballPitch } from "@/components/landing/FootballPitch";
import { HeroHeadline } from "@/components/landing/HeroHeadline";
import { HeroScoreboard } from "@/components/landing/HeroScoreboard";
import { getLandingConfig } from "@/lib/landing-config";

export function HeroSection() {
  const { githubUrl, xBlinkUrl } = getLandingConfig();

  return (
    <section className="relative z-10 flex min-h-dvh flex-col items-center justify-center border-b border-white/5 bg-gradient-to-b from-transparent to-arena-base/80 px-6 pt-32 pb-24 text-center">
      <FootballPitch />

      <div className="relative z-10 flex flex-col items-center gap-5">
        <Reveal amount={0.1} blur={false} y={12}>
          <HeroHeadline />
        </Reveal>

        <Reveal amount={0.1} blur={false} delay={0.12} y={10}>
          <HeroScoreboard />
        </Reveal>

        <Reveal amount={0.1} blur={false} delay={0.2} y={8}>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            <a
              className="inline-flex min-h-12 items-center justify-center gap-3 bg-arena-text px-6 py-3 font-mono text-xs font-bold uppercase text-arena-base transition-colors duration-300 clip-chamfer hover:bg-agent-isagi sm:px-8 sm:text-sm"
              href="#agents"
            >
              Watch the clash <ArrowRightIcon className="h-4 w-4" />
            </a>
            {xBlinkUrl && (
              <a
                className="inline-flex min-h-12 items-center justify-center gap-3 border border-system-success/40 bg-system-success/5 px-6 py-3 font-mono text-xs font-bold uppercase text-system-success transition-colors duration-300 clip-chamfer hover:bg-system-success hover:text-arena-base sm:px-8 sm:text-sm"
                href={xBlinkUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open Blink on X <ArrowRightIcon className="h-4 w-4" />
              </a>
            )}
            <a
              aria-label="View Arena90 source code on GitHub"
              className="inline-flex h-12 w-12 items-center justify-center border border-white/15 bg-arena-base/70 text-arena-text transition-colors clip-chamfer hover:border-white/35 hover:bg-white/5"
              href={githubUrl}
              rel="noreferrer"
              target="_blank"
              title="View source on GitHub"
            >
              <CodeXmlIcon className="h-4 w-4" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
