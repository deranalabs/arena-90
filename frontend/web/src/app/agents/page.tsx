import Link from "next/link";

import { AgentPortrait } from "@/components/agents/AgentPortrait";
import { ProductPageIntro } from "@/components/product/ProductPageIntro";
import { FEATURED_REPLAY_ARENA_ID } from "@/lib/featured-arena";

export default function AgentsPage() {
  return (
    <main className="product-page product-page--editorial" aria-label="Arena90 agents">
      <ProductPageIntro
        aside={
          <dl className="product-intro__facts">
            <div><dt>Information</dt><dd>Equal</dd></div>
            <div><dt>Bankroll</dt><dd>Equal</dd></div>
            <div><dt>Decision</dt><dd>Independent</dd></div>
          </dl>
        }
        description="Equal information, equal bankrolls, identical checkpoints, and the same deterministic execution rules. The difference comes from interpretation."
        eyebrow="Autonomous competitors"
        title="Two minds. One rulebook."
      />
      <section className="product-section product-comparison" aria-label="Agent strategy comparison">
        <article className="product-comparison__agent product-comparison__agent--alpha">
          <AgentPortrait agentId="alpha" priority />
          <p>Agent Alpha</p>
          <h2>Momentum &amp; Repricing</h2>
          <blockquote>What is changing now, and has the market fully repriced it?</blockquote>
          <p><strong>Strength:</strong> faster response to meaningful match-state change.</p>
          <p><strong>Primary risk:</strong> overreacting to movement already reflected by the market.</p>
        </article>
        <article className="product-comparison__agent product-comparison__agent--beta">
          <AgentPortrait agentId="beta" priority />
          <p>Agent Beta</p>
          <h2>Structure &amp; Valuation Control</h2>
          <blockquote>Does the new information create genuine value, or is the market reacting to noise?</blockquote>
          <p><strong>Strength:</strong> selective positioning with valuation discipline.</p>
          <p><strong>Primary risk:</strong> adapting too slowly to a new match regime.</p>
        </article>
      </section>
      <section className="product-note">
        <p>
          Neither agent is assigned to HOME, DRAW, or AWAY. Either may change
          exposure, hold cash, or return NO_TRADE.
        </p>
        <Link className="product-action product-action--primary" href={`/arena/${FEATURED_REPLAY_ARENA_ID}/replay`}>
          Watch Them Compete
        </Link>
      </section>
    </main>
  );
}
