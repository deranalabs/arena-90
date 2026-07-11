# Arena90: The 90-Minute AI Combat Arena
# Subagent-Driven Development Protocol & Rules

## 1. Repository Purpose & Architecture
Arena90 is an Agent vs Agent prediction market with on-chain settlement via Solana and Kamino Yield, built for the TxODDS Superteam Earn World Cup 2026 Hackathon.
The architecture is strictly modular, divided into distinct layers:
- **`frontend/web/` (Next.js 15)**: The Landing Page & Live Arena Dashboard.
- **`backend/solana-actions/` (Express API)**: The Trojan Horse (Blinks) serving Action metadata to X/Twitter.
- **`contracts/anchor/arena_escrow/` (Rust/Anchor)**: Settlement Layer escrowing funds and routing Kamino yield.
- **`agents/zeroclaw/` (Python)**: The Gladiators (ISAGI & AIKU) ingesting TxLINE data and triggering state changes.
Each directory is owned by a specific role. Boundaries must be respected.

## 2. Scope & Isolation Rules
- **Strict Isolation:** Agents must ONLY modify files within their assigned layer directory.
- **Cross-Layer Changes:** Modifying multiple layers simultaneously requires explicit user authorization.
- **Global Scope:** Shared files such as `AGENTS.md`, CI/CD workflows (`.github/workflows/`), and root documentation are treated as global scope.
- **Respect Local Code:** Do not blindly overwrite existing local changes or monolithic structures without inspecting them first.

## 3. Standard Workflow
Strictly follow this execution order for every task:
`inspect` → `implement` → `lint/typecheck` → `test` → `build` → `report`

- **Tool Execution:** Always use **absolute paths** when executing terminal commands.
- **Source Code Paths:** NEVER hardcode absolute machine paths (e.g., `/Users/derana/...`) inside the source code. Use relative paths or environment variables.
- **Mock First:** Use `txodds-mock.json` to simulate the Oracle API before integrating real endpoints.
- **No Placeholders:** Write production-ready code. Never leave `YOUR_API_KEY_HERE` or empty function stubs.
- **No Destructive Git Ops:** Do not force-push, delete branches, or reset history without permission.

## 4. Layer Validation Commands
Always validate your changes using the following commands in the respective directories:

### Frontend
Working directory: `frontend/web/`
- Install: `npm ci`
- Lint: `npm run lint`
- Test: `npm test -- --runInBand`
- Build: `npm run build`

### Backend
Working directory: `backend/solana-actions/`
- Install: `npm ci`
- Typecheck: `npm run build`
- Test: `npm test -- --runInBand`

### Contracts
Working directory: `contracts/anchor/arena_escrow/`
- Build: `anchor build`
- Test: `cargo test`

### Agents
Working directory: `agents/zeroclaw/`
- Shell syntax check: `bash -n run_clash.sh`
- Smoke test: `ARENA90_ZEROCLAW_REQUIRE_SUCCESS=1 ./run_clash.sh`
*(Note: Python testing via `pytest` is currently a gap until `pyproject.toml` and a `tests/` directory are fully established. Rely on the shell smoke test for now).*

## 5. Cross-Layer Contracts
Since isolation is strict, communication between layers must be carefully managed:
- **`txodds-mock.json`:** Defines the TxLINE input schema. Owned by the backend/agents shared data structure.
- **`clash-state.json` (Runtime):** Generated and owned by `agents/zeroclaw/`. Read by both `frontend/web/` and `backend/solana-actions/`.
- **Write Permissions:** Agents operating in `agents/zeroclaw/` are permitted to write state outputs to a shared location accessible by the backend, but must not directly alter backend source code to do so.
- **Schema Changes:** Any change to a JSON schema must synchronously update the tests and consumers in the impacted layers.

## 6. Environment & Secrets
- **Strictly `.env`:** All secrets MUST come from environment variables.
- **No Commits:** Never commit `.env` files.
- **Maintenance:** Always update `.env.example` when introducing a new configuration variable.
- **No Hardcoding:** Never hardcode API keys, wallet secrets, RPC credentials, or local machine paths in the source code.
- **Public Keys:** If a public key or non-secret ID is hardcoded, add a comment explaining why it is safe and intentional.

## 7. Definition of Done
A task is only considered complete when:
- Modifications are strictly limited to the authorized scope/layer.
- The layer's specific Lint, Typecheck, Test, and Build commands pass successfully.
- Tests have been added or updated to reflect behavioral changes.
- No secrets, placeholder text, or hardcoded machine paths exist in the code.
- Documentation and `.env.example` are updated if interfaces/configs change.
- The agent explicitly reports the commands run, the outcome, and any remaining blockers.

## 8. CI and Global Changes
Changes to the following are considered **Global**:
- `.github/workflows/**`
- `AGENTS.md` and root documentation (`docs/`)
- Shared schema definitions
- Cross-layer toolchain or dependency versions (e.g., bumping Node/Rust versions)

*Rule:* If you make a Global Change, you must validate ALL impacted layers, not just the one you are currently working on.