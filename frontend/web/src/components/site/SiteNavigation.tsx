"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";

import type { SiteNavigationItem } from "@/lib/site-navigation";

export function isSiteNavigationItemActive(
  pathname: string,
  item: SiteNavigationItem,
) {
  if (item.id === "arena") {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  if (item.id === "replays") {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavigationLinks({
  items,
  onNavigate,
}: Readonly<{
  items: readonly SiteNavigationItem[];
  onNavigate?: () => void;
}>) {
  const pathname = usePathname();

  return items.map((item) => {
    const active = isSiteNavigationItemActive(pathname, item);
    return (
      <Link
        aria-current={active ? "page" : undefined}
        href={item.href}
        key={item.id}
        onClick={onNavigate}
      >
        {item.label}
      </Link>
    );
  });
}

export function SiteNavigation({
  items,
  mobileAction,
}: Readonly<{
  items: readonly SiteNavigationItem[];
  mobileAction: ReactNode;
}>) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav className="site-navigation site-nav" aria-label="Primary">
        <NavigationLinks items={items} />
      </nav>

      <div className="site-mobile-navigation">
        <button
          aria-controls="mobile-primary-navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
          type="button"
        >
          <span className="site-mobile-navigation__icon" aria-hidden="true" />
          Menu
        </button>
        {mobileOpen ? (
          <nav aria-label="Mobile primary" id="mobile-primary-navigation">
            <NavigationLinks items={items} onNavigate={() => setMobileOpen(false)} />
            <div className="site-mobile-navigation__action">{mobileAction}</div>
          </nav>
        ) : null}
      </div>
    </>
  );
}
