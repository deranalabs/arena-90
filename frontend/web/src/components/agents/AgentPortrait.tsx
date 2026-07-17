import Image from "next/image";

type AgentPortraitProps = {
  agentId: "alpha" | "beta";
  priority?: boolean;
};

const portraits = {
  alpha: {
    alt: "Agent Alpha portrait",
    src: "/media/agents/alpha/alpha-momentum.png",
  },
  beta: {
    alt: "Agent Beta portrait",
    src: "/media/agents/beta/beta-defender.png",
  },
} as const;

export function AgentPortrait({ agentId, priority = false }: AgentPortraitProps) {
  const portrait = portraits[agentId];

  return (
    <figure className={`agent-portrait agent-portrait--${agentId}`}>
      <Image
        alt={portrait.alt}
        fill
        priority={priority}
        sizes="(max-width: 608px) calc(100vw - 2rem), (max-width: 928px) 50vw, 38vw"
        src={portrait.src}
      />
    </figure>
  );
}
