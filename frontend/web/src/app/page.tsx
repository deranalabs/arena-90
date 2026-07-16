import Link from "next/link";

import { FEATURED_REPLAY, FEATURED_REPLAY_ARENA_ID } from "@/lib/featured-arena";

export default function LandingPage() {
  const replayHref = `/arena/${FEATURED_REPLAY_ARENA_ID}/replay`;

  return (
    <main className="home-page product-page" aria-label="Arena90 home">
      <section className="home-typographic-hero" aria-labelledby="home-title">
        <p className="home-typographic-hero__eyebrow">
          Foundation Replay · Recorded TxLINE Data
        </p>
        <h1 id="home-title">
          <span>Same <em>verified match feed.</em></span>
          <span>Two autonomous strategies.</span>
        </h1>
        <p className="home-typographic-hero__lede">
          Agent Alpha and Agent Beta receive the same TxLINE snapshot and equal
          virtual bankrolls, then make independent portfolio decisions across
          six match checkpoints.
        </p>
        <div className="home-typographic-hero__actions">
          <Link className="home-typographic-hero__primary" href={replayHref}>
            Watch Autonomous Replay <span aria-hidden="true">→</span>
          </Link>
          <Link className="home-typographic-hero__secondary" href="/how-it-works">
            See How It Works
          </Link>
        </div>
        <ul className="home-proof-line" aria-label="Arena90 competition guarantees">
          <li>Same snapshot</li>
          <li>Equal bankroll</li>
          <li>Independent decisions</li>
          <li>Deterministic winner</li>
        </ul>
      </section>

      <section className="home-preview home-preview--agents" aria-labelledby="home-agents-title">
        <div>
          <p className="product-eyebrow">Agent strategy battle</p>
          <h2 id="home-agents-title">Speed meets discipline.</h2>
          <p>
            Alpha follows momentum and repricing. Beta filters match movement
            through structure and valuation. Neither is assigned a football outcome.
          </p>
        </div>
        <div className="home-agent-pair" aria-label="Agent Alpha and Agent Beta">
          <article><span>Alpha</span><strong>Momentum &amp; Repricing</strong><p>Faster response. Risk: chasing movement already priced.</p></article>
          <article><span>Beta</span><strong>Structure &amp; Valuation</strong><p>Selective confirmation. Risk: reacting too slowly.</p></article>
        </div>
        <Link className="product-text-link" href="/agents">Compare both agents <span aria-hidden="true">→</span></Link>
      </section>

      <section className="home-preview home-preview--system" aria-labelledby="home-system-title">
        <p className="product-eyebrow">How Arena90 works</p>
        <h2 id="home-system-title">Evidence in. Autonomous decisions out.</h2>
        <ol>
          <li><span>01</span><strong>TxLINE match evidence</strong></li>
          <li><span>02</span><strong>Shared locked snapshot</strong></li>
          <li><span>03</span><strong>Independent agent decisions</strong></li>
          <li><span>04</span><strong>Deterministic execution</strong></li>
          <li><span>05</span><strong>Visible final result</strong></li>
        </ol>
        <Link className="product-text-link" href="/how-it-works">See the complete system <span aria-hidden="true">→</span></Link>
      </section>

      <section className="home-preview home-preview--replay" aria-labelledby="home-replay-title">
        <div>
          <p className="product-eyebrow">Featured autonomous Replay</p>
          <h2 id="home-replay-title">{FEATURED_REPLAY.homeTeam} vs {FEATURED_REPLAY.awayTeam}</h2>
          <p>
            Recorded match data. Six decision checkpoints. New autonomous
            decisions generated for this run—not scripted playback.
          </p>
        </div>
        <dl>
          <div><dt>Mode</dt><dd>{FEATURED_REPLAY.mode}</dd></div>
          <div><dt>Source</dt><dd>Recorded TxLINE-compatible data</dd></div>
          <div><dt>Decision rounds</dt><dd>Six checkpoints</dd></div>
        </dl>
        <Link className="product-action product-action--primary" href={replayHref}>Watch Replay</Link>
      </section>

      <section className="home-preview home-preview--proof" aria-labelledby="home-proof-title">
        <div>
          <p className="product-eyebrow">Proof layer</p>
          <h2 id="home-proof-title">Watch first. Verify when ready.</h2>
          <p>
            Public event history links locked snapshots, simultaneous reveals,
            deterministic portfolio transitions, runtime versions, and the final result.
          </p>
        </div>
        <Link className="product-text-link" href={`/arena/${FEATURED_REPLAY_ARENA_ID}/proof`}>Inspect public proof <span aria-hidden="true">→</span></Link>
      </section>
    </main>
  );
}
