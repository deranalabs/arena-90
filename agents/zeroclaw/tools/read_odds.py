#!/usr/bin/env python3
"""Read Arena90 TxODDS mock data and produce deterministic agent decisions."""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


DEFAULT_ODDS_PATH = Path(
    "/Users/derana/CodeDerana/arena-90/backend/solana-actions/mock/txodds-mock.json"
)
MARKET = {
    "id": "total_goals_2_5",
    "label": "Total Goals 2.5",
    "line": 2.5,
    "outcomes": ["Over 2.5", "Under 2.5"],
}
STAKE_BASE_UNITS = "10000000"


def clamp(value: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, value))


def load_payload(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    if payload.get("source") != "txodds-mock":
        raise ValueError("expected source=txodds-mock")
    matches = payload.get("matches")
    if not isinstance(matches, list) or not matches:
        raise ValueError("txodds mock must contain at least one match")
    return payload


def first_match(payload: dict[str, Any]) -> dict[str, Any]:
    match = payload["matches"][0]
    required = {
        "matchId",
        "competition",
        "homeTeam",
        "awayTeam",
        "odds",
        "impliedProbability",
        "marketUpdatedAtUtc",
    }
    missing = sorted(required - set(match))
    if missing:
        raise ValueError(f"match is missing required fields: {', '.join(missing)}")
    return match


def normalized_probabilities(match: dict[str, Any]) -> dict[str, float]:
    raw = match["impliedProbability"]
    probs = {
        "home": float(raw["home"]),
        "draw": float(raw["draw"]),
        "away": float(raw["away"]),
    }
    total = sum(probs.values())
    if total <= 0:
        raise ValueError("implied probability total must be positive")
    return {key: value / total for key, value in probs.items()}


def tactical_scores(match: dict[str, Any]) -> dict[str, int]:
    probs = normalized_probabilities(match)
    home = probs["home"]
    draw = probs["draw"]
    away = probs["away"]
    attacking_pressure = home + away
    market_balance = 1.0 - abs(home - away)
    isagi_score = (attacking_pressure * 0.70) + (max(home, away) * 0.30)
    aiku_score = (draw * 0.55) + (market_balance * 0.45)

    return {
        "homeProbabilityBps": round(home * 10000),
        "drawProbabilityBps": round(draw * 10000),
        "awayProbabilityBps": round(away * 10000),
        "attackingPressureBps": round(attacking_pressure * 10000),
        "marketBalanceBps": round(market_balance * 10000),
        "isagiConfidenceBps": clamp(round(isagi_score * 10000), 5500, 9000),
        "aikuConfidenceBps": clamp(round(aiku_score * 10000), 5500, 8500),
    }


def decision_for(agent: str, payload: dict[str, Any]) -> dict[str, Any]:
    match = first_match(payload)
    scores = tactical_scores(match)
    decided_at = payload.get("generatedAtUtc") or datetime.now(UTC).isoformat()
    home_team = match["homeTeam"]["name"]
    away_team = match["awayTeam"]["name"]

    if agent == "isagi":
        prediction = "Over 2.5"
        position = "over_2_5"
        selected_outcome = "home" if scores["homeProbabilityBps"] >= scores["awayProbabilityBps"] else "away"
        confidence = scores["isagiConfidenceBps"]
        rationale = (
            f"{home_team} vs {away_team} carries "
            f"{scores['attackingPressureBps']} bps non-draw pressure, so ISAGI "
            "leans into an open match script and attacks Over 2.5."
        )
    elif agent == "aiku":
        prediction = "Under 2.5"
        position = "under_2_5"
        selected_outcome = "draw"
        confidence = scores["aikuConfidenceBps"]
        rationale = (
            f"AIKU sees {scores['drawProbabilityBps']} bps draw resistance and "
            f"{scores['marketBalanceBps']} bps market balance, favoring a compact "
            "defensive script on Under 2.5."
        )
    else:
        raise ValueError("agent must be 'isagi' or 'aiku'")

    return {
        "agentId": agent,
        "displayName": agent.upper(),
        "matchId": match["matchId"],
        "marketId": MARKET["id"],
        "prediction": prediction,
        "position": position,
        "selectedOutcome": selected_outcome,
        "confidenceBps": confidence,
        "stakeLamports": STAKE_BASE_UNITS,
        "rationale": rationale,
        "scores": scores,
        "decidedAtUtc": decided_at,
    }


def prompt_for(agent: str, payload: dict[str, Any]) -> str:
    decision = decision_for(agent, payload)
    match = first_match(payload)
    return (
        "Use the Arena90 read_odds tool output below. Return only a JSON object "
        "matching this deterministic decision; do not add prose.\n\n"
        + json.dumps(
            {
                "agent": agent,
                "match": match,
                "market": MARKET,
                "requiredDecision": decision,
            },
            indent=2,
            sort_keys=True,
        )
    )


def build_output(args: argparse.Namespace) -> Any:
    payload = load_payload(Path(args.path))
    match = first_match(payload)

    if args.output == "odds":
        return {
            "provider": payload["provider"],
            "source": payload["source"],
            "generatedAtUtc": payload["generatedAtUtc"],
            "match": match,
            "market": MARKET,
            "scores": tactical_scores(match),
        }
    if args.output == "prompt":
        return prompt_for(args.agent, payload)
    return decision_for(args.agent, payload)


def main() -> None:
    parser = argparse.ArgumentParser(description="Read TxODDS mock data for Arena90 agents.")
    parser.add_argument("--path", default=str(DEFAULT_ODDS_PATH), help="Absolute path to txodds-mock.json")
    parser.add_argument("--agent", choices=["isagi", "aiku"], default="isagi")
    parser.add_argument("--output", choices=["decision", "odds", "prompt"], default="decision")
    parser.add_argument("--pretty", action="store_true")
    args = parser.parse_args()

    result = build_output(args)
    if isinstance(result, str):
        print(result)
        return

    indent = 2 if args.pretty else None
    print(json.dumps(result, indent=indent, sort_keys=True))


if __name__ == "__main__":
    main()
