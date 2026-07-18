import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(packageRoot, "../..");
const releaseVersion = process.env.ARENA90_RELEASE_VERSION;
const outputRoot = resolve(
  process.env.ARENA90_RELEASE_DIR ?? join(repositoryRoot, "releases"),
);

if (!releaseVersion || !/^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/u.test(releaseVersion)) {
  console.error("Solana Actions release failed: INVALID_RELEASE_VERSION.");
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

const temporaryRoot = await mkdtemp(join(tmpdir(), "arena90-solana-actions-release-"));
const artifactName = `arena90-solana-actions-${releaseVersion}`;
const stage = join(temporaryRoot, artifactName);
const archive = join(outputRoot, `${artifactName}.tar.gz`);

try {
  await mkdir(stage, { recursive: true });
  for (const file of ["package.json", "package-lock.json", ".env.example"]) {
    await cp(join(packageRoot, file), join(stage, file));
  }
  await cp(join(packageRoot, "dist"), join(stage, "dist"), { recursive: true });
  await run("npm", ["ci", "--omit=dev", "--ignore-scripts", "--no-audit"], stage);
  const releasePackage = JSON.parse(await readFile(join(stage, "package.json"), "utf8"));
  delete releasePackage.devDependencies;
  releasePackage.scripts = { start: "node dist/src/server.js" };
  await writeFile(
    join(stage, "package.json"),
    `${JSON.stringify(releasePackage, null, 2)}\n`,
  );
  await writeFile(
    join(stage, "RELEASE.json"),
    `${JSON.stringify(
      { schemaVersion: 1, component: "arena90-solana-actions", releaseVersion },
      null,
      2,
    )}\n`,
  );
  await mkdir(dirname(archive), { recursive: true });
  await rm(archive, { force: true });
  await run(
    "tar",
    ["--no-xattrs", "-czf", archive, "-C", temporaryRoot, artifactName],
    packageRoot,
  );
  await writeFile(
    `${archive}.sha256`,
    `${await checksum(archive)}  ${basename(archive)}\n`,
  );
  console.log(`Solana Actions release created: ${archive}`);
} catch {
  console.error("Solana Actions release failed: BUILD_FAILURE.");
  process.exitCode = 1;
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
