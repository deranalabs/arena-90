export const MONEY_MICROS_SCALE = 1_000_000n;
export const UNIT_MICROS_SCALE = 1_000_000n;
export const PRICE_MICROS_SCALE = 1_000_000n;
export const BASIS_POINTS_SCALE = 10_000n;

const canonicalBase10IntegerPattern = /^(?:0|-?[1-9]\d*)$/;

/** Parses a canonical base-10 integer string without accepting signs on zero or leading zeroes. */
export function parseBase10Integer(value: string): bigint {
  if (!canonicalBase10IntegerPattern.test(value)) {
    throw new TypeError(`Invalid canonical base-10 integer: ${value}`);
  }

  return BigInt(value);
}

/** Produces the JSON-safe representation required for money and unit quantities. */
export function toBase10Integer(value: bigint): string {
  return value.toString(10);
}

/** Multiplies before dividing. Native bigint division truncates toward zero. */
export function multiplyDivideTruncating(
  multiplicand: bigint,
  multiplier: bigint,
  divisor: bigint,
): bigint {
  if (divisor === 0n) {
    throw new RangeError("Divisor must not be zero");
  }

  return (multiplicand * multiplier) / divisor;
}
