import { readFileSync } from "node:fs";
import { join } from "node:path";

const stylesheet = readFileSync(
  join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

describe("Arena90 design foundation", () => {
  it("uses the Arena90 dark broadcast, rivalry, data, and Replay palette", () => {
    const tokens = [
      "--arena-paper: #f2efe6;",
      "--arena-night: #080b10;",
      "--arena-surface: #121822;",
      "--arena-raised: #18212d;",
      "--arena-line: #303b49;",
      "--arena-text: #f3efe6;",
      "--arena-muted: #9ba3ae;",
      "--arena-alpha: #ff4255;",
      "--arena-beta: #4a6dff;",
      "--arena-data: #51d6c0;",
      "--arena-signal: #d7f541;",
      "--arena-replay: #a78bfa;",
    ];

    for (const token of tokens) expect(stylesheet).toContain(token);
    expect(stylesheet).toMatch(
      /body\s*{[^}]*background:\s*var\(--arena-night\)[^}]*color:\s*var\(--arena-text\)/,
    );
    expect(stylesheet).toMatch(
      /\.site-header\s*{[^}]*background:\s*var\(--arena-night\)/,
    );
    expect(stylesheet).not.toMatch(/#d5eadb|#dfdaec/i);
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
    expect(stylesheet).toContain(
      "--font-display: var(--font-poppins), Arial, Helvetica, sans-serif;",
    );
    expect(stylesheet).toContain(
      "--font-ui: var(--font-poppins), Arial, Helvetica, sans-serif;",
    );
    expect(stylesheet).toContain(
      '--font-mono: ui-monospace, "SFMono-Regular", Consolas, monospace;',
    );
    expect(stylesheet).toMatch(
      /body\s*{[^}]*font-family:\s*var\(--font-ui\)/,
    );
    expect(stylesheet).not.toMatch(/fonts\.googleapis\.com|@import\s+url\(/i);
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

  it("leaves no previous hero composition behind", () => {
    expect(stylesheet).not.toMatch(
      /arena-hero|arena-faceoff|arena-competitor|landing-hero__dock|arena-machine/,
    );
  });

});
