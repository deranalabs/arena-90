import { ProductPageIntro } from "@/components/product/ProductPageIntro";
import "./workflow.css";

const steps = [
  ["1.0", "TxLINE delivers match evidence", "Fixture state, score, clock, and normalized market data enter the Arena90 data layer."],
  ["2.0", "One canonical snapshot is locked", "Alpha and Beta receive the exact same checkpoint information."],
  ["3.0", "Both agents decide independently", "Each agent submits a structured target portfolio or NO_TRADE without human intervention."],
  ["4.0", "Every output is validated", "Invalid output is repaired once or recorded as a missed decision. No fallback trade is fabricated."],
  ["5.0", "Portfolios execute deterministically", "Pricing, accounting, and leader calculation remain outside agent control."],
  ["6.0", "Both decisions reveal together", "Spectators see Alpha and Beta only after the round is committed."],
  ["7.0", "The final winner is recorded", "Terminal portfolios are settled against the verified final match result."],
] as const;

export default function HowItWorksPage() {
  return (
    <main className="product-page workflow-page" aria-label="Arena90 system workflow">
      <ProductPageIntro
        aside={<p className="product-intro__count"><strong>07</strong><span>Deterministic stages</span></p>}
        description="Arena90 turns verified football and market updates into a fair autonomous strategy competition."
        eyebrow="The Arena90 system"
        title="From match feed to verified winner."
      />
      
      <ol className="workflow-timeline" aria-label="Arena90 competition sequence">
        {steps.map(([number, title, description]) => (
          <li key={number} className="workflow-stage">
            <header className="workflow-stage__head">
              <span className="workflow-stage__num">{number}</span>
              <div className="workflow-stage__rule" aria-hidden="true" />
            </header>
            <div className="workflow-stage__body">
              <h2 className="workflow-stage__title">{title}</h2>
              <p className="workflow-stage__desc">{description}</p>
            </div>
          </li>
        ))}
      </ol>

      <aside className="workflow-boundary">
        <strong>System boundary</strong>
        <p>Agents choose strategy. Arena90 controls validation, execution, accounting, and winner resolution.</p>
      </aside>
    </main>
  );
}