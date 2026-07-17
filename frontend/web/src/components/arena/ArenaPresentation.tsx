import type { ReactNode } from "react";

type ArenaScoreboardProps = {
  eyebrow: string;
  statement?: string;
  homeTeam: string;
  awayTeam: string;
  phase: string;
  mode: string;
  connection: string;
  connectionWarning: boolean;
  source?: string;
  minute?: number;
  homeScore?: number;
  awayScore?: number;
  checkpoint?: string;
  freshness?: string;
};

export function ArenaScoreboard({
  eyebrow,
  statement,
  homeTeam,
  awayTeam,
  phase,
  mode,
  connection,
  connectionWarning,
  source,
  minute,
  homeScore,
  awayScore,
  checkpoint,
  freshness,
}: ArenaScoreboardProps) {
  const hasSnapshot = minute !== undefined && homeScore !== undefined && awayScore !== undefined;

  return (
    <section className="arena-scoreboard" aria-labelledby="arena-fixture-title">
      <div className="arena-scoreboard__status">
        <p className="product-eyebrow">{eyebrow}</p>
        <div className="arena-scoreboard__badges">
          <strong>{phase}</strong>
          <span>{mode}</span>
          {freshness ? <span>{freshness}</span> : null}
        </div>
      </div>
      <div className="arena-scoreboard__fixture">
        <h1 className="sr-only" id="arena-fixture-title">{homeTeam} vs {awayTeam}</h1>
        <div>
          <span>Home</span>
          <p className="arena-scoreboard__team-name" aria-hidden="true">{homeTeam}</p>
        </div>
        <div className="arena-scoreboard__score" aria-label={hasSnapshot ? `${homeScore} to ${awayScore} at ${minute} minutes` : "Score unavailable"}>
          <strong>{hasSnapshot ? `${homeScore}–${awayScore}` : "—"}</strong>
          <span>{hasSnapshot ? `${minute}′` : "Awaiting verified state"}</span>
        </div>
        <div className="arena-scoreboard__away">
          <span>Away</span>
          <p className="arena-scoreboard__team-name" aria-hidden="true">{awayTeam}</p>
        </div>
      </div>
      <div className="arena-scoreboard__source">
        <p>{statement ?? "Both agents receive the same locked snapshot and equal virtual bankroll."}</p>
        <dl>
          <div><dt>Source</dt><dd>{source ?? "Awaiting snapshot"}</dd></div>
          <div><dt>Checkpoint</dt><dd>{checkpoint ?? "—"}</dd></div>
          <div><dt>Connection</dt><dd className={connectionWarning ? "is-warning" : undefined}>{connection}</dd></div>
        </dl>
      </div>
    </section>
  );
}

type CompetitionStatusBandProps = {
  label: string;
  detail: string;
};

export function CompetitionStatusBand({ label, detail }: CompetitionStatusBandProps) {
  return (
    <section className="arena-competition-status" aria-live="polite">
      <span>Lifecycle</span>
      <strong>{label}</strong>
      <p>{detail}</p>
    </section>
  );
}

type ArenaSectionHeadingProps = {
  eyebrow: string;
  title: string;
  titleId?: string;
  detail?: string;
  action?: ReactNode;
};

export function ArenaSectionHeading({ eyebrow, title, titleId, detail, action }: ArenaSectionHeadingProps) {
  return (
    <header className="arena-section-heading">
      <div>
        <p className="product-eyebrow">{eyebrow}</p>
        <h2 id={titleId}>{title}</h2>
        {detail ? <p>{detail}</p> : null}
      </div>
      {action ? <div className="arena-section-heading__action">{action}</div> : null}
    </header>
  );
}

type ArenaNextEventProps = {
  label: string;
  value: string;
};

export function ArenaNextEvent({ label, value }: ArenaNextEventProps) {
  return (
    <section className="arena-next-event" aria-label="Next decision round">
      <span>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}
