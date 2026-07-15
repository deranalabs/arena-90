import type { PublicArenaStateV1 } from "@/lib/arena-api/contracts";
import { Surface } from "@/components/ui/surface";

function money(micros: string) {
  const value = BigInt(micros);
  const microsPerUnit = BigInt(1_000_000);
  const microsPerCent = BigInt(10_000);
  const whole = value / microsPerUnit;
  const cents = ((value % microsPerUnit) / microsPerCent)
    .toString()
    .padStart(2, "0");
  return `${whole}.${cents} vUSD`;
}

function agentName(result: "alpha" | "beta" | "DRAW") {
  if (result === "alpha") return "Agent Alpha";
  if (result === "beta") return "Agent Beta";
  return "Level";
}

function winningAsset(state: PublicArenaStateV1) {
  const assetId = state.finalResult?.winningAssetId;
  if (assetId === "HOME") return state.manifest.homeTeam.name;
  if (assetId === "AWAY") return state.manifest.awayTeam.name;
  return "Draw";
}

export function FinalResultPanel({ state }: { state: PublicArenaStateV1 }) {
  if (state.phase !== "FINALIZING" && state.phase !== "COMPLETED") return null;

  if (state.phase === "FINALIZING") {
    return (
      <Surface
        aria-label="Final settlement"
        className="final-result final-result--pending"
        role="region"
        tone="ink"
      >
        <p className="eyebrow eyebrow--inverse">Final settlement</p>
        <h2 id="final-settlement-title">Finalizing result</h2>
        <p>Verified terminal settlement is pending. No winner is declared yet.</p>
        <strong>{agentName(state.leader.result)} · provisional</strong>
      </Surface>
    );
  }

  const result = state.finalResult;
  if (!result) {
    return (
      <Surface
        aria-label="Final settlement"
        className="final-result final-result--unavailable"
        role="region"
        tone="ink"
      >
        <p className="eyebrow eyebrow--inverse">Final settlement</p>
        <h2 id="final-settlement-title">Verified result unavailable</h2>
        <p>No terminal result is shown without canonical settlement data.</p>
      </Surface>
    );
  }

  const winner =
    result.winner === "DRAW" ? "Arena draw" : `${agentName(result.winner)} wins`;

  return (
    <Surface
      aria-label="Final settlement"
      className="final-result final-result--complete"
      role="region"
      tone="ink"
    >
      <p className="eyebrow eyebrow--inverse">
        {state.manifest.mode === "REPLAY" ? "Replay result" : "Arena result"}
      </p>
      <h2 id="final-settlement-title">{winner}</h2>
      <dl className="final-result__facts">
        <div><dt>Winning asset</dt><dd>{winningAsset(state)}</dd></div>
        <div><dt>Agent Alpha terminal NAV</dt><dd>{money(result.alphaFinalNavMicros)}</dd></div>
        <div><dt>Agent Beta terminal NAV</dt><dd>{money(result.betaFinalNavMicros)}</dd></div>
      </dl>
      <div className="final-result__proof">
        <span>Final result hash</span>
        <code>{result.finalResultHash}</code>
      </div>
    </Surface>
  );
}
