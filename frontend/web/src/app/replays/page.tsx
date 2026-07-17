import Link from "next/link";

import { ProductPageIntro } from "@/components/product/ProductPageIntro";
import { FEATURED_REPLAY_ARENA_ID } from "@/lib/featured-arena";

export default function ReplaysPage() {
  return (
    <main className="product-page product-page--editorial" aria-label="Arena90 replays">
      <ProductPageIntro
        aside={<p className="product-intro__count"><strong>01</strong><span>Recorded arena available</span></p>}
        description="Recorded TxLINE-compatible match data runs through the same agent and competition engine. Decisions are generated during each run."
        eyebrow="Autonomous Replay archive"
        title="Replay the match. Re-run the minds."
      />
      <section className="replay-index" aria-labelledby="foundation-replay-title">
        <div className="replay-index__number">001</div>
        <div className="replay-index__copy">
          <p className="product-eyebrow">Foundation Replay · Recorded data</p>
          <h2 id="foundation-replay-title">Six checkpoints. New autonomous decisions.</h2>
          <p>This experience is explicitly Replay—not a live match or scripted video.</p>
        </div>
        <dl>
          <div><dt>Source</dt><dd>TxLINE recorded</dd></div>
          <div><dt>Engine</dt><dd>Canonical runtime</dd></div>
          <div><dt>Decisions</dt><dd>Generated per run</dd></div>
        </dl>
        <Link className="product-text-link" href={`/arena/${FEATURED_REPLAY_ARENA_ID}/replay`}>
          Open Foundation Replay <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}
