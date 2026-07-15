import {
  formatReplayHttpAcceptanceSmokeResult,
  runReplayHttpAcceptanceSmoke,
} from "../dist/runtime/http-replay-smoke.js";

const mode = process.env.ARENA90_HTTP_SMOKE_MODE ?? "PRODUCT_ACCEPTANCE";
const result = await runReplayHttpAcceptanceSmoke({
  mode,
  composition: { env: process.env },
});
const output = formatReplayHttpAcceptanceSmokeResult(result, mode);

if (result.status === "PASSED") {
  console.log(output);
} else {
  console.error(output);
  process.exitCode = result.status === "CONFIG_FAILURE" ? 2 : 1;
}
