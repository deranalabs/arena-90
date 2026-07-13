import type {
  NormalizedTxlineFixture,
  TxlineFixtureBinding,
} from "./domain.js";
import { TxlineDataError } from "./domain.js";
import { fixtureBindingSchema, parseRawFixture } from "./raw.js";

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

  const fixture = {
    fixtureId: parsedFixture.fixtureId,
    participant1Id: parsedFixture.participant1Id,
    participant2Id: parsedFixture.participant2Id,
    participant1IsHome: parsedFixture.participant1IsHome,
    startTime: parsedFixture.startTime,
  } as const;

  if (
    fixture.fixtureId !== parsedBinding.data.fixtureId ||
    fixture.participant1Id !== parsedBinding.data.participant1Id ||
    fixture.participant2Id !== parsedBinding.data.participant2Id ||
    fixture.participant1IsHome !== parsedBinding.data.participant1IsHome ||
    fixture.startTime !== parsedBinding.data.startTime
  ) {
    throw new TxlineDataError(
      "FIXTURE_BINDING_MISMATCH",
      "TxLINE fixture does not match configured binding",
    );
  }

  return Object.freeze(fixture);
}
