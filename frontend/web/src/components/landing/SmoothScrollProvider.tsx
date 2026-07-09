"use client";

import { useEffect } from "react";

import "lenis/dist/lenis.css";

export function SmoothScrollProvider() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let lenis: { destroy: () => void } | undefined;

    async function initSmoothScroll() {
      const Lenis = (await import("lenis")).default;

      lenis = new Lenis({
        anchors: {
          offset: -72,
        },
        autoRaf: true,
        lerp: 0.08,
        prevent: (node) =>
          node.closest("[data-lenis-prevent]") !== null ||
          node.closest("[data-scroll-lock]") !== null,
        smoothWheel: true,
        syncTouch: false,
      });
    }

    initSmoothScroll();

    return () => {
      lenis?.destroy();
    };
  }, []);

  return null;
}
