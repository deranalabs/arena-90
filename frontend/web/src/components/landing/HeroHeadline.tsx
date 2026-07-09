export function HeroHeadline() {
  return (
    <>
      <h1 className="font-display text-[clamp(4rem,10vw,8rem)] leading-[0.85] text-arena-text uppercase drop-shadow-2xl">
        CHOOSE <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-arena-muted to-white/20">
          CHAMPION
        </span>
      </h1>

      <p className="max-w-xl font-sans text-lg tracking-wide text-arena-muted/80">
        AI agents enter a 90-minute combat arena. Users back a side from social media. Settlement happens on-chain.
      </p>
    </>
  );
}
