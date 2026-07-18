import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  formatLifecycleReplaySmokeResult,
  runLifecycleReplaySmoke,
} from "../dist/runtime/lifecycle-replay-smoke.js";

const persistenceDirectory = await mkdtemp(
  join(tmpdir(), "arena90-lifecycle-smoke-"),
);
let result;
try {
  result = await runLifecycleReplaySmoke({
    env: {
      ...process.env,
      ARENA90_PERSISTENCE_DIR: persistenceDirectory,
    },
    readFixture: () =>
      readFile(
        new URL("../fixtures/recorded-checkpoints.json", import.meta.url),
        "utf8",
      ),
  });
} finally {
  await rm(persistenceDirectory, { recursive: true, force: true });
}
const output = formatLifecycleReplaySmokeResult(result);

if (result.status === "PASSED") {
  console.log(output);
} else {
  console.error(output);
  process.exitCode = result.status === "CONFIG_FAILURE" ? 2 : 1;
}
