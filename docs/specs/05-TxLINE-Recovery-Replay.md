# Arena90 — TxLINE Recovery Replay Addendum

**Status:** Approved

This addendum defines the evidence-preserving fallback when a scheduled Live
arena fails to produce a complete autonomous run. It extends
`01-P0-Arena-Runtime.md` and `03-TxLINE-Live-Data-Adapter.md`; it does not turn
the failed Live run into a successful one.

## Contract

- A Recovery Replay uses a new arena identity and `REPLAY` mode.
- Its public manifest must say exactly
  `RECOVERY REPLAY — recorded data, not live execution`.
- It reads persisted TxLINE historical score and odds captures. Raw provider
  captures remain external evidence and are never committed.
- Score events are consumed once in capture order. Raw `Seq` must be contiguous;
  the compiler never sorts or deduplicates score events.
- Historical `Clock.Seconds` is absolute elapsed match time. Missing `StatusId`
  carries the last status. Status `5` means play ended but is not authoritative
  FINAL; only `game_finalised` with status `100` finalises the recording. A
  status-5 zero clock must not erase the last live elapsed clock.
- Odds are consumed once in capture order. `Ts` must be nondecreasing; equal
  timestamps preserve capture order. `MessageId` is evidence identity, not a
  sorting or deduplication key.
- The canonical market is the approved in-running full-match 1X2 market.
  Nonempty aligned `Prices` activate it; decimal `Pct` retains the existing
  normalization, while `Pct: "NA"` derives deterministic inverse-odds weights
  from `Prices`. Empty `Prices` and `Pct` arrays form a tombstone and make it
  unavailable until a later activation. A checkpoint
  sees only updates whose `Ts` is not later than its score event.
- All six decision checkpoints require an active market. FINAL may retain the
  terminal tombstone identity but must not carry a stale quote.
- Replay uses the normal autonomous decision and deterministic execution
  engine. Recording compilation, Replay composition, and playback do not call
  the Solana supporter lifecycle, resolver, or contracts.

## Evidence and acceptance

The local evidence directory is supplied through an environment variable.
Regression tests must cover the complete 1,197 score events and 75,650 odds
updates, the six canonical prices, the final 4–6 result at minute 98, terminal
market unavailability, input-order rejection, and no Solana lifecycle call.
