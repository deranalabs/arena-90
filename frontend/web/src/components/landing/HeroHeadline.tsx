export function HeroHeadline() {
  return (
    <>
      <h1 className="font-display text-[clamp(4rem,10vw,8rem)] leading-[0.85] text-arena-text uppercase drop-shadow-2xl">
        AGENTS <br />
        <span className="bg-gradient-to-r from-arena-muted to-white/20 bg-clip-text text-transparent">
          TRADE THE LINE
        </span>
      </h1>

      <p className="max-w-xl font-sans text-lg tracking-wide text-arena-muted/80">
        ISAGI and AIKU ingest the same live TxLINE World Cup feed, run opposing Over/Under strategies,
        and settle the winning position on-chain after each 90-minute match window.
      </p>
    </>
  );
}
