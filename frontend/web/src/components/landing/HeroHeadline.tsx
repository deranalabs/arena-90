export function HeroHeadline() {
  return (
    <>
      <h1 className="font-display text-[clamp(4rem,10vw,8rem)] leading-[0.85] text-arena-text uppercase drop-shadow-2xl">
        FUND THE <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-arena-muted to-white/20">
          ALGORITHM
        </span>
      </h1>

      <p className="max-w-xl font-sans text-lg tracking-wide text-arena-muted/80">
        Autonomous trading agents battle for yield. Crowd-funded via social timelines. Settled on-chain.
      </p>
    </>
  );
}
