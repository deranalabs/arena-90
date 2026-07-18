import Link from "next/link";

import { AgentPortrait } from "@/components/agents/AgentPortrait";
import { ProductPageIntro } from "@/components/product/ProductPageIntro";
import { FEATURED_ARENA } from "@/lib/featured-arena";
import styles from "./agents.module.css";

const sharedConditions = [
  "Same verified snapshot",
  "Equal virtual bankroll",
  "Same enabled markets",
  "Same checkpoints",
] as const;

export default function AgentsPage() {
  return (
    <main className={`product-page ${styles.agentsPage}`} aria-label="Arena90 agents">
      <ProductPageIntro
        aside={<p className="product-intro__count"><strong>02</strong><span>Independent strategy competitors</span></p>}
        description="Equal information, equal bankrolls, identical checkpoints, and the same deterministic execution rules. The difference is when each strategy believes price has caught up."
        eyebrow="Autonomous competitors"
        layout="front-page"
        meta="Agents / 02"
        title="Same evidence. Different timing thesis."
      />

      <section className={styles.comparison} aria-label="Agent strategy comparison">
        <article className={`${styles.agent} ${styles.alpha}`}>
          <header className={styles.agentHeader}>
            <div>
              <p className={styles.agentId}>Agent Alpha · Overreaction</p>
              <h2>Reversion</h2>
            </div>
            <span className={styles.lens}>Price → evidence</span>
          </header>
          <div className={styles.portrait}><AgentPortrait agentId="alpha" priority /></div>
          <blockquote>“Did the market move faster than verified match evidence?”</blockquote>
          <dl className={styles.profile}>
            <div><dt>Looks for</dt><dd>Dislocation, overshoot, and reversal potential.</dd></div>
            <div><dt>Primary edge</dt><dd>Fades movement that runs beyond the evidence supporting it.</dd></div>
            <div><dt>Primary risk</dt><dd>Fading a real regime change that deserves its new price.</dd></div>
          </dl>
          <p className={styles.posture}>Directional · diversified · reduced exposure · cash · no trade</p>
        </article>

        <article className={`${styles.agent} ${styles.beta}`}>
          <header className={styles.agentHeader}>
            <div>
              <p className={styles.agentId}>Agent Beta · Underreaction</p>
              <h2>Continuation</h2>
            </div>
            <span className={styles.lens}>Evidence → price</span>
          </header>
          <div className={styles.portrait}><AgentPortrait agentId="beta" priority /></div>
          <blockquote>“Did verified match evidence move faster than the market?”</blockquote>
          <dl className={styles.profile}>
            <div><dt>Looks for</dt><dd>Continuation and meaningful evidence not fully reflected in price.</dd></div>
            <div><dt>Primary edge</dt><dd>Follows incomplete repricing after a verified match-state change.</dd></div>
            <div><dt>Primary risk</dt><dd>Chasing information the market has already priced.</dd></div>
          </dl>
          <p className={styles.posture}>Directional · diversified · reduced exposure · cash · no trade</p>
        </article>
      </section>

      <section className={styles.rulebook} aria-labelledby="shared-rulebook-title">
        <div className={styles.rulebookCopy}>
          <p className={styles.rulebookLabel}>The shared rulebook</p>
          <h2 id="shared-rulebook-title">Fair inputs. Independent decisions.</h2>
          <p>Neither agent is assigned to HOME, DRAW, or AWAY. The engine never forces disagreement or fabricates a fallback trade.</p>
        </div>
        <ul className={styles.conditions}>
          {sharedConditions.map((condition, index) => (
            <li key={condition}><span>{String(index + 1).padStart(2, "0")}</span>{condition}</li>
          ))}
        </ul>
        <Link className={styles.watchAction} href={FEATURED_ARENA.watchHref}>
          Watch them compete <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}
