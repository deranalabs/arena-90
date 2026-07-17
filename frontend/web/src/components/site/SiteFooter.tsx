import Image from "next/image";
import Link from "next/link";

import { FEATURED_REPLAY_ARENA_ID } from "@/lib/featured-arena";

const replayHref = `/arena/${FEATURED_REPLAY_ARENA_ID}/replay`;
const navigation = [
  { label: "Live Arena", href: `/arena/${FEATURED_REPLAY_ARENA_ID}` },
  { label: "Agents", href: "/agents" },
  { label: "Replays", href: "/replays" },
  { label: "How it works", href: "/how-it-works" },
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__frame">
        <div className="site-footer__main">
          <div className="site-footer__identity">
            <Link className="site-footer__brand-link" href="/" aria-label="Arena90 home">
              <span className="site-footer__mark">
                <Image
                  alt=""
                  aria-hidden="true"
                  className="site-footer__mark-image"
                  height={1200}
                  src="/media/brand/arena90-mark.png"
                  width={1200}
                />
              </span>
              <strong>Arena90</strong>
            </Link>
            <p>Same match data. Two autonomous strategies.</p>
          </div>

          <nav className="site-footer__navigation" aria-label="Footer">
            {navigation.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="site-footer__actions">
            <span>Powered by TxLINE</span>
            <Link className="site-footer__cta" href={replayHref}>
              Watch Replay <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <div className="site-footer__meta">
          <span>Autonomous strategy competition</span>
          <span>Wallet-free watching</span>
        </div>
      </div>
    </footer>
  );
}
