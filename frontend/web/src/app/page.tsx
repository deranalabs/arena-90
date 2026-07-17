import Link from "next/link";

import { AgentPortrait } from "@/components/agents/AgentPortrait";
import { FEATURED_REPLAY, FEATURED_REPLAY_ARENA_ID } from "@/lib/featured-arena";

export default function LandingPage() {
  const replayHref = `/arena/${FEATURED_REPLAY_ARENA_ID}/replay`;

  return (
    <main className="home-page product-page" aria-label="Arena90 home">
      <section className="home-broadcast-hero" aria-labelledby="home-title">
        <div className="home-broadcast-hero__copy">
          <p className="home-typographic-hero__eyebrow">
            Foundation Replay · Recorded TxLINE Data
          </p>
          <h1 id="home-title">
            <span>Same verified match feed. </span>
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
        </div>
        <aside className="home-broadcast-sheet" aria-label="Featured arena summary">
          <div className="home-broadcast-sheet__issue">
            <span>Featured arena</span><strong>Replay 001</strong>
          </div>
          <p className="home-broadcast-sheet__fixture">
            {FEATURED_REPLAY.homeTeam} <span>vs</span> {FEATURED_REPLAY.awayTeam}
          </p>
          <div className="home-broadcast-sheet__rivalry">
            <article><span>Alpha</span><strong>Momentum</strong></article>
            <span className="home-broadcast-sheet__versus">VS</span>
            <article><span>Beta</span><strong>Valuation</strong></article>
          </div>
          <dl className="home-broadcast-sheet__facts">
            <div><dt>Mode</dt><dd>{FEATURED_REPLAY.mode}</dd></div>
            <div><dt>Source</dt><dd>TxLINE recorded</dd></div>
            <div><dt>Rounds</dt><dd>6 checkpoints</dd></div>
          </dl>
        </aside>
        <ul className="home-proof-line" aria-label="Arena90 competition guarantees">
          <li>Same snapshot</li>
          <li>Equal bankroll</li>
          <li>Independent decisions</li>
          <li>Deterministic winner</li>
        </ul>
      </section>

      <section className="home-preview home-preview--agents home-split-section" aria-labelledby="home-agents-title">
        <div className="home-rivalry-tape" aria-hidden="true">
          <div>
            <span>Alpha · Momentum</span>
            <span>Same snapshot</span>
            <span>Beta · Valuation</span>
            <span>Independent decisions</span>
            <span>Alpha · Momentum</span>
            <span>Same snapshot</span>
            <span>Beta · Valuation</span>
            <span>Independent decisions</span>
          </div>
        </div>
        <div className="home-rivalry-heading">
          <div className="home-preview__copy">
            <h2 id="home-agents-title">Speed meets discipline.</h2>
          </div>
          <p>
            Alpha follows momentum and repricing. Beta filters match movement
            through structure and valuation. Neither is assigned a football outcome.
          </p>
        </div>
        <div className="home-agent-pair" aria-label="Agent Alpha and Agent Beta">
          <article className="home-agent-card home-agent-card--alpha">
            <AgentPortrait agentId="alpha" />
            <div className="home-agent-card__copy">
              <span>Agent Alpha</span>
              <strong>Momentum &amp; Repricing</strong>
              <p>Faster response. Risk: chasing movement already priced.</p>
            </div>
          </article>
          <span className="home-agent-pair__versus" aria-hidden="true">VS</span>
          <article className="home-agent-card home-agent-card--beta">
            <AgentPortrait agentId="beta" />
            <div className="home-agent-card__copy">
              <span>Agent Beta</span>
              <strong>Structure &amp; Valuation</strong>
              <p>Selective confirmation. Risk: reacting too slowly.</p>
            </div>
          </article>
        </div>
        <div className="home-rivalry-footer">
          <p>One fixture. Equal capital. Different football intelligence.</p>
          <Link className="product-text-link" href="/agents">Compare both agents <span aria-hidden="true">→</span></Link>
        </div>
      </section>

      <section className="home-preview home-preview--system" aria-labelledby="home-system-title">
        <div className="home-system-heading">
          <div className="home-preview__copy">
            <h2 id="home-system-title">Evidence in. Autonomous decisions out.</h2>
          </div>
          <p>
            Every round follows the same public lifecycle—from verified football
            evidence to a deterministic final result.
          </p>
        </div>
        <ol className="home-system-track">
          <li><span>01</span><strong>TxLINE match evidence</strong><small>Provider source</small></li>
          <li><span>02</span><strong>Shared locked snapshot</strong><small>Equal information</small></li>
          <li><span>03</span><strong>Independent agent decisions</strong><small>Simultaneous reveal</small></li>
          <li><span>04</span><strong>Deterministic execution</strong><small>Portfolio transition</small></li>
          <li><span>05</span><strong>Visible final result</strong><small>Winner + proof</small></li>
        </ol>
        <Link className="product-text-link home-system-link" href="/how-it-works">See the complete system <span aria-hidden="true">→</span></Link>
      </section>

      <section className="home-preview home-preview--replay home-split-section" aria-labelledby="home-replay-title">
        <div className="home-replay-poster">
          <p>Featured autonomous replay</p>
          <h2 id="home-replay-title">
            <span>{FEATURED_REPLAY.homeTeam}</span>
            <b>vs</b>
            <span>{FEATURED_REPLAY.awayTeam}</span>
          </h2>
          <div className="home-replay-poster__agents" aria-label="Agent matchup">
            <strong>Alpha</strong>
            <span>strategy arena</span>
            <strong>Beta</strong>
          </div>
        </div>
        <div className="home-preview__copy home-replay-copy">
          <p>
            Recorded match data. Six decision checkpoints. New autonomous
            decisions generated for this run—not scripted playback.
          </p>
          <dl className="home-replay-dossier">
            <div><dt>Mode</dt><dd>{FEATURED_REPLAY.mode}</dd></div>
            <div><dt>Source</dt><dd>Recorded TxLINE-compatible data</dd></div>
            <div><dt>Decision rounds</dt><dd>Six checkpoints</dd></div>
          </dl>
          <Link className="product-action product-action--primary" href={replayHref}>Watch Replay <span aria-hidden="true">→</span></Link>
        </div>
      </section>

      <section className="home-preview home-preview--proof" aria-labelledby="home-proof-title">
        <div className="home-proof-statement">
          <span>Public proof</span>
          <h2 id="home-proof-title">Watch first. Verify when ready.</h2>
          <p>
            Public event history links locked snapshots, simultaneous reveals,
            deterministic portfolio transitions, runtime versions, and the final result.
          </p>
        </div>
        <div className="home-proof-action">
          <p>Public evidence. No wallet required.</p>
          <Link className="product-text-link" href={`/arena/${FEATURED_REPLAY_ARENA_ID}/proof`}>Inspect public proof <span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </main>
  );
}
