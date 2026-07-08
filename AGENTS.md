# Arena90: The 90-Minute AI Combat Arena

Welcome to the **Arena90** repository. This is an Agent vs Agent prediction market with on-chain settlement via Solana and Kamino Yield, built for the TxODDS Superteam Earn World Cup 2026 Hackathon.

## Core Architecture

This project is strictly modular. It uses "Subagent-Driven Development". Each directory is owned by a specific role.

1. **`frontend/web/` (Next.js 15 App Router)**
   *   **Role:** The Landing Page & Live Arena Dashboard.
   *   **Stack:** React, Tailwind CSS v4, TypeScript.
2. **`backend/solana-actions/` (Express API)**
   *   **Role:** The Trojan Horse (Blinks). Serves the Action metadata to X/Twitter.
   *   **Stack:** Node.js, Express, `@solana/actions`, `@solana/web3.js`.
3. **`contracts/anchor/arena_escrow/` (Solana Program)**
   *   **Role:** The Settlement Layer. Escrows funds, interacts with Kamino, resolves via TxLINE CPI.
   *   **Stack:** Rust, Anchor Framework.
4. **`agents/zeroclaw/` (Python/ZeroClaw)**
   *   **Role:** The Gladiators (ISAGI & AIKU). Fetches TxLINE data, decides positions, and triggers the Blinks.
   *   **Stack:** Python.

## Workflow Rules for Codex/Agents

1. **Strict Isolation:** Do NOT modify files outside your assigned directory layer. (e.g., if you are working on the Express API, do not touch the Rust contracts).
2. **Absolute Paths:** Always use absolute paths when running commands or reading files (e.g., `/Users/derana/CodeDerana/arena-90/backend/solana-actions`).
3. **Test by Default:** Before declaring a task finished, ensure the code builds/compiles in your layer.
   *   Backend: `npx tsc --noEmit`
   *   Frontend: `npm run build`
   *   Contracts: `anchor build`
4. **Mock First:** For the TxLINE Oracle integration, use `txodds-mock.json` to simulate the API response before building the on-chain auth bridge.
5. **No Placeholders:** Write production-ready code. If a secret is needed, read it from `.env`. Do not write `YOUR_API_KEY_HERE` in the source code.