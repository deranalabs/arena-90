import Image from "next/image";
import Link from "next/link";

import { FEATURED_ARENA } from "@/lib/featured-arena";

const navigation = [
  { label: FEATURED_ARENA.navigationLabel, href: FEATURED_ARENA.arenaHref },
  { label: "Agents", href: "/agents" },
  { label: "Replays", href: "/replays" },
  { label: "How it works", href: "/how-it-works" },
] as const;

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__frame site-header__frame--compact">
        <div className="site-brand-lockup">
          <Link className="site-brand" href="/" aria-label="Arena90 home">
            <span className="site-brand__mark">
              <Image
                className="site-brand__mark-image"
                src="/media/brand/arena90-mark.png"
                alt="Arena90 arena mark"
                width={1200}
                height={1200}
                priority
              />
            </span>
            <strong>Arena90</strong>
          </Link>
          <span className="site-brand-lockup__separator" aria-hidden="true" />
          <Image
            className="site-brand-lockup__partner"
            src="/media/partners/wc-hackathon.png"
            alt="World Cup Hackathon 2026"
            width={320}
            height={138}
            priority
          />
        </div>

        <nav className="site-navigation site-nav" aria-label="Primary">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="site-header__actions">
          <Link className="site-header__proof" href={FEATURED_ARENA.proofHref}>
            Public proof
          </Link>
          <Link className="site-header__cta" href={FEATURED_ARENA.watchHref}>
            {FEATURED_ARENA.watchLabel} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
