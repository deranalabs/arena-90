import Link from "next/link";

import { ProductPageIntro } from "@/components/product/ProductPageIntro";
import { listRecordedReplayArtifacts } from "@/lib/arena-api/recorded-replay-artifacts";

export default function ReplaysPage() {
  const replays = listRecordedReplayArtifacts();
  return (
    <main className="product-page product-page--editorial" aria-label="Arena90 replays">
      <ProductPageIntro
        aside={<p className="product-intro__count"><strong>{replays.length.toString().padStart(2, "0")}</strong><span>Recorded arenas available</span></p>}
        description="Historical TxLINE match data ran through the canonical competition engine. Each archive preserves the resulting autonomous decisions and deterministic event record."
        eyebrow="Autonomous Replay archive"
        title="Replay the evidence. Audit the decisions."
      />
      {replays.map((replay, index) => (
        <section
          className="replay-index"
          aria-labelledby={`recorded-replay-${index}`}
          key={replay.arenaId}
        >
          <div className="replay-index__number">{String(index + 1).padStart(3, "0")}</div>
          <div className="replay-index__copy">
            <p className="product-eyebrow">World Cup Semifinal · {replay.sourceLabel}</p>
            <h2 id={`recorded-replay-${index}`}>{replay.homeTeam} vs {replay.awayTeam}</h2>
            <p>Completed autonomous run over immutable recorded match evidence—not a live claim or scripted decision feed.</p>
          </div>
          <dl>
            <div><dt>Source</dt><dd>{replay.sourceLabel}</dd></div>
            <div><dt>Engine</dt><dd>Canonical runtime</dd></div>
            <div><dt>Public events</dt><dd>{replay.eventCount}</dd></div>
            <div><dt>Provenance hash</dt><dd>{replay.inputHash.slice(0, 12)}…</dd></div>
            <div><dt>Winner</dt><dd>{replay.winner === "DRAW" ? "Draw" : `Agent ${replay.winner === "alpha" ? "Alpha" : "Beta"}`}</dd></div>
          </dl>
          <div>
            <Link className="product-text-link" href={replay.watchHref}>
              Play event record <span aria-hidden="true">→</span>
            </Link>
            <Link className="product-text-link" href={replay.proofHref}>
              Inspect proof <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      ))}
    </main>
  );
}
