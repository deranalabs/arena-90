import Link from "next/link";

import { AgentFoundationCard } from "@/components/arena/AgentFoundationCard";
import { Container } from "@/components/ui/container";
import { Surface } from "@/components/ui/surface";

type ArenaShellProps = {
  arenaId: string;
};

const agents = [
  {
    id: "alpha",
    label: "Agent Alpha",
    lens: "Momentum & Repricing",
    descriptor: "Recent change, acceleration, and market response",
  },
  {
    id: "beta",
    label: "Agent Beta",
    lens: "Structure & Valuation Control",
    descriptor: "Baseline structure, consistency, and margin of safety",
  },
] as const;

export function ArenaShell({ arenaId }: ArenaShellProps) {
  return (
    <main className="arena-page">
      <header className="arena-header">
        <Container className="arena-header__inner">
          <Link className="arena-back-link" href="/">
            <span aria-hidden="true">←</span> Back to Arena90
          </Link>
          <div className="arena-reference">
            <span>Arena reference</span>
            <strong>{arenaId}</strong>
          </div>
        </Container>
      </header>

      <Container className="arena-layout">
        <section className="arena-intro" aria-labelledby="arena-title">
          <div>
            <p className="eyebrow eyebrow--inverse">Spectator foundation</p>
            <h1 id="arena-title">Arena broadcast</h1>
          </div>
          <div className="arena-state-label" role="status">
            <span aria-hidden="true" />
            <div>
              <strong>Waiting for verified runtime state</strong>
              <p>Runtime data not connected</p>
            </div>
          </div>
        </section>

        <Surface className="stadium-shell" tone="ink">
          <div className="stadium-shell__masthead">
            <span>Fixture not loaded</span>
            <span>Mode —</span>
            <span>Lifecycle —</span>
          </div>
          <div className="stadium-shell__pitch" aria-hidden="true">
            <span className="stadium-shell__halfway" />
            <span className="stadium-shell__circle" />
            <span className="stadium-shell__spot" />
          </div>
          <div className="stadium-shell__message">
            <p>Canonical match centre</p>
            <span>
              Score, minute, source, and freshness appear only after public
              runtime state is available.
            </span>
          </div>
        </Surface>

        <section className="arena-agents" aria-label="Agent comparison">
          {agents.map((agent) => (
            <AgentFoundationCard agent={agent} key={agent.id} />
          ))}
        </section>

        <section className="arena-lower-grid">
          <Surface className="arena-placeholder-panel">
            <p className="eyebrow">Decision round</p>
            <h2>Shared snapshot</h2>
            <p>
              No snapshot loaded. Agent decisions remain unavailable until an
              official simultaneous reveal.
            </p>
          </Surface>
          <Surface className="arena-placeholder-panel">
            <p className="eyebrow">Append-only record</p>
            <h2>Public event timeline</h2>
            <p>No public events loaded.</p>
          </Surface>
        </section>
      </Container>
    </main>
  );
}
