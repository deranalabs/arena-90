import type { PublicArenaStateV1 } from "@/lib/arena-api/contracts";
import { Surface } from "@/components/ui/surface";

type FixtureHeaderProps = { state: PublicArenaStateV1 };

export function FixtureHeader({ state }: FixtureHeaderProps) {
  const { manifest, currentSnapshot } = state;

  return (
    <Surface className="stadium-shell" tone="ink">
      <div className="stadium-shell__masthead">
        <span className="stadium-shell__competition">{manifest.competition}</span>
        <span className="stadium-shell__mode">{manifest.mode}</span>
        <span className="stadium-shell__phase">{state.phase}</span>
      </div>
      <div className="fixture-scoreboard">
        {currentSnapshot ? (
          <p className="fixture-scoreboard__source">
            Snapshot source · <strong>{currentSnapshot.source}</strong>
          </p>
        ) : null}
        <h1 id="arena-title">
          {manifest.homeTeam.name} <span>vs</span> {manifest.awayTeam.name}
        </h1>
        {currentSnapshot ? (
          <div className="fixture-scoreboard__match">
            <strong aria-label="Score">
              {currentSnapshot.match.homeScore}–{currentSnapshot.match.awayScore}
            </strong>
            <span>{currentSnapshot.match.minute}′</span>
          </div>
        ) : null}
      </div>
    </Surface>
  );
}
