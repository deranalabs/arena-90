import type {
  SelectTxlineMarketInput,
  SelectedTxlineMarket,
} from "./domain.js";
import { TxlineDataError } from "./domain.js";
import {
  parseRawOddsEndpoint,
  parseSelectedOdds,
  type RawOddsEnvelope,
} from "./raw.js";
import { structurallyEqual } from "./structural.js";

const PCT_PATTERN = /^\d+\.\d{3}$/;
const PRICE_SCALE = 1_000_000n;

type CanonicalAssetId = "HOME" | "DRAW" | "AWAY";

function isApprovedMarket(
  row: RawOddsEnvelope,
  fixtureId: number,
): boolean {
  return (
    row.FixtureId === fixtureId &&
    row.BookmakerId === 10_021 &&
    row.Bookmaker === "TXLineStablePriceDemargined" &&
    row.SuperOddsType === "1X2_PARTICIPANT_RESULT" &&
    (row.MarketPeriod === null || row.MarketPeriod === undefined) &&
    (row.MarketParameters === null || row.MarketParameters === undefined)
  );
}

function materialContent(row: RawOddsEnvelope): readonly unknown[] {
  return [
    row.FixtureId,
    row.MessageId,
    row.Ts,
    row.Bookmaker,
    row.BookmakerId,
    row.SuperOddsType,
    row.GameState ?? null,
    row.InRunning,
    row.MarketPeriod ?? null,
    row.MarketParameters ?? null,
    row.PriceNames ?? null,
    row.Prices ?? null,
    row.Pct ?? null,
  ];
}

function deduplicateRows(rows: RawOddsEnvelope[]): RawOddsEnvelope[] {
  const byMessageId = new Map<
    string,
    { material: readonly unknown[]; row: RawOddsEnvelope }
  >();

  for (const row of rows) {
    const material = materialContent(row);
    const existing = byMessageId.get(row.MessageId);
    if (existing !== undefined && !structurallyEqual(existing.material, material)) {
      throw new TxlineDataError(
        "DUPLICATE_MESSAGE_CONFLICT",
        "Conflicting TxLINE odds MessageId",
      );
    }
    if (existing === undefined) byMessageId.set(row.MessageId, { material, row });
  }

  return [...byMessageId.values()].map(({ row }) => row);
}

function parsePct(value: string): bigint {
  if (!PCT_PATTERN.test(value)) {
    throw new TxlineDataError("INVALID_MARKET", "Invalid selected TxLINE market");
  }

  const [whole, fraction] = value.split(".");
  if (whole === undefined || fraction === undefined) {
    throw new TxlineDataError("INVALID_MARKET", "Invalid selected TxLINE market");
  }

  const parsed = BigInt(whole) * 1_000n + BigInt(fraction);
  if (parsed <= 0n || parsed > 100_000n) {
    throw new TxlineDataError("INVALID_MARKET", "Invalid selected TxLINE market");
  }

  return parsed;
}

function normalizePrices(
  priceNames: string[],
  pct: string[],
  participant1IsHome: boolean,
): SelectedTxlineMarket["priceMicros"] {
  if (
    new Set(priceNames).size !== 3 ||
    !priceNames.includes("part1") ||
    !priceNames.includes("draw") ||
    !priceNames.includes("part2")
  ) {
    throw new TxlineDataError("INVALID_MARKET", "Invalid selected TxLINE market");
  }

  const pctByAsset = new Map<CanonicalAssetId, bigint>();
  for (const [index, priceName] of priceNames.entries()) {
    const value = pct[index];
    if (value === undefined) {
      throw new TxlineDataError("INVALID_MARKET", "Invalid selected TxLINE market");
    }

    const asset: CanonicalAssetId =
      priceName === "draw"
        ? "DRAW"
        : priceName === "part1"
          ? participant1IsHome
            ? "HOME"
            : "AWAY"
          : participant1IsHome
            ? "AWAY"
            : "HOME";
    pctByAsset.set(asset, parsePct(value));
  }

  const assetOrder = ["HOME", "DRAW", "AWAY"] as const;
  const total = assetOrder.reduce(
    (sum, asset) => sum + (pctByAsset.get(asset) ?? 0n),
    0n,
  );
  if (total < 99_000n || total > 101_000n) {
    throw new TxlineDataError("INVALID_MARKET", "Invalid selected TxLINE market");
  }

  const allocations = assetOrder.map((asset, index) => {
    const numerator = (pctByAsset.get(asset) ?? 0n) * PRICE_SCALE;
    return {
      asset,
      index,
      price: numerator / total,
      remainder: numerator % total,
    };
  });
  let remaining =
    PRICE_SCALE - allocations.reduce((sum, allocation) => sum + allocation.price, 0n);
  const remainderOrder = [...allocations].sort((left, right) => {
    if (left.remainder === right.remainder) return left.index - right.index;
    return left.remainder > right.remainder ? -1 : 1;
  });

  for (const allocation of remainderOrder) {
    if (remaining === 0n) break;
    allocation.price += 1n;
    remaining -= 1n;
  }

  const prices = Object.fromEntries(
    allocations.map(({ asset, price }) => [asset, Number(price)]),
  ) as { HOME: number; DRAW: number; AWAY: number };
  if (assetOrder.some((asset) => prices[asset] < 1 || prices[asset] > 999_999)) {
    throw new TxlineDataError("INVALID_MARKET", "Invalid selected TxLINE market");
  }

  return Object.freeze(prices);
}

export function selectTxlineMarket(
  input: SelectTxlineMarketInput,
): SelectedTxlineMarket {
  let endpointRows: RawOddsEnvelope[];
  try {
    endpointRows = [
      ...parseRawOddsEndpoint(input.snapshot),
      ...parseRawOddsEndpoint(input.updates),
    ];
  } catch {
    throw new TxlineDataError(
      "INVALID_PROVIDER_INPUT",
      "Invalid TxLINE odds endpoint payload",
    );
  }
  const rows = deduplicateRows(endpointRows);

  const candidate = rows
    .filter((row) => isApprovedMarket(row, input.fixture.fixtureId))
    .sort((left, right) => {
      if (left.Ts !== right.Ts) return right.Ts - left.Ts;
      return left.MessageId < right.MessageId
        ? 1
        : left.MessageId > right.MessageId
          ? -1
          : 0;
    })[0];
  if (candidate === undefined) {
    throw new TxlineDataError("NO_APPROVED_MARKET", "No approved TxLINE market");
  }

  let selected;
  try {
    selected = parseSelectedOdds(candidate);
  } catch {
    throw new TxlineDataError("INVALID_MARKET", "Invalid selected TxLINE market");
  }

  return Object.freeze({
    fixtureId: selected.FixtureId,
    messageId: selected.MessageId,
    timestampMs: selected.Ts,
    priceMicros: normalizePrices(
      selected.PriceNames,
      selected.Pct,
      input.fixture.participant1IsHome,
    ),
  });
}
