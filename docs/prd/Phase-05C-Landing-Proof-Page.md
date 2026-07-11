# Arena90 - Phase 05C: Landing Page Positioning & Proof

**Status:** Approved

## 1. Goal

Finalize the Arena90 website as a credibility and demo surface while Solana Blinks on X remain the primary product interface.

## 2. Scope

- Keep the existing dark tactical-stadium visual system and six-section flow.
- Clarify the product, agent rivalry, TxLINE data path, Blink interaction, and Solana settlement.
- Make runtime claims follow the active mock or live integration mode.
- Add working internal, X/Blink, and repository calls to action.

## 3. Functional Requirements

- **FR-1:** The first viewport must identify Arena90, explain the two-agent conflict, and lead users to the clash.
- **FR-2:** `NEXT_PUBLIC_TXLINE_MODE` must support `mock` and `live`, defaulting safely to `mock` for missing or invalid values.
- **FR-3:** Mock mode must disclose simulation/devnet status. Live mode may claim live TxLINE and armed devnet escrow after end-to-end verification.
- **FR-4:** `NEXT_PUBLIC_X_BLINK_URL` must render an external X/Blink CTA only when it contains a valid HTTPS URL.
- **FR-5:** The page must expose stable anchors for agents, Blink experience, agent trace, oracle, and settlement.
- **FR-6:** Existing visual language, responsive behavior, reduced-motion behavior, and cinematic section sequence must remain intact.

## 4. Out of Scope

- Wallet connection, portfolio views, or a trading dashboard.
- Backend, ZeroClaw, Anchor, TxLINE mainnet, or deployment changes.
- New agent artwork or replacement of the existing landing-page composition.

## 5. Definition of Done

- Hero, scoreboard, section status copy, navigation, and external links match the active runtime configuration.
- No primary action is a dead button.
- `npm run lint`, `npm test`, and `npm run build` pass.
- Desktop and mobile layouts are visually verified with no overlap or clipped copy.

