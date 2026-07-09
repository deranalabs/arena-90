# AI Assistant Handoff Protocol

This file ensures that AI assistants (like Codex, Cursor, or Claude Code) do not hallucinate tech stacks or rewrite rules.

## Dependencies (Mandatory)
- **Frontend:** Next.js 15, React 19, Tailwind CSS v4.
- **Backend:** Node.js, Express, `@solana/actions`, `@solana/web3.js`.
- **Contracts:** Rust, Anchor.
- **Agents:** Python 3.

## Rules for AI Assistants
1. You must READ `/Users/derana/CodeDerana/arena-90/AGENTS.md` before starting any coding task.
2. **Anti-Slop Design Mandate:** For frontend tasks, read the Phase PRD carefully. Enforce sharp edges (`clip-path`), strict color palettes, and Framer Motion linear transitions. NO generic shadow cards or bouncy animations.
3. You must READ the documentation references in `/Users/derana/CodeDerana/arena-90/docs/references/` to ensure your code matches the requested framework APIs. Do not hallucinate usage.
4. Read the specific Phase PRD (e.g., `docs/prd/Phase-05A-Frontend-Foundation.md`) provided in the prompt. Do not attempt to build the whole project at once.
5. Stop and ask the human for verification after completing a single Phase.
6. "Mock First" rule: Never attempt to authenticate with the live TxLINE or Kamino API until the Phase explicitly asks for it. Use local JSON mocks.