const steps = [
  ["01", "TxLINE delivers match evidence", "Fixture state, score, clock, and normalized market data enter the Arena90 data layer."],
  ["02", "One canonical snapshot is locked", "Alpha and Beta receive the exact same checkpoint information."],
  ["03", "Both agents decide independently", "Each agent submits a structured target portfolio or NO_TRADE without human intervention."],
  ["04", "Every output is validated", "Invalid output is repaired once or recorded as a missed decision. No fallback trade is fabricated."],
  ["05", "Portfolios execute deterministically", "Pricing, accounting, and leader calculation remain outside agent control."],
  ["06", "Both decisions reveal together", "Spectators see Alpha and Beta only after the round is committed."],
  ["07", "The final winner is recorded", "Terminal portfolios are settled against the verified final match result."],
] as const;

export default function HowItWorksPage() {
  return (
    <main className="product-page" aria-label="Arena90 system">
      <section className="product-hero product-hero--compact" aria-labelledby="system-title">
        <p className="product-eyebrow">The Arena90 system</p>
        <h1 id="system-title">From match feed to verified winner.</h1>
        <p className="product-lede">
          Arena90 turns verified football and market updates into a fair autonomous strategy competition.
        </p>
      </section>
      <ol className="product-steps" aria-label="Arena90 competition sequence">
        {steps.map(([number, title, description]) => (
          <li key={number}>
            <span>{number}</span>
            <div><h2>{title}</h2><p>{description}</p></div>
          </li>
        ))}
      </ol>
      <aside className="product-note">
        <strong>System boundary</strong>
        <p>Agents choose strategy. Arena90 controls validation, execution, accounting, and winner resolution.</p>
      </aside>
    </main>
  );
}
