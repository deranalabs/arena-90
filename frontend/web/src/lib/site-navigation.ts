import { FEATURED_ARENA } from "@/lib/featured-arena";

export type SiteNavigationItem = Readonly<{
  id: "arena" | "replays" | "agents" | "how-it-works";
  label: string;
  href: string;
}>;

export const SITE_NAVIGATION: readonly SiteNavigationItem[] = Object.freeze([
  {
    id: "arena",
    label: FEATURED_ARENA.navigationLabel,
    href: FEATURED_ARENA.arenaHref,
  },
  { id: "replays", label: "Replays", href: "/replays" },
  { id: "agents", label: "Agents", href: "/agents" },
  { id: "how-it-works", label: "How it works", href: "/how-it-works" },
]);
