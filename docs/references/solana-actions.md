# Reference: Solana Actions & Blinks

**Source:** https://solana.com/docs/advanced/actions

## Core Concepts
- **Actions:** APIs returning transactions (signable) on Solana.
- **Blinks:** Client applications (e.g., browser extensions, bots) that introspect Action APIs and construct user interfaces to execute Actions directly.
- **Lifecycle:** 
  1. `GET` request returns Action metadata (title, icon, available actions).
  2. `POST` request (after user selects an action) returns a signable transaction.

## Implementation Details
- Requires `@solana/actions` npm package.
- Action URLs must respond with Cross-Origin resource sharing (CORS) headers on all endpoints.
- Provide an `actions.json` file at the domain root mapping standard URLs to Action endpoints.
- Example Blink URL: `https://example.domain/?action=<action_url>`
- The POST response must include a valid transaction constructed via `@solana/web3.js` and serialize it to base64.