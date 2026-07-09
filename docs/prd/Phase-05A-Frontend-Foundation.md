# Arena90 — Phase 05A: Frontend Visual Foundation & Global Layout

**Status:** Approved
**Author:** Nagi (Hermes Agent)
**Date:** 2026-06-27

## 1. Goal
Establish the core visual system, global layout, and "Anti-Slop" design tokens (colors, typography, shapes) before building out individual sections. This ensures the landing page feels like a single cohesive "Cyber Pitch" rather than disconnected components.

## 2. Scope
- Tailwind v4 global configuration (fonts, colors, utilities).
- Global layout wrapper (Neo-Brutalist structure, persistent status).
- Global background implementation (Cyber Pitch layer).
- UI Primitives (Panels, Borders, clipped-corners).

## 3. User Stories
- **US-5A.1:** As a designer, I want the web app to use the Neo-Brutalist Bright hex codes and custom fonts (Space Grotesk/Chivo) so that the aesthetic stands out from generic dark-mode Web3 sites.
- **US-5A.2:** As a user, as I scroll through the page, I want to feel like I am moving through a continuous control room, grounded by a persistent HUD and dark cyber-pitch background.

## 4. Functional Requirements
- **FR-1:** Define Design Tokens in `frontend/web/src/app/globals.css` (Background: `#F4F4F0`, Text/Borders: `#000000`, ISAGI Accent: `#FF5555`, AIKU Accent: `#FFDD00`).
- **FR-2:** Set up global typography (Space Grotesk for headings, Chivo for body, JetBrains Mono for data). Ensure no generic Tailwind styling overrides this.
- **FR-3:** Build a `GlobalArenaLayout` component that wraps all page content, applying the bright off-white background and hard black borders.
- **FR-4:** Modify the base `Panel` primitive (React component) to enforce Neo-Brutalist rules: thick hard black borders (e.g., 2px solid black), sharp 0px border-radius, and flat solid shadows (e.g., `box-shadow: 4px 4px 0px #000`).

## 5. Definition of Done
- `npm run dev` displays the global layout with the correct dark background.
- Tailwind classes for custom Neo-Brutalist colors and shadows are usable.
- No bouncy physics or generic shadow cards exist in the codebase.