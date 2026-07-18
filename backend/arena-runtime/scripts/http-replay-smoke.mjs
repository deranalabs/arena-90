import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  formatReplayHttpAcceptanceSmokeResult,
  runReplayHttpAcceptanceSmoke,
} from "../dist/runtime/http-replay-smoke.js";

const mode = process.env.ARENA90_HTTP_SMOKE_MODE ?? "PRODUCT_ACCEPTANCE";
const persistenceDirectory = await mkdtemp(join(tmpdir(), "arena90-http-smoke-"));
let result;
try {
  result = await runReplayHttpAcceptanceSmoke({
    mode,
    composition: {
      env: {
        ...process.env,
        ARENA90_PERSISTENCE_DIR: persistenceDirectory,
      },
    },
  });
} finally {
  await rm(persistenceDirectory, { recursive: true, force: true });
}
const output = formatReplayHttpAcceptanceSmokeResult(result, mode);

if (result.status === "PASSED") {
  console.log(output);
} else {
  console.error(output);
  process.exitCode = result.status === "CONFIG_FAILURE" ? 2 : 1;
}
