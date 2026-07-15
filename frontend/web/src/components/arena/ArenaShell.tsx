"use client";

import Link from "next/link";

import { AgentSummaryCard } from "@/components/arena/AgentSummaryCard";
import { CheckpointProgress } from "@/components/arena/CheckpointProgress";
import { ConnectionBanner } from "@/components/arena/ConnectionBanner";
import { FixtureHeader } from "@/components/arena/FixtureHeader";
import { useArenaSession } from "@/components/arena/useArenaSession";
import { Container } from "@/components/ui/container";
import type { RuntimeTransport } from "@/lib/arena-api/transport";

type ArenaShellProps = {
  arenaId: string;
  transport?: RuntimeTransport;
};

export function ArenaShell({ arenaId, transport }: ArenaShellProps) {
  const session = useArenaSession(arenaId, transport);
  const unavailable = session.status === "FAILED";
  const introTitleId = unavailable
    ? "arena-unavailable-title"
    : session.state
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
            {!unavailable && !session.state ? <h1 id="arena-loading-title">Arena loading</h1> : null}
          </div>
          <ConnectionBanner status={session.status} snapshot={session.state?.currentSnapshot} />
        </section>

        {unavailable ? (
          <section className="arena-unavailable" aria-label="Unavailable arena detail">
            <h2>Verified state unavailable</h2>
            <p>Verified public arena data is unavailable. No unverified fallback is shown.</p>
          </section>
        ) : session.state ? (
          <>
            <FixtureHeader state={session.state} />
            <CheckpointProgress state={session.state} events={session.events} />
            <section className="arena-agents" aria-label="Agent comparison">
              <AgentSummaryCard agentId="alpha" portfolio={session.state.portfolios.alpha} state={session.state} />
              <AgentSummaryCard agentId="beta" portfolio={session.state.portfolios.beta} state={session.state} />
            </section>
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
