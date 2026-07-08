# AI Assistant Handoff Protocol

This file ensures that AI assistants (like Codex, Cursor, or Claude Code) do not hallucinate tech stacks or rewrite rules.

## Dependencies (Mandatory)
- **Frontend:** Next.js 15, React 19, Tailwind CSS v4.
- **Backend:** Node.js, Express, `@solana/actions`, `@solana/web3.js`.
- **Contracts:** Rust, Anchor.
- **Agents:** Python 3.

## Rules for AI Assistants
1. You must READ `/Users/derana/CodeDerana/arena-90/AGENTS.md` before starting any coding task.
2. You must READ the documentation references in `/Users/derana/CodeDerana/arena-90/docs/references/` to ensure your code matches the requested framework APIs. Do not hallucinate usage.
3. Read the specific Phase PRD (e.g., `docs/prd/Phase-01-Setup.md`) provided in the prompt. Do not attempt to build the whole project at once.
3. Stop and ask the human for verification after completing a single Phase.
4. "Mock First" rule: Never attempt to authenticate with the live TxLINE or Kamino API until the Phase explicitly asks for it. Use local JSON mocks.