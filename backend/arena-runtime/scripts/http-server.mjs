import {
  classifyNodeHttpRuntimeFailure,
  createNodeHttpRuntimeComposition,
  formatNodeHttpRuntimeFailure,
} from "../dist/runtime/node-http.js";

let composition;

try {
  composition = await createNodeHttpRuntimeComposition({ env: process.env });
  await composition.listen();
  console.log("Arena HTTP server started: READY.");
} catch (error) {
  const category = classifyNodeHttpRuntimeFailure(error);
  console.error(formatNodeHttpRuntimeFailure(category));
  process.exitCode = category === "CONFIG_FAILURE" ? 2 : 1;
  if (composition !== undefined) {
    try {
      await composition.shutdown();
    } catch {
      // Startup output remains one sanitized failure category.
    }
  }
}

if (composition !== undefined && composition.server.listening) {
  let shutdownStarted = false;
  const shutdown = async () => {
    if (shutdownStarted) return;
    shutdownStarted = true;
    try {
      await composition.shutdown();
      console.log("Arena HTTP server stopped: SHUTDOWN_COMPLETE.");
    } catch {
      console.error(formatNodeHttpRuntimeFailure("SHUTDOWN_FAILURE"));
      process.exitCode = 1;
    }
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
