import { readFileSync } from "node:fs";
import { join } from "node:path";

const stylesheet = readFileSync(
  join(process.cwd(), "src/app/globals.css"),
  "utf8",
);
const homeStylesheet = readFileSync(
  join(process.cwd(), "src/app/home.module.css"),
  "utf8",
);

describe("Arena90 design foundation", () => {
  it("uses one semantic Arena90 palette with compatibility role aliases", () => {
    const tokens = [
      "--color-paper: oklch(95% 0.018 91);",
      "--color-night: oklch(13% 0.022 265);",
      "--color-night-2: oklch(18% 0.028 265);",
      "--color-night-3: oklch(23% 0.032 265);",
      "--color-night-rule: oklch(34% 0.03 265);",
      "--color-night-ink: oklch(93% 0.015 88);",
      "--color-alpha-hot: oklch(65% 0.23 20);",
      "--color-beta-hot: oklch(63% 0.18 272);",
      "--color-data: oklch(80% 0.13 180);",
      "--color-tournament: oklch(92% 0.17 100);",
      "--arena-night: var(--color-night);",
      "--arena-text: var(--color-night-ink);",
    ];

    for (const token of tokens) expect(stylesheet).toContain(token);
    expect(stylesheet).toMatch(
      /body\s*{[^}]*background:\s*var\(--arena-night\)[^}]*color:\s*var\(--arena-text\)/,
    );
    expect(stylesheet).toMatch(
      /\.site-header\s*{[^}]*background:\s*var\(--arena-night\)/,
    );
    expect(stylesheet).not.toMatch(/#d5eadb|#dfdaec|font-weight:\s*900/i);
  });

  it("preserves the neutral canvas and accessibility foundation", () => {
    expect(stylesheet).toContain("@import \"tailwindcss\";");
    expect(stylesheet).toMatch(/\.reset-canvas\s*{/);
    expect(stylesheet).toMatch(/:focus-visible\s*{/);
    expect(stylesheet).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(stylesheet).not.toMatch(
      /duel-board|fixture-scoreboard|portfolio|final-result|public-page/,
    );
  });

  it("uses the bundled Poppins family through semantic font tokens", () => {
    expect(stylesheet.match(/^:root\s*{/gm)).toHaveLength(1);
    expect(stylesheet).toContain(
      "--font-display: var(--font-poppins), system-ui, sans-serif;",
    );
    expect(stylesheet).toContain(
      "--font-body: var(--font-poppins), system-ui, sans-serif;",
    );
    expect(stylesheet).toContain(
      "--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;",
    );
    expect(stylesheet).toContain("--font-ui: var(--font-body);");
    expect(stylesheet).toContain("--font-outlier: var(--font-mono);");
    expect(stylesheet).toContain("--weight-heading: 600;");
    expect(stylesheet).toContain("--weight-display: 700;");
    expect(stylesheet).toMatch(
      /body\s*{[^}]*font-family:\s*var\(--font-ui\)/,
    );
    expect(stylesheet).not.toMatch(/fonts\.googleapis\.com|@import\s+url\(/i);
    expect(stylesheet).toContain("font-synthesis: none;");
    expect(stylesheet).toContain("overflow-x: clip;");
  });

  it("keeps the desktop header framed instead of nearly full-width", () => {
    const headerFrame = stylesheet.match(/\.site-header__frame\s*{([^}]*)}/)?.[1];

    expect(headerFrame).toMatch(/width:\s*min\(89%, 100rem\)/);
    expect(headerFrame).toMatch(/min-height:\s*5\.25rem/);
    expect(headerFrame).not.toMatch(/112rem|100% - 2rem/);
  });

  it("keeps the Replay CTA integrated with the dark header", () => {
    const replayCta = stylesheet.match(/\.site-header__cta\s*{([^}]*)}/)?.[1];

    expect(replayCta).toMatch(/background:\s*var\(--arena-raised\)/);
    expect(replayCta).toMatch(/border:\s*1px solid var\(--arena-line\)/);
    expect(replayCta).toMatch(/color:\s*var\(--arena-text\)/);
    expect(replayCta).not.toMatch(/background:\s*var\(--arena-text\)/);
  });

  it("keeps the home hero compact and separates rivalry labels", () => {
    const hero = homeStylesheet.match(/\.home-broadcast-hero\)\s*{([^}]*)}/)?.[1];
    const heroHeading = homeStylesheet.match(
      /\.home-broadcast-hero__copy\) h1\s*{([^}]*)}/,
    )?.[1];
    const rivalryCard = homeStylesheet.match(
      /\.home-broadcast-sheet__rivalry\) article\s*{([^}]*)}/,
    )?.[1];
    const rivalryStrategy = homeStylesheet.match(
      /\.home-broadcast-sheet__rivalry\) article strong\s*{([^}]*)}/,
    )?.[1];

    expect(hero).toMatch(/min-height:\s*min\(52rem, calc\(100svh - 5\.5rem\)\)/);
    expect(heroHeading).toMatch(/font-weight:\s*var\(--weight-display\)/);
    expect(rivalryCard).toMatch(/display:\s*flex/);
    expect(rivalryCard).toMatch(/gap:\s*var\(--space-2xs\)/);
    expect(rivalryStrategy).toMatch(/font-size:\s*clamp/);
  });

  it("keeps agent strategy names intact and centers the versus marker", () => {
    const agentCard = homeStylesheet.match(/\.home-agent-card\)\s*{([^}]*)}/)?.[1];
    const strategyName = homeStylesheet.match(
      /\.home-agent-card__copy\) strong\s*{([^}]*)}/,
    )?.[1];
    const versusMarker = homeStylesheet.match(
      /\.home-agent-pair__versus\)\s*{([^}]*)}/,
    )?.[1];

    expect(agentCard).toMatch(
      /grid-template-columns:\s*minmax\(0, 0\.9fr\) minmax\(12rem, 1\.1fr\)/,
    );
    expect(strategyName).toMatch(/font-size:\s*clamp/);
    expect(homeStylesheet).toMatch(
      /\.homePage :where\(h1, h2, h3\)\s*{[^}]*overflow-wrap:\s*anywhere/,
    );
    expect(versusMarker).toMatch(/display:\s*grid/);
    expect(versusMarker).toMatch(/place-items:\s*center/);
  });

  it("uses the shared display and metadata roles in the lifecycle section", () => {
    const lifecycleHeading = homeStylesheet.match(
      /\.home-system-heading\) h2\s*{([^}]*)}/,
    )?.[1];
    const lifecycleMetadata = homeStylesheet.match(
      /\.home-system-track\) small\s*{([^}]*)}/,
    )?.[1];

    expect(lifecycleHeading).toMatch(/font-weight:\s*var\(--weight-heading\)/);
    expect(lifecycleHeading).toMatch(/line-height:\s*1/);
    expect(lifecycleMetadata).toMatch(/font-family:\s*var\(--font-outlier\)/);
    expect(lifecycleMetadata).toMatch(/text-transform:\s*uppercase/);
  });

  it("leaves no previous hero composition behind", () => {
    expect(homeStylesheet).not.toMatch(
      /arena-hero|arena-faceoff|arena-competitor|landing-hero__dock|arena-machine/,
    );
  });

});
