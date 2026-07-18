import { describe, expect, it } from "vitest";

import {
  BASIS_POINTS_SCALE,
  MONEY_MICROS_SCALE,
  PRICE_MICROS_SCALE,
  UNIT_MICROS_SCALE,
  multiplyDivideTruncating,
  parseBase10Integer,
  toBase10Integer,
} from "../src/fixed-point.js";

describe("fixed-point scales", () => {
  it("uses the approved micros and basis-point scales", () => {
    expect(MONEY_MICROS_SCALE).toBe(1_000_000n);
    expect(UNIT_MICROS_SCALE).toBe(1_000_000n);
    expect(PRICE_MICROS_SCALE).toBe(1_000_000n);
    expect(BASIS_POINTS_SCALE).toBe(10_000n);
  });
});

describe("base-10 integer serialization", () => {
  it.each([
    ["0", 0n],
    ["1", 1n],
    ["-1", -1n],
    ["9007199254740993123456789", 9_007_199_254_740_993_123_456_789n],
  ])("parses %s without number precision loss", (serialized, expected) => {
    expect(parseBase10Integer(serialized)).toBe(expected);
    expect(toBase10Integer(expected)).toBe(serialized);
  });

  it.each(["", "01", "-0", "+1", "1.0", " 1", "1 ", "1e6"])(
    "rejects non-canonical value %j",
    (value) => {
      expect(() => parseBase10Integer(value)).toThrow(TypeError);
    },
  );
});

describe("multiplyDivideTruncating", () => {
  it("multiplies before division and preserves bigint precision", () => {
    expect(multiplyDivideTruncating(100_000_001n, 3_333n, 10_000n)).toBe(33_330_000n);
    expect(
      multiplyDivideTruncating(9_007_199_254_740_993n, 1_000_000n, 333_333n),
    ).toBe(27_021_624_785_847_764n);
  });

  it.each([
    [-10n, 1n, 3n, -3n],
    [10n, -1n, 3n, -3n],
    [10n, 1n, -3n, -3n],
    [-10n, -1n, 3n, 3n],
  ])("truncates toward zero for signed inputs", (value, multiplier, divisor, expected) => {
    expect(multiplyDivideTruncating(value, multiplier, divisor)).toBe(expected);
  });

  it("rejects division by zero", () => {
    expect(() => multiplyDivideTruncating(1n, 1n, 0n)).toThrow(
      new RangeError("Divisor must not be zero"),
    );
  });
});
