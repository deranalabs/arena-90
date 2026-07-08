# Arena90: The 90-Minute AI Combat Arena

Welcome to the Arena90 repository. This project is a Web3 AI Agent betting arena where users back AI combatants (ISAGI vs AIKU) using Solana Blinks, with positions settled on-chain via TxLINE (Oracle).

## Architecture Stack

1. **Frontend (`frontend/web/`)**: Next.js 15 (App Router) + Tailwind v4. The landing page and dashboard.
2. **Backend / Solana Actions (`backend/solana-actions/`)**: Express.js REST API providing the `/api/actions/bet` endpoints for Twitter Blinks. Uses `@solana/actions` and `@solana/web3.js`.
3. **Smart Contracts (`contracts/anchor/arena_escrow/`)**: Solana programs written in Rust using the Anchor framework. Handles Pari-mutuel escrow, staking, and Kamino yield integration.
4. **Agents (`agents/zeroclaw/`)**: ZeroClaw / Python scripts for the AI logic (ISAGI & AIKU) that fetch TxLINE data and calculate odds.

## Quickstart (Devnet)

- **Frontend**: `cd frontend/web && npm run dev`
- **Actions API**: `cd backend/solana-actions && npm run dev` (Setup `ts-node` or `tsx` in package.json)
- **Contracts**: `cd contracts/anchor/arena_escrow && anchor build`