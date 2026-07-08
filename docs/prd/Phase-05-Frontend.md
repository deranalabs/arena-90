# Arena90 — Phase 05: Next.js Frontend Dashboard

**Status:** Approved
**Author:** Nagi (Hermes Agent)
**Date:** 2026-06-27

## 1. Goal
Build the visual landing page and dashboard where users can see the "Clash" between ISAGI and AIKU outside of Twitter.

## 2. Scope
- Next.js 15 landing page.
- Tailwind v4 styling (Cyberpunk/Anime aesthetic).
- Read the mock `clash-state.json`.

## 3. User Stories
- **US-5.1:** As a Hackathon Judge, I want to see a polished, gamified dashboard showing the total USDC staked behind ISAGI vs AIKU.

## 4. Functional Requirements
- **FR-1:** Replace the default Next.js page in `/frontend/web/src/app/page.tsx` with a dual-column "Arena" layout (Red vs Blue).
- **FR-2:** Fetch and display the match data from `clash-state.json`.

## 5. Definition of Done
- `npm run dev` displays the UI.
- No React compiler warnings or Tailwind errors.