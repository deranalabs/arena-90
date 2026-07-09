# Arena90 — Phase 05A: Frontend Visual Foundation & Global Layout

**Status:** Approved
**Author:** Nagi (Hermes Agent)
**Date:** 2026-06-27

## 1. Goal
Establish the core visual system, global layout, and "Anti-Slop" design tokens (colors, typography, shapes) before building out individual sections. This ensures the landing page feels like a single cohesive "Cyber Pitch" rather than disconnected components.

## 2. Scope
- Tailwind v4 global configuration (fonts, colors, utilities).
- Global layout wrapper (HUD/Rail, persistent navigation/status).
- Global background implementation (Cyber Pitch layer).
- UI Primitives (Panels, Borders, clipped-corners).

## 3. User Stories
- **US-5A.1:** As a designer, I want the web app to use my precise hex codes and custom fonts (Poppins/Monospace) so that the aesthetic matches the "Tactical Anime/Mecha HUD" vision.
- **US-5A.2:** As a user, as I scroll through the page, I want to feel like I am moving through a continuous control room, grounded by a persistent HUD and dark cyber-pitch background.

## 4. Functional Requirements
- **FR-1:** Define Design Tokens in `frontend/web/src/app/globals.css` (Background: `#0A0B10`, ISAGI Red: `#FF2A5F`, AIKU Cyan: `#D4FF00`).
- **FR-2:** Set up global typography (Poppins for display/UI, Monospace for data). Ensure no generic Tailwind styling overrides this.
- **FR-3:** Build a `GlobalArenaLayout` component that wraps all page content, injecting the Cyber-Pitch background layer (`[3A] Cyber-Pitch WebP`) and applying a persistent HUD rail/sidebar.
- **FR-4:** Create a base `Panel` primitive (React component) that enforces the "Anti-Slop" rules: thin borders, minimal/no radius, and diagonal clipped corners (using `clip-path`).

## 5. Definition of Done
- `npm run dev` displays the global layout with the correct dark background.
- Tailwind classes for custom colors (`bg-arena-red`, `text-arena-cyan`) and clipped shapes are usable.
- No bouncy physics or generic shadow cards exist in the codebase.