import { readFileSync } from "node:fs";
import { join } from "node:path";

const stylesheet = readFileSync(
  join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

function contrastRatio(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const channels = hex
      .slice(1)
      .match(/.{2}/g)!
      .map((channel) => Number.parseInt(channel, 16) / 255)
      .map((channel) =>
        channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4,
      );

    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };

  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));

  return (lighter + 0.05) / (darker + 0.05);
}

describe("frontend design foundation", () => {
  it("uses semantic system font stacks without a runtime font request", () => {
    expect(stylesheet).not.toMatch(/fonts\.googleapis\.com|@import\s+url\(/i);
    expect(stylesheet).toMatch(/--font-display:\s*"Arial Narrow"/);
    expect(stylesheet).toMatch(/--font-ui:\s*system-ui/);
    expect(stylesheet).toMatch(/--font-mono:\s*ui-monospace/);
    expect(stylesheet).toMatch(/body\s*{[^}]*font-family:\s*var\(--font-ui\)/);
  });

  it("uses a focus-visible dual ring with contrast on paper and ink", () => {
    expect(contrastRatio("#fffaf0", "#171918")).toBeGreaterThanOrEqual(3);
    expect(contrastRatio("#11100d", "#f3efe6")).toBeGreaterThanOrEqual(3);
    expect(stylesheet).toContain("--color-focus-light: #fffaf0;");
    expect(stylesheet).toContain("--color-focus-dark: #11100d;");

    const focusRule = stylesheet.match(/:focus-visible\s*{([^}]*)}/)?.[1];

    expect(focusRule).toMatch(/outline:\s*2px solid var\(--color-focus-light\)/);
    expect(focusRule).toMatch(/box-shadow:\s*0 0 0 5px var\(--color-focus-dark\)/);
    expect(stylesheet).not.toMatch(/(^|,)\s*:focus\s*[{,]/m);
  });

  it("keeps the second format row separators symmetrical at two columns", () => {
    const tabletRules = stylesheet.slice(
      stylesheet.indexOf("@media (max-width: 56rem)"),
      stylesheet.indexOf("@media (max-width: 42rem)"),
    );

    expect(tabletRules).toMatch(
      /\.format-grid li:nth-child\(2\)\s*{[^}]*border-right:/,
    );
    expect(tabletRules).not.toMatch(
      /\.format-grid li:nth-child\(3\)\s*{[^}]*border-top:\s*0/,
    );
  });
});
