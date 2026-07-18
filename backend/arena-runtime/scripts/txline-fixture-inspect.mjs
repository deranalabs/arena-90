import {
  createTxlineProviderClientFromEnv,
  resolveTxlineCredentialEnvironment,
} from "../dist/adapters/data/index.js";
import { readFile } from "node:fs/promises";

const targetIds = (process.env.TXLINE_TARGET_FIXTURE_IDS ?? "")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isSafeInteger(value) && value > 0);

if (targetIds.length === 0) {
  console.error("TxLINE fixture inspect failed: CONFIG_FAILURE.");
  process.exit(2);
}

function readAlias(row, pascal, camel) {
  const left = row[pascal];
  const right = row[camel];
  if (left !== undefined && right !== undefined && left !== right) {
    throw new Error("conflicting aliases");
  }
  return left ?? right;
}

try {
  const env = await resolveTxlineCredentialEnvironment(
    process.env,
    (path) => readFile(path, "utf8"),
  );
  const client = createTxlineProviderClientFromEnv({ env });
  const rows = await client.getFixtureSnapshot(new AbortController().signal);
  const bindings = targetIds.map((fixtureId) => {
    const matches = rows.filter(
      (row) =>
        row !== null &&
        typeof row === "object" &&
        readAlias(row, "FixtureId", "fixtureId") === fixtureId,
    );
    if (matches.length !== 1) throw new Error("fixture unavailable");
    const row = matches[0];
    const binding = {
      fixtureId,
      participant1Id: readAlias(row, "Participant1Id", "participant1Id"),
      participant2Id: readAlias(row, "Participant2Id", "participant2Id"),
      participant1IsHome: readAlias(
        row,
        "Participant1IsHome",
        "participant1IsHome",
      ),
      startTime: readAlias(row, "StartTime", "startTime"),
    };
    if (
      !Number.isSafeInteger(binding.participant1Id) ||
      !Number.isSafeInteger(binding.participant2Id) ||
      typeof binding.participant1IsHome !== "boolean" ||
      !Number.isSafeInteger(binding.startTime)
    ) {
      throw new Error("invalid fixture");
    }
    return { ...binding, kickoffUtc: new Date(binding.startTime).toISOString() };
  });
  console.log(JSON.stringify(bindings, null, 2));
} catch {
  console.error("TxLINE fixture inspect failed: PROVIDER_FAILURE.");
  process.exitCode = 1;
}
