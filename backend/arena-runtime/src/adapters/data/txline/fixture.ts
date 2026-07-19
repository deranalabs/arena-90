import type {
  NormalizedTxlineFixture,
  TxlineFixtureBinding,
} from "./domain.js";
import { TxlineDataError } from "./domain.js";
import { fixtureBindingSchema, parseRawFixture } from "./raw.js";

export const MAX_FIXTURE_START_TIME_DRIFT_MS = 30 * 60 * 1_000;

export function validateTxlineFixtureBinding(
  input: unknown,
  binding: TxlineFixtureBinding,
): NormalizedTxlineFixture {
  const parsedBinding = fixtureBindingSchema.safeParse(binding);
  let parsedFixture: ReturnType<typeof parseRawFixture>;

  try {
    parsedFixture = parseRawFixture(input);
  } catch {
    throw new TxlineDataError(
      "INVALID_PROVIDER_INPUT",
      "Invalid TxLINE fixture input",
    );
  }

  if (!parsedBinding.success) {
    throw new TxlineDataError(
      "INVALID_PROVIDER_INPUT",
      "Invalid TxLINE fixture input",
    );
  }

  const providerFixture = {
    fixtureId: parsedFixture.fixtureId,
    participant1Id: parsedFixture.participant1Id,
    participant2Id: parsedFixture.participant2Id,
    participant1IsHome: parsedFixture.participant1IsHome,
    startTime: parsedFixture.startTime,
  } as const;

  if (
    providerFixture.fixtureId !== parsedBinding.data.fixtureId ||
    providerFixture.participant1Id !== parsedBinding.data.participant1Id ||
    providerFixture.participant2Id !== parsedBinding.data.participant2Id ||
    providerFixture.participant1IsHome !== parsedBinding.data.participant1IsHome ||
    Math.abs(providerFixture.startTime - parsedBinding.data.startTime) >
      MAX_FIXTURE_START_TIME_DRIFT_MS
  ) {
    throw new TxlineDataError(
      "FIXTURE_BINDING_MISMATCH",
      "TxLINE fixture does not match configured binding",
    );
  }

  return Object.freeze(parsedBinding.data);
}
