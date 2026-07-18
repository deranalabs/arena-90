import Image from "next/image";
import Link from "next/link";

const trustLinks = [
  { label: "GitHub", href: "https://github.com/deranalabs/arena-90" },
  { label: "X", href: "https://x.com/arena90ai" },
  { label: "TxLINE Docs", href: "https://txline.txodds.com/documentation/quickstart" },
  { label: "Solana", href: "https://solana.com/" },
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
            <p>Same verified match data. Two autonomous strategies. Deterministic execution.</p>
          </div>

          <p className="site-footer__colophon">
            Autonomous strategy competition<br />
            Public runtime and proof surfaces
          </p>
        </div>

        <div className="site-footer__lower">
          <p className="site-footer__section-label">Project links</p>
          <nav className="site-footer__trust" aria-label="Project links">
            {trustLinks.map((item) => (
              <a href={item.href} key={item.href} rel="noreferrer" target="_blank">
                {item.label} <span aria-hidden="true">↗</span>
              </a>
            ))}
          </nav>
        </div>

        <div className="site-footer__meta">
          <span>Powered by TxLINE · Solana devnet settlement</span>
          <span>Wallet-free watching · supporter funds stay separate</span>
        </div>
      </div>
    </footer>
  );
}
