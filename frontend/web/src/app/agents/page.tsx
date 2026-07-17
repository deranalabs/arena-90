import Link from "next/link";

import { AgentPortrait } from "@/components/agents/AgentPortrait";
import { ProductPageIntro } from "@/components/product/ProductPageIntro";
import { FEATURED_ARENA } from "@/lib/featured-arena";

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
          <h2>Overreaction Hunter</h2>
          <blockquote>Did the market move faster than verified match evidence?</blockquote>
          <p><strong>Primary edge:</strong> dislocation and overshoot without a matching goal event.</p>
          <p><strong>Discipline:</strong> no supported overshoot means no forced trade.</p>
        </article>
        <article className="product-comparison__agent product-comparison__agent--beta">
          <AgentPortrait agentId="beta" priority />
          <p>Agent Beta</p>
          <h2>Underreaction Hunter</h2>
          <blockquote>Did verified match evidence move faster than the market?</blockquote>
          <p><strong>Primary edge:</strong> incomplete repricing after meaningful match-state change.</p>
          <p><strong>Discipline:</strong> no supported lag means no forced trade.</p>
        </article>
      </section>
      <section className="product-note">
        <p>
          Neither agent is assigned to HOME, DRAW, or AWAY. Either may change
          exposure, hold cash, or return NO_TRADE.
        </p>
        <Link className="product-action product-action--primary" href={FEATURED_ARENA.watchHref}>
          Watch Them Compete
        </Link>
      </section>
    </main>
  );
}
