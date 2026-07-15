"use client";

import Link from "next/link";

import { AgentSummaryCard } from "@/components/arena/AgentSummaryCard";
import { CheckpointProgress } from "@/components/arena/CheckpointProgress";
import { CheckpointHistory } from "@/components/arena/CheckpointHistory";
import { ConnectionBanner } from "@/components/arena/ConnectionBanner";
import { FixtureHeader } from "@/components/arena/FixtureHeader";
import { FinalResultPanel } from "@/components/arena/FinalResultPanel";
import { useArenaSession } from "@/components/arena/useArenaSession";
import { Container } from "@/components/ui/container";
import type { RuntimeTransport } from "@/lib/arena-api/transport";
import { validateSpectatorView } from "@/lib/arena-api/view-invariants";

type ArenaShellProps = {
  arenaId: string;
  transport?: RuntimeTransport;
};

export function ArenaShell({ arenaId, transport }: ArenaShellProps) {
  const session = useArenaSession(arenaId, transport);
  const inconsistent = session.state
    ? !validateSpectatorView(session.state, session.events)
    : false;
  const unavailable = session.status === "FAILED" || inconsistent;
  const visibleState = unavailable ? undefined : session.state;
  const connectionStatus = inconsistent ? "FAILED" : session.status;
  const introTitleId = unavailable
    ? "arena-unavailable-title"
    : visibleState
      ? "arena-title"
      : "arena-loading-title";

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
        <section className="arena-intro" aria-labelledby={introTitleId}>
          <div>
            <p className="eyebrow eyebrow--inverse">Canonical spectator arena</p>
            {unavailable ? <h1 id="arena-unavailable-title">Arena unavailable</h1> : null}
            {!unavailable && !visibleState ? <h1 id="arena-loading-title">Arena loading</h1> : null}
          </div>
          <ConnectionBanner status={connectionStatus} snapshot={visibleState?.currentSnapshot} />
        </section>

        {unavailable ? (
          <section className="arena-unavailable" aria-label="Unavailable arena detail">
            <h2>Verified state unavailable</h2>
            <p>Verified public arena data is unavailable. No unverified fallback is shown.</p>
          </section>
        ) : visibleState ? (
          <>
            <FixtureHeader state={visibleState} />
            <section className="arena-agents" aria-label="Agent comparison">
              <AgentSummaryCard agentId="alpha" portfolio={visibleState.portfolios.alpha} state={visibleState} />
              <AgentSummaryCard agentId="beta" portfolio={visibleState.portfolios.beta} state={visibleState} />
            </section>
            <FinalResultPanel state={visibleState} />
            <CheckpointHistory state={visibleState} events={session.events} />
            <CheckpointProgress state={visibleState} events={session.events} />
          </>
        ) : (
          <section className="arena-loading-panel" aria-label="Arena loading">
            <p>Waiting for canonical public state.</p>
          </section>
        )}
      </Container>
    </main>
  );
}
