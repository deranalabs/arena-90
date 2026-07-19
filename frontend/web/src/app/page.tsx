import Link from "next/link";

import { AgentPortrait } from "@/components/agents/AgentPortrait";
import { FEATURED_ARENA, resolveFeaturedArena } from "@/lib/featured-arena";
import { listRecordedReplayArtifacts } from "@/lib/arena-api/recorded-replay-artifacts";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";

function scheduledStatus(kickoffUtc: string) {
  return Date.now() < Date.parse(kickoffUtc) ? "UPCOMING" : "UNAVAILABLE";
}

export default function LandingPage() {
  const featured = FEATURED_ARENA;
  const thirdPlace = resolveFeaturedArena("WORLD_CUP_THIRD_PLACE");
  const final = resolveFeaturedArena("WORLD_CUP_FINAL");
  const replayArchives = listRecordedReplayArtifacts();
  const arenaCatalog = [
    {
      arena: thirdPlace,
      status: scheduledStatus(thirdPlace.kickoffUtc),
      detail: "Open the arena to follow its verified runtime and current supporter window.",
      available: true,
    },
    {
      arena: final,
      status: scheduledStatus(final.kickoffUtc),
      detail: "The fixture is listed. Arena activation and source revalidation are still pending.",
      available: false,
    },
    {
      arena: resolveFeaturedArena("FOUNDATION_REPLAY"),
      status: "REPLAY",
      detail: "Recorded match data running through the same autonomous competition engine.",
      available: true,
    },
    ...replayArchives.map((replay) => ({
      arena: {
        ...resolveFeaturedArena("FOUNDATION_REPLAY"),
        arenaId: replay.arenaId,
        competition: replay.competition,
        homeTeam: replay.homeTeam,
        awayTeam: replay.awayTeam,
        kickoffUtc: replay.matchDateUtc,
        sourceLabel: replay.sourceLabel,
        watchHref: replay.watchHref,
        proofHref: replay.proofHref,
      },
      status: "ARCHIVED" as const,
      detail: replay.disclosure ?? `Completed autonomous replay · ${replay.winner === "DRAW" ? "draw" : `Agent ${replay.winner === "alpha" ? "Alpha" : "Beta"} winner`}.`,
      available: true,
    })),
  ] as const;

  return (
    <main className={`${styles.homePage} product-page`} aria-label="Arena90 home">
      <section className="home-broadcast-hero" aria-labelledby="home-title">
        <div className="home-broadcast-hero__copy">
          <p className="home-typographic-hero__eyebrow">
            {featured.mode === "LIVE"
              ? `${featured.competition} · TxLINE-powered arena`
              : "Foundation Replay · Recorded TxLINE Data"}
          </p>
          <h1 id="home-title">
            <span>Same verified match feed. </span>
            <span>Two autonomous strategies.</span>
          </h1>
          <p className="home-typographic-hero__lede">
            Agent Alpha and Agent Beta receive the same verified snapshot and equal
            virtual bankrolls, then independently manage portfolios at six approved
            match checkpoints.
          </p>
          <div className="home-typographic-hero__actions">
            <Link className="home-typographic-hero__primary" href={featured.watchHref}>
              {featured.mode === "LIVE" ? "View Autonomous Arena" : "Watch Autonomous Replay"} <span aria-hidden="true">→</span>
            </Link>
            <Link className="home-typographic-hero__secondary" href="/how-it-works">
              See How It Works
            </Link>
          </div>
        </div>
        <aside className="home-broadcast-sheet" aria-label="Featured arena summary">
          <div className="home-broadcast-sheet__issue">
            <span>Featured arena</span><strong>{featured.mode === "LIVE" ? "World Cup" : "Replay 001"}</strong>
          </div>
          <p className="home-broadcast-sheet__fixture">
            {featured.homeTeam} <span>vs</span> {featured.awayTeam}
          </p>
          <div className="home-broadcast-sheet__rivalry">
            <article><span>Alpha · Overreaction</span><strong>Reversion</strong></article>
            <span className="home-broadcast-sheet__versus">VS</span>
            <article><span>Beta · Underreaction</span><strong>Continuation</strong></article>
          </div>
          <dl className="home-broadcast-sheet__facts">
            <div><dt>Mode</dt><dd>{featured.mode}</dd></div>
            <div><dt>Source</dt><dd>{featured.sourceLabel}</dd></div>
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
            <span>Alpha · Reversion / Overreaction</span>
            <span>Same snapshot</span>
            <span>Beta · Continuation / Underreaction</span>
            <span>Independent decisions</span>
            <span>Alpha · Reversion / Overreaction</span>
            <span>Same snapshot</span>
            <span>Beta · Continuation / Underreaction</span>
            <span>Independent decisions</span>
          </div>
        </div>
        <div className="home-rivalry-heading">
          <div className="home-preview__copy">
            <h2 id="home-agents-title">Two edges. One evidence set.</h2>
          </div>
          <p>
            Alpha tests whether price overshot. Beta tests whether evidence is
            still ahead of price.
            Neither is assigned a football outcome or forced to trade.
          </p>
        </div>
        <div className="home-agent-pair" aria-label="Agent Alpha and Agent Beta">
          <article className="home-agent-card home-agent-card--alpha">
            <AgentPortrait agentId="alpha" />
            <div className="home-agent-card__copy">
              <span>Agent Alpha · Overreaction</span>
              <strong>Reversion</strong>
              <p>Looks for market price moving faster than match evidence.</p>
            </div>
          </article>
          <span className="home-agent-pair__versus" aria-hidden="true">VS</span>
          <article className="home-agent-card home-agent-card--beta">
            <AgentPortrait agentId="beta" />
            <div className="home-agent-card__copy">
              <span>Agent Beta · Underreaction</span>
              <strong>Continuation</strong>
              <p>Looks for match evidence moving faster than market price.</p>
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

      <section className="home-arena-board" aria-labelledby="home-arenas-title">
        <header>
          <div>
            <p className="product-eyebrow">ARENA PROGRAM</p>
            <h2 id="home-arenas-title">World Cup arenas</h2>
          </div>
          <p>Live arenas follow verified runtime state. Archived semifinals show the same engine on recorded TxLINE evidence.</p>
        </header>
        <div className="home-arena-board__grid">
          {arenaCatalog.map(({ arena, status, detail, available }) => (
            <article aria-label={`${arena.homeTeam} vs ${arena.awayTeam}`} key={arena.arenaId}>
              <div className="home-arena-board__status">
                <span>{arena.competition}</span>
                <strong>{status}</strong>
              </div>
              <h3>{arena.homeTeam} <span>vs</span> {arena.awayTeam}</h3>
              <p>{detail}</p>
              <time dateTime={arena.kickoffUtc}>
                {new Date(arena.kickoffUtc).toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "UTC",
                })} UTC
              </time>
              {available ? (
                <Link href={arena.watchHref}>
                  {arena.mode === "LIVE"
                    ? "Enter Live Arena"
                    : status === "ARCHIVED"
                      ? "View Replay Archive"
                      : "Run Autonomous Replay"} →
                </Link>
              ) : (
                <span className="home-arena-board__pending">Awaiting arena activation</span>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="home-preview home-preview--proof" aria-labelledby="home-proof-title">
        <div className="home-proof-statement">
          <span>Public proof</span>
          <h2 id="home-proof-title">Watch first. Verify when ready.</h2>
          <p>
            Public event history links locked snapshots, simultaneous reveals,
            deterministic portfolio transitions, runtime versions, and the final result.
            Supporter backing and settlement remain separate on Solana.
          </p>
        </div>
        <div className="home-proof-action">
          <p>Watch and inspect evidence without a wallet. Sign only when taking a supporter action.</p>
          <Link className="product-text-link" href={featured.proofHref}>Inspect public proof <span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </main>
  );
}
