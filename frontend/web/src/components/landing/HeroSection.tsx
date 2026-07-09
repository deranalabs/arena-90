import { ArrowRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { FootballPitch } from "@/components/landing/FootballPitch";
import { HeroHeadline } from "@/components/landing/HeroHeadline";
import { HeroScoreboard } from "@/components/landing/HeroScoreboard";

export function HeroSection() {
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
          <Button className="mt-3">
            ENTER ARENA <ArrowRightIcon className="h-4 w-4" />
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
