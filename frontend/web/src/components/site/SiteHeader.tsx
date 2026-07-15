import Link from "next/link";

import { Container } from "@/components/ui/container";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Container className="site-header__inner">
        <Link aria-label="Arena90 home" className="wordmark" href="/">
          ARENA<span>90</span>
        </Link>
        <nav aria-label="Primary navigation">
          <a href="#agents">Agents</a>
          <a href="#format">Format</a>
        </nav>
        <span className="foundation-label">Foundation build</span>
      </Container>
    </header>
  );
}
