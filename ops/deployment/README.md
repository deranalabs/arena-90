# Arena90 Deployment Runbook

This is the only operator workflow for demo deployment. Product behavior is
owned by approved docs; this file owns release order and rollback.

## Shape

```text
TxLINE/TxODDS
      |
      v
VPS runtime (loopback :3100, one locked arena, autostart)
      |
      v
Caddy read-only seam (loopback :3200, GET only)
      |
      v
Vercel same-origin gateway --> browser

VPS Solana resolver (separate process + key)
      |-- reads canonical runtime persistence
      |-- prepares and locks supporter arena
      `-- TxLINE proof + canonical result --> Anchor devnet settlement

VPS Solana Actions (loopback :8787, no signing key)
      `-- GET metadata + POST unsigned supporter transactions
```

The browser sees only Vercel. Vercel forwards allowlisted GET requests to the
read-only runtime origin. Supervised runtimes expose no public create/run seam.

Deployment and emergency recovery are operator actions. Normal arena operation
is not: after systemd starts the configured service, the supervisor creates or
resumes the locked arena, waits for TxLINE checkpoints, invokes both agents,
reveals and executes decisions, and finalizes without browser traffic or
routine operator commands.

The Solana resolver is a separate systemd service. Its resolver key is never
present in the runtime, ZeroClaw, frontend, public Action service, or immutable
runtime release. It reads the same atomic runtime persistence and retries
idempotent prepare, lock, proof, and settlement operations.

The Solana Actions service has no wallet or resolver key. Caddy exposes only
its GET, POST, and OPTIONS Action routes; all transactions remain unsigned for
the supporter wallet to approve. Its Origin allowlist is a browser/CORS
defense, not request authentication: server-side Blink clients may omit
`Origin`, while canonical arena binding, strict input validation, unsigned
transactions, and rate limits remain active.

## Preflight

1. Runtime build, full tests, ZeroClaw base smoke, and strategy smoke pass.
2. Selected fixture identity and market connectivity are revalidated.
3. Release checksum matches after upload.
4. Credential JSON is outside Git/releases and mode `0600`.
5. Frontend builds with Replay and selected Live presets.
6. Previous runtime env and active release symlink are preserved.

## Atomic Replay to Live Activation

Do not switch frontend first.

1. Upload and extract the immutable runtime release without moving `current`.
2. Install the selected manifest and binding under `shared/config`.
3. Install credentials under `shared/txline` with mode `0600`.
4. Replace `shared/runtime.env` using `runtime.live.env.example` as key list.
5. Move `current` to the release and restart `arena90-runtime.service`.
6. Verify health, readiness, locked state, history, SSE, and blocked POSTs.
7. Restart once; verify the same revision resumes with no duplicate event.
8. Set Vercel `ARENA90_FEATURED_ARENA` to the matching preset and deploy.
9. Verify home/header/footer/proof links, same-origin state, and SSE in browser.

The switch completes only after step 9. VPS process health alone is not an
end-to-end Live deployment.

## Approved World Cup Presets

| Preset | Arena | Fixture | Kickoff UTC |
| --- | --- | --- | --- |
| `WORLD_CUP_THIRD_PLACE` | France vs England | `18257865` | 2026-07-18 21:00 |
| `WORLD_CUP_FINAL` | Spain vs Argentina | `18257739` | 2026-07-19 19:00 |

Revalidate identity, approved market, and freshness before activation.

## Rollback

1. Set Vercel preset to `FOUNDATION_REPLAY` and deploy.
2. Restore saved Replay runtime env and previous `current` symlink.
3. Restart runtime; verify Replay state, history, SSE, and gateway.

Never delete persistence, rewrite events, expose mutations, or force-rewrite
Git history during rollback.
