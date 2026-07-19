import Link from "next/link";

import { ReplayIcon } from "@/components/icons/ReplayIcons";
import { ProductPageIntro } from "@/components/product/ProductPageIntro";
import { listRecordedReplayArtifacts } from "@/lib/arena-api/recorded-replay-artifacts";
import styles from "./replays.module.css";

export default function ReplaysPage() {
  const replays = listRecordedReplayArtifacts();
  return (
    <main className={`product-page ${styles.replaysPage}`} aria-label="Arena90 replays">
      <ProductPageIntro
        aside={<p className="product-intro__count"><strong>{replays.length.toString().padStart(2, "0")}</strong><span><ReplayIcon name="archive" /> Recorded arenas available</span></p>}
        description="Historical TxLINE match data ran through the canonical competition engine. Each archive preserves the resulting autonomous decisions and deterministic event record."
        eyebrow="Autonomous Replay archive"
        layout="front-page"
        meta={`Archive / ${replays.length.toString().padStart(2, "0")}`}
        title="Replay the evidence. Audit the decisions."
      />
      <ol className={styles.archive} aria-label="Recorded autonomous arenas">
        {replays.map((replay, index) => (
          <li className={styles.archiveItem} key={replay.arenaId}>
            <article className={styles.replay} aria-labelledby={`recorded-replay-${index}`}>
              <div className={styles.number}>{String(index + 1).padStart(3, "0")}</div>
              <div className={styles.copy}>
                <p className="product-eyebrow">{replay.competition}</p>
                <h2 id={`recorded-replay-${index}`}>{replay.homeTeam} <span>vs</span> {replay.awayTeam}</h2>
                <p>{replay.disclosure ?? "Completed autonomous run over recorded match evidence."}</p>
                <dl className={styles.facts}>
                  <div><dt><ReplayIcon name="source" /> Source</dt><dd>{replay.sourceLabel}</dd></div>
                  <div><dt><ReplayIcon name="events" /> Events</dt><dd>{replay.eventCount}</dd></div>
                  <div><dt><ReplayIcon name="engine" /> Engine</dt><dd>Canonical runtime</dd></div>
                </dl>
              </div>
              <div className={styles.outcome}>
                <span><ReplayIcon name="winner" /> Winner</span>
                <strong>{replay.winner === "DRAW" ? "Draw" : `Agent ${replay.winner === "alpha" ? "Alpha" : "Beta"}`}</strong>
              </div>
              <div className={styles.actions}>
                <Link className={styles.primaryAction} href={replay.watchHref}>
                  <ReplayIcon name="play" /> Play replay <span aria-hidden="true">→</span>
                </Link>
                <Link className={styles.proofAction} href={replay.proofHref}>
                  <ReplayIcon name="proof" /> Inspect proof <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </article>
          </li>
        ))}
      </ol>
    </main>
  );
}
