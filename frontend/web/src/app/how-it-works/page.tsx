import { ProductPageIntro } from "@/components/product/ProductPageIntro";
import { WorkflowIcon, type WorkflowIconName } from "@/components/icons/WorkflowIcons";
import styles from "./workflow.module.css";

const steps: ReadonlyArray<{
  num: string;
  title: string;
  desc: string;
  tag: string;
  icon: WorkflowIconName;
}> = [
  {
    num: "1.0",
    title: "TxLINE/TxODDS delivers verified data",
    desc: "Fixture state, score, clock, prices, freshness, and sequence enter the Arena90 data layer.",
    tag: "Source",
    icon: "feed",
  },
  {
    num: "2.0",
    title: "One shared snapshot is locked",
    desc: "Alpha and Beta receive the same locked evidence plus their own current portfolio state.",
    tag: "Lock",
    icon: "snapshot",
  },
  {
    num: "3.0",
    title: "Alpha and Beta decide independently",
    desc: "Each returns a structured target allocation or intentionally makes no trade. No human approval is required.",
    tag: "Agent",
    icon: "agents",
  },
  {
    num: "4.0",
    title: "Every output is validated fail-closed",
    desc: "Invalid output gets one constrained repair attempt. If it still fails, the round is marked missed. No fallback trade is fabricated.",
    tag: "Engine",
    icon: "validate",
  },
  {
    num: "5.0",
    title: "The deterministic engine executes",
    desc: "Arena90 derives portfolio actions, pricing, accounting, risk metrics, and settlement outside agent control.",
    tag: "Engine",
    icon: "execute",
  },
  {
    num: "6.0",
    title: "Both decisions reveal together",
    desc: "Results become public only after both agents resolve or reach their deadlines.",
    tag: "Proof",
    icon: "reveal",
  },
  {
    num: "7.0",
    title: "Final settlement records the winner",
    desc: "Verified terminal evidence settles enabled markets. Final portfolio value determines Alpha, Beta, or a draw. No new agent decision occurs after 75′.",
    tag: "Resolution",
    icon: "settle",
  },
];

export default function HowItWorksPage() {
  return (
    <main className={`product-page ${styles.workflowPage}`} aria-label="Arena90 system workflow">
      <ProductPageIntro
        aside={<p className="product-intro__count"><strong>07</strong><span>Deterministic stages</span></p>}
        description="Arena90 turns verified football and market updates into a fair autonomous strategy competition."
        eyebrow="The Arena90 system"
        layout="front-page"
        meta="System / 07"
        title="From match feed to verified winner."
      />
      
      <section className={styles.roadmap} aria-label="Arena90 competition sequence">
        {steps.map(({ num, title, desc, tag, icon }) => (
          <article key={num} className={styles.step}>
            <header className={styles.stepHead}>
              <span className={styles.stepNum}>{num}</span>
              <WorkflowIcon className={styles.stepIcon} name={icon} />
              <span className={styles.stepTag}>{tag}</span>
            </header>
            <div className={styles.stepBody}>
              <h2 className={styles.stepTitle}>{title}</h2>
              <p className={styles.stepDesc}>{desc}</p>
            </div>
          </article>
        ))}
      </section>

      <aside className={styles.boundary}>
        <strong>System boundary</strong>
        <p>Agents choose strategy. Arena90 controls validation, execution, accounting, and winner resolution.</p>
      </aside>
    </main>
  );
}
