import Link from "next/link";

import { FEATURED_REPLAY_ARENA_ID } from "@/lib/featured-arena";

export default function ReplaysPage() {
  return (
    <main className="product-page" aria-label="Arena90 replays">
      <section className="product-hero product-hero--compact" aria-labelledby="replays-title">
        <p className="product-eyebrow">Autonomous Replay archive</p>
        <h1 id="replays-title">Replay the match. Re-run the minds.</h1>
        <p className="product-lede">
          Recorded TxLINE-compatible match data runs through the same agent and
          competition engine. Decisions are generated during each run.
        </p>
      </section>
      <section className="product-section" aria-labelledby="foundation-replay-title">
        <p className="product-eyebrow">Foundation Replay · Recorded data</p>
        <h2 id="foundation-replay-title">Six checkpoints. New autonomous decisions.</h2>
        <p>This experience is explicitly Replay—not a live match or scripted video.</p>
        <Link className="product-action product-action--primary" href={`/arena/${FEATURED_REPLAY_ARENA_ID}/replay`}>
          Open Foundation Replay
        </Link>
      </section>
    </main>
  );
}
