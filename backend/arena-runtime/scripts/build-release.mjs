import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";

const packageRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(packageRoot, "../..");
const releaseVersion = process.env.ARENA90_RELEASE_VERSION;
const outputRoot = resolve(
  process.env.ARENA90_RELEASE_DIR ?? join(repositoryRoot, "releases"),
);

if (!releaseVersion || !/^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/u.test(releaseVersion)) {
  console.error("Runtime release failed: INVALID_RELEASE_VERSION.");
  process.exit(2);
}

function run(command, args, cwd) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.once("error", rejectRun);
    child.once("close", (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${command} exited with ${code ?? "signal"}`));
    });
  });
}

async function checksum(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "arena90-runtime-release-"));
const artifactName = `arena90-runtime-${releaseVersion}`;
const stage = join(temporaryRoot, artifactName);
const archive = join(outputRoot, `${artifactName}.tar.gz`);

try {
  await mkdir(stage, { recursive: true });
  for (const file of ["package.json", "package-lock.json", ".env.example"]) {
    await cp(join(packageRoot, file), join(stage, file));
  }
  for (const directory of ["dist", "fixtures"]) {
    await cp(join(packageRoot, directory), join(stage, directory), {
      recursive: true,
    });
  }
  await mkdir(join(stage, "scripts"), { recursive: true });
  for (const script of [
    "acceptance-preflight.mjs",
    "http-replay-smoke.mjs",
    "http-server.mjs",
    "lifecycle-replay-smoke.mjs",
    "txline-smoke.mjs",
    "zeroclaw-smoke.mjs",
  ]) {
    await cp(join(packageRoot, "scripts", script), join(stage, "scripts", script));
  }
  await run("npm", ["ci", "--omit=dev", "--ignore-scripts", "--no-audit"], stage);
  const releasePackage = JSON.parse(
    await readFile(join(stage, "package.json"), "utf8"),
  );
  delete releasePackage.devDependencies;
  releasePackage.scripts = {
    "start:http": "node scripts/http-server.mjs",
    "preflight:acceptance": "node scripts/acceptance-preflight.mjs",
    "smoke:http:replay": "node scripts/http-replay-smoke.mjs",
    "smoke:lifecycle:replay": "node scripts/lifecycle-replay-smoke.mjs",
    "smoke:txline": "node scripts/txline-smoke.mjs",
    "smoke:zeroclaw": "node scripts/zeroclaw-smoke.mjs",
  };
  await writeFile(
    join(stage, "package.json"),
    `${JSON.stringify(releasePackage, null, 2)}\n`,
  );
  await writeFile(
    join(stage, "RELEASE.json"),
    `${JSON.stringify({ schemaVersion: 1, component: "arena-runtime", releaseVersion }, null, 2)}\n`,
  );
  await mkdir(dirname(archive), { recursive: true });
  await rm(archive, { force: true });
  await run(
    "tar",
    ["--no-xattrs", "-czf", archive, "-C", temporaryRoot, artifactName],
    packageRoot,
  );
  await writeFile(`${archive}.sha256`, `${await checksum(archive)}  ${basename(archive)}\n`);
  console.log(`Runtime release created: ${archive}`);
} catch {
  console.error("Runtime release failed: BUILD_FAILURE.");
  process.exitCode = 1;
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
