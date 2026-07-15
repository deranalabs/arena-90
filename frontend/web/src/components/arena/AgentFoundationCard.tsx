import { Surface } from "@/components/ui/surface";

type AgentFoundationCardProps = {
  agent: Readonly<{
    id: "alpha" | "beta";
    label: string;
    lens: string;
    descriptor: string;
  }>;
};

export function AgentFoundationCard({ agent }: AgentFoundationCardProps) {
  const titleId = `arena-${agent.id}-title`;

  return (
    <Surface
      aria-labelledby={titleId}
      className={`arena-agent arena-agent--${agent.id}`}
      role="article"
      tone="ink"
    >
      <div className="arena-agent__topline">
        <span className="arena-agent__emblem" aria-hidden="true">
          {agent.id === "alpha" ? "A" : "B"}
        </span>
        <div>
          <p>{agent.lens}</p>
          <h2 id={titleId}>{agent.label}</h2>
        </div>
      </div>
      <p className="arena-agent__descriptor">{agent.descriptor}</p>
      <dl className="arena-agent__facts">
        <div>
          <dt>Portfolio</dt>
          <dd>—</dd>
        </div>
        <div>
          <dt>Latest decision</dt>
          <dd>Awaiting public state</dd>
        </div>
      </dl>
    </Surface>
  );
}
