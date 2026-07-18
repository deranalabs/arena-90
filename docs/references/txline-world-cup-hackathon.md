# Reference: TxLINE World Cup Hackathon Track

**Status:** Reference
**Last verified:** 2026-07-17

Primary sources:

- https://superteam.fun/earn/listing/trading-tools-and-agents
- https://txline.txodds.com/documentation/quickstart
- https://txline.txodds.com/documentation/worldcup

## Submission Facts

- Submission closes 2026-07-19 at 23:59 UTC.
- Required: demo video up to five minutes, public repository, and a working
  deployed website or functional API/devnet endpoint.
- Brief technical documentation must identify the TxLINE endpoints used and
  include integration feedback.
- A submission must be a running agent or tool that integrates TxLINE as a
  live input and executes a defined strategy.
- The judging lens is live/simulated ingestion, autonomous operation, clean and
  defensible logic, novelty, and production readiness.
- TxLINE covers all 104 World Cup matches and cryptographically anchors updates
  on Solana.

## TxLINE Integration Facts

- TxLINE uses a hybrid off-chain API and Solana subscription/verification
  model.
- Fixture, odds, score, and validation-proof endpoints are available.
- API requests use a guest JWT plus an activated API token.
- Network configuration must remain consistent across RPC, program ID, guest
  authentication, activation host, and API host.
- Mainnet free service level `1` is 60-second delayed; mainnet service level
  `12` is real-time. Devnet interval must be read from its current on-chain
  pricing matrix rather than assumed.
- Credentials and signing material must not appear in Git, public logs, or the
  browser.

This reference records external facts only. Approved product documents and
technical specifications own Arena90 behavior.
