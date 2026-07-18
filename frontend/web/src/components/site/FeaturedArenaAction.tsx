"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { createRuntimeTransport } from "@/lib/arena-api/transport";

type ArenaPhase = "READY" | "RUNNING" | "FINALIZING" | "COMPLETED";

type FeaturedArenaActionProps = Readonly<{
  arenaHref: string;
  arenaId: string;
  backingDeadlineUtc?: string;
  mode: "LIVE" | "REPLAY";
  watchHref: string;
}>;

export function resolveFeaturedArenaAction(
  props: FeaturedArenaActionProps,
  phase: ArenaPhase | undefined,
  nowMs = Date.now(),
) {
  if (props.mode === "REPLAY") {
    return { href: props.watchHref, label: "Watch Replay" };
  }
  if (phase === "RUNNING") {
    return { href: props.arenaHref, label: "Watch Live" };
  }
  if (phase === "FINALIZING") {
    return { href: props.arenaHref, label: "Track Settlement" };
  }
  if (phase === "COMPLETED") {
    return { href: props.arenaHref, label: "Watch Replay" };
  }
  if (
    phase === "READY" &&
    props.backingDeadlineUtc &&
    nowMs < Date.parse(props.backingDeadlineUtc)
  ) {
    return { href: `${props.arenaHref}#support-arena`, label: "Back an Agent" };
  }
  return { href: props.arenaHref, label: "View Arena" };
}

export function FeaturedArenaAction(props: FeaturedArenaActionProps) {
  const [phase, setPhase] = useState<ArenaPhase>();

  useEffect(() => {
    if (typeof globalThis.fetch !== "function") return;

    const controller = new AbortController();
    const transport = createRuntimeTransport();

    const refresh = async () => {
      try {
        const state = await transport.readState(props.arenaId, controller.signal);
        setPhase(state.phase);
      } catch {
        // Keep the honest, non-live fallback when runtime state is unavailable.
      }
    };

    void refresh();
    const interval = window.setInterval(() => void refresh(), 15_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [props.arenaId]);

  const action = resolveFeaturedArenaAction(props, phase);
  return (
    <Link className="site-header__cta" href={action.href}>
      {action.label} <span aria-hidden="true">→</span>
    </Link>
  );
}
