"use client";

import { useEffect, useRef, useState } from "react";

import {
  createSpectatorSession,
  type SpectatorSessionSnapshot,
} from "@/lib/arena-api/spectator-session";
import {
  createRuntimeTransport,
  type RuntimeTransport,
} from "@/lib/arena-api/transport";

const initialSnapshot: SpectatorSessionSnapshot = {
  status: "IDLE",
  events: [],
  lastConfirmedSequence: 0,
};

export function useArenaSession(
  arenaId: string,
  injectedTransport?: RuntimeTransport,
) {
  const defaultTransport = useRef<RuntimeTransport | null>(null);
  if (!injectedTransport && defaultTransport.current === null) {
    defaultTransport.current = createRuntimeTransport();
  }
  const transport = injectedTransport ?? defaultTransport.current!;
  const [sessionView, setSessionView] = useState<{
    arenaId: string;
    snapshot: SpectatorSessionSnapshot;
  }>(() => ({ arenaId, snapshot: initialSnapshot }));
  const snapshot =
    sessionView.arenaId === arenaId ? sessionView.snapshot : initialSnapshot;

  useEffect(() => {
    const session = createSpectatorSession({ arenaId, transport });
    setSessionView({ arenaId, snapshot: session.getSnapshot() });
    const unsubscribe = session.subscribe((nextSnapshot) => {
      setSessionView({ arenaId, snapshot: nextSnapshot });
    });
    void session.start();

    return () => {
      unsubscribe();
      void session.dispose();
    };
  }, [arenaId, transport]);

  return snapshot;
}
