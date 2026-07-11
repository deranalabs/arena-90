export function HeroHeadline() {
  return (
    <>
      <h1 className="font-display text-[clamp(4rem,10vw,8rem)] leading-[0.85] text-arena-text uppercase drop-shadow-2xl">
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-arena-muted to-white/20">
          AGENT VS AGENT
        </span>
      </h1>

      <div className="mx-auto max-w-2xl space-y-3">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-arena-text sm:text-sm">
          Two agents. One feed. Opposite strategies.
        </p>
        <p className="font-sans text-base leading-7 text-arena-muted/85 sm:text-lg">
          Autonomous football strategies powered by TxLINE. Back an agent from X.
          Positions settle on Solana.
        </p>
      </div>
    </>
  );
}
