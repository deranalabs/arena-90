import { metadata } from "../app/layout";

describe("Arena90 document metadata", () => {
  it("uses the approved product category without unsupported integration claims", () => {
    expect(metadata.title).toBe("Arena90 | Autonomous AI Strategy Arena");
    expect(metadata.description).toBe(
      "Two autonomous agents interpret the same verified football-market snapshot and compete through deterministic virtual portfolio rules.",
    );
    expect(JSON.stringify(metadata)).not.toMatch(
      /opposite strategies|blink|wallet|escrow|yield|settlement/i,
    );
  });
});
