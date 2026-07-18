import { readFile } from "node:fs/promises";

import {
  formatTxlineConnectivitySmokeResult,
  runTxlineConnectivitySmoke,
} from "../dist/adapters/data/txline/connectivity-smoke.js";

const result = await runTxlineConnectivitySmoke({
  env: process.env,
  fetch: globalThis.fetch,
  readFile: (path) => readFile(path, "utf8"),
});
const output = formatTxlineConnectivitySmokeResult(result);

if (result.status === "PASSED") {
  console.log(output);
} else {
  console.error(output);
  process.exitCode = result.status === "CONFIG_FAILURE" ? 2 : 1;
}
