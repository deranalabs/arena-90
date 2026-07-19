import type { NormalizedTxlineFixture, SelectedTxlineMarket } from "./domain.js";
import { TxlineDataError } from "./domain.js";
import { selectTxlineMarket } from "./market.js";
import { parseRawOddsEndpoint, type RawOddsEnvelope } from "./raw.js";

type ArenaPrices = Readonly<{ HOME: number; DRAW: number; AWAY: number }>;
const PCT_PATTERN = /^(?:\d+\.\d{3}|NA)$/u;

export interface HistoricalMarketState {
  readonly messageId: string;
  readonly timestampMs: number;
  readonly available: boolean;
  readonly priceMicros?: SelectedTxlineMarket["priceMicros"];
  readonly providerPrices?: ArenaPrices;
}

function isApprovedInRunningFullMatchMarket(
  row: RawOddsEnvelope,
  fixtureId: number,
): boolean {
  return (
    row.FixtureId === fixtureId &&
    row.BookmakerId === 10_021 &&
    row.Bookmaker === "TXLineStablePriceDemargined" &&
    row.SuperOddsType === "1X2_PARTICIPANT_RESULT" &&
    row.InRunning === true &&
    (row.MarketPeriod === null || row.MarketPeriod === undefined) &&
    (row.MarketParameters === null || row.MarketParameters === undefined)
  );
}

function parseProviderPrices(
  row: RawOddsEnvelope,
  participant1IsHome: boolean,
): ArenaPrices {
  if (
    !Array.isArray(row.PriceNames) ||
    !Array.isArray(row.Prices) ||
    row.PriceNames.length !== 3 ||
    row.Prices.length !== 3 ||
    new Set(row.PriceNames).size !== 3
  ) {
    throw new TxlineDataError("INVALID_MARKET", "Invalid historical TxLINE market");
  }
  const mapped = new Map<string, number>();
  for (const [index, name] of row.PriceNames.entries()) {
    const value = row.Prices[index];
    if (typeof name !== "string" || typeof value !== "number" || !Number.isSafeInteger(value)) {
      throw new TxlineDataError("INVALID_MARKET", "Invalid historical TxLINE market");
    }
    mapped.set(name, value);
  }
  const part1 = mapped.get("part1");
  const draw = mapped.get("draw");
  const part2 = mapped.get("part2");
  if (
    part1 === undefined ||
    draw === undefined ||
    part2 === undefined ||
    part1 <= 0 ||
    draw <= 0 ||
    part2 <= 0
  ) {
    throw new TxlineDataError("INVALID_MARKET", "Invalid historical TxLINE market");
  }
  return participant1IsHome
    ? { HOME: part1, DRAW: draw, AWAY: part2 }
    : { HOME: part2, DRAW: draw, AWAY: part1 };
}

function normalizeInverseOdds(prices: ArenaPrices): SelectedTxlineMarket["priceMicros"] {
  const assets = ["HOME", "DRAW", "AWAY"] as const;
  const product = assets.reduce((value, asset) => value * BigInt(prices[asset]), 1n);
  const weights = assets.map((asset, index) => ({
    asset,
    index,
    weight: product / BigInt(prices[asset]),
  }));
  const total = weights.reduce((value, entry) => value + entry.weight, 0n);
  const allocations = weights.map((entry) => ({
    ...entry,
    value: (entry.weight * 1_000_000n) / total,
    remainder: (entry.weight * 1_000_000n) % total,
  }));
  let remaining =
    1_000_000n - allocations.reduce((value, entry) => value + entry.value, 0n);
  for (const entry of [...allocations].sort((left, right) => {
    if (left.remainder === right.remainder) return left.index - right.index;
    return left.remainder > right.remainder ? -1 : 1;
  })) {
    if (remaining === 0n) break;
    entry.value += 1n;
    remaining -= 1n;
  }
  return Object.freeze(
    Object.fromEntries(allocations.map(({ asset, value }) => [asset, Number(value)])) as {
      HOME: number;
      DRAW: number;
      AWAY: number;
    },
  );
}

export function createHistoricalMarketReducer(
  fixture: NormalizedTxlineFixture,
  input: unknown,
) {
  let rows: RawOddsEnvelope[];
  try {
    rows = parseRawOddsEndpoint(input);
  } catch {
    throw new TxlineDataError("INVALID_PROVIDER_INPUT", "Invalid TxLINE historical odds input");
  }
  for (let index = 1; index < rows.length; index += 1) {
    if ((rows[index]?.Ts ?? 0) < (rows[index - 1]?.Ts ?? 0)) {
      throw new TxlineDataError("INVALID_PROVIDER_INPUT", "TxLINE historical odds are out of capture order");
    }
  }

  let cursor = 0;
  let state: HistoricalMarketState | undefined;
  return {
    advanceThrough(timestampMs: number): HistoricalMarketState | undefined {
      while (cursor < rows.length && (rows[cursor]?.Ts ?? Number.POSITIVE_INFINITY) <= timestampMs) {
        const row = rows[cursor];
        cursor += 1;
        if (
          row === undefined ||
          !isApprovedInRunningFullMatchMarket(row, fixture.fixtureId)
        ) {
          continue;
        }

        const tombstone =
          Array.isArray(row.Prices) &&
          row.Prices.length === 0 &&
          Array.isArray(row.Pct) &&
          row.Pct.length === 0;
        if (tombstone) {
          state = { messageId: row.MessageId, timestampMs: row.Ts, available: false };
          continue;
        }
        const providerPrices = parseProviderPrices(
          row,
          fixture.participant1IsHome,
        );
        if (
          !Array.isArray(row.Pct) ||
          row.Pct.length !== 3 ||
          row.Pct.some((value) => typeof value !== "string" || !PCT_PATTERN.test(value))
        ) {
          throw new TxlineDataError("INVALID_MARKET", "Invalid historical TxLINE market");
        }
        const containsUnavailablePct = row.Pct.includes("NA");
        const selected = containsUnavailablePct
          ? {
              messageId: row.MessageId,
              timestampMs: row.Ts,
              priceMicros: normalizeInverseOdds(providerPrices),
            }
          : selectTxlineMarket({ fixture, snapshot: [], updates: [row] });
        state = {
          messageId: selected.messageId,
          timestampMs: selected.timestampMs,
          available: true,
          priceMicros: selected.priceMicros,
          providerPrices,
        };
      }
      return state;
    },
    count: rows.length,
  };
}
