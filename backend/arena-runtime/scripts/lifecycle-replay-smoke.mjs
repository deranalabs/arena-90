import { readFile } from "node:fs/promises";

import {
  formatLifecycleReplaySmokeResult,
  runLifecycleReplaySmoke,
} from "../dist/runtime/lifecycle-replay-smoke.js";

const result = await runLifecycleReplaySmoke({
  env: process.env,
  readFixture: () =>
    readFile(
      new URL("../fixtures/recorded-checkpoints.json", import.meta.url),
      "utf8",
    ),
});
const output = formatLifecycleReplaySmokeResult(result);

if (result.status === "PASSED") {
  console.log(output);
} else {
  console.error(output);
  process.exitCode = result.status === "CONFIG_FAILURE" ? 2 : 1;
}
