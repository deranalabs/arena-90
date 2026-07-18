import Image from "next/image";
import Link from "next/link";

import { FeaturedArenaAction } from "@/components/site/FeaturedArenaAction";
import { SiteNavigation } from "@/components/site/SiteNavigation";
import { FEATURED_ARENA } from "@/lib/featured-arena";
import { SITE_NAVIGATION } from "@/lib/site-navigation";
import { resolveSupporterArena } from "@/lib/solana-actions/supporter-arena";

export function SiteHeader() {
  const supporterArena = resolveSupporterArena(FEATURED_ARENA.arenaId);

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

        <SiteNavigation
          items={SITE_NAVIGATION}
          mobileAction={
            <FeaturedArenaAction
              arenaHref={FEATURED_ARENA.arenaHref}
              arenaId={FEATURED_ARENA.arenaId}
              backingDeadlineUtc={supporterArena?.backingDeadlineUtc}
              mode={FEATURED_ARENA.mode}
              watchHref={FEATURED_ARENA.watchHref}
            />
          }
        />

        <div className="site-header__actions">
          <FeaturedArenaAction
            arenaHref={FEATURED_ARENA.arenaHref}
            arenaId={FEATURED_ARENA.arenaId}
            backingDeadlineUtc={supporterArena?.backingDeadlineUtc}
            mode={FEATURED_ARENA.mode}
            watchHref={FEATURED_ARENA.watchHref}
          />
        </div>
      </div>
    </header>
  );
}
