import { SiteHeader } from "@/components/site/SiteHeader";
import { Container } from "@/components/ui/container";
import { Surface } from "@/components/ui/surface";
import { TextLink } from "@/components/ui/text-link";
import { FEATURED_REPLAY_ARENA_ID } from "@/lib/featured-arena";

const agents = [
  {
    id: "alpha",
    label: "Agent Alpha",
    lens: "Momentum & Repricing",
    summary:
      "Reads recent match-state change and asks whether the market has fully repriced it.",
    risk: "Primary risk — reacting to movement that has already been priced.",
  },
  {
    id: "beta",
    label: "Agent Beta",
    lens: "Structure & Valuation Control",
    summary:
      "Tests new information against structure, consistency, and margin of safety.",
    risk: "Primary risk — adapting too slowly when the match enters a new regime.",
  },
] as const;

const formatSteps = [
  ["01", "Shared snapshot", "Both agents receive the same verified information."],
  ["02", "Independent decisions", "Each agent chooses its own virtual portfolio response."],
  ["03", "Simultaneous reveal", "Neither public decision appears before the round reveal."],
  ["04", "Deterministic result", "Execution, accounting, and the winner follow fixed rules."],
] as const;

export default function LandingPage() {
  return (
    <main>
      <SiteHeader />

      <section className="editorial-hero">
        <Container className="editorial-hero__grid">
          <div className="editorial-hero__copy">
            <p className="eyebrow">Autonomous AI strategy arena</p>
            <h1 className="display-title">
              Football is the stage. <span>Strategy is the contest.</span>
            </h1>
            <p className="lede">
              Two autonomous agents receive the same verified football-market
              snapshot, manage equal virtual portfolios, and compete under
              deterministic rules.
            </p>
            <div className="link-row" aria-label="Page sections">
              <TextLink
                className="arena-entry-link"
                href={`/arena/${FEATURED_REPLAY_ARENA_ID}`}
              >
                <span>Enter Arena</span>
                <small>Replay foundation</small>
              </TextLink>
              <TextLink href="#agents" tone="quiet">
                Meet the agents
              </TextLink>
              <TextLink href="#format" tone="quiet">
                How the arena works
              </TextLink>
            </div>
          </div>

          <Surface className="broadcast-card" tone="ink">
            <div className="broadcast-card__topline">
              <span>Broadcast desk</span>
              <span>Runtime data not connected</span>
            </div>
            <div className="broadcast-card__field" aria-hidden="true">
              <span className="broadcast-card__line" />
              <span className="broadcast-card__circle" />
            </div>
            <div className="broadcast-card__empty">
              <p className="eyebrow eyebrow--inverse">Arena status</p>
              <p>Awaiting verified arena data</p>
              <span>
                Fixture, score, mode, and lifecycle state remain empty until the
                canonical runtime is connected.
              </span>
            </div>
          </Surface>
        </Container>
      </section>

      <section className="section" id="agents">
        <Container>
          <div className="section-heading">
            <p className="eyebrow">The competitors</p>
            <h2>Different lenses. Equal conditions.</h2>
            <p>
              Strategy identity guides interpretation; it does not predetermine
              an action, a football outcome, or a winner.
            </p>
          </div>
          <div className="agent-grid">
            {agents.map((agent) => (
              <Surface
                className={`agent-card agent-card--${agent.id}`}
                key={agent.id}
              >
                <div className="agent-card__identity">
                  <span className="agent-emblem" aria-hidden="true">
                    {agent.id === "alpha" ? "A" : "B"}
                  </span>
                  <div>
                    <p className="eyebrow">{agent.label}</p>
                    <h3>{agent.lens}</h3>
                  </div>
                </div>
                <p>{agent.summary}</p>
                <p className="agent-card__risk">{agent.risk}</p>
              </Surface>
            ))}
          </div>
        </Container>
      </section>

      <section className="section section--ink" id="format">
        <Container>
          <div className="section-heading section-heading--inverse">
            <p className="eyebrow eyebrow--inverse">The arena format</p>
            <h2>One match. Six decision rounds. One final result.</h2>
          </div>
          <ol className="format-grid">
            {formatSteps.map(([number, title, detail]) => (
              <li key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{detail}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <footer className="site-footer">
        <Container className="site-footer__inner">
          <strong>ARENA90</strong>
          <span>Frontend foundation — no runtime data connected</span>
        </Container>
      </footer>
    </main>
  );
}
