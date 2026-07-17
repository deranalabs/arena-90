import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";

const resolverRoot = resolve(import.meta.dirname, "..");
const runtimeRoot = resolve(resolverRoot, "../arena-runtime");
const repositoryRoot = resolve(resolverRoot, "../..");
const contractIdl = resolve(
  repositoryRoot,
  "contracts/anchor/arena_escrow/target/idl/arena_escrow.json",
);
const releaseVersion = process.env.ARENA90_RELEASE_VERSION;
const outputRoot = resolve(
  process.env.ARENA90_RELEASE_DIR ?? join(repositoryRoot, "releases"),
);

if (!releaseVersion || !/^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/u.test(releaseVersion)) {
  console.error("Solana resolver release failed: INVALID_RELEASE_VERSION.");
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

async function copyPackage(source, destination, includeEnv = false) {
  await mkdir(destination, { recursive: true });
  for (const file of ["package.json", "package-lock.json"]) {
    await cp(join(source, file), join(destination, file));
  }
  if (includeEnv) await cp(join(source, ".env.example"), join(destination, ".env.example"));
  await cp(join(source, "dist"), join(destination, "dist"), { recursive: true });
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "arena90-solana-resolver-release-"));
const artifactName = `arena90-solana-resolver-${releaseVersion}`;
const stage = join(temporaryRoot, artifactName);
const stagedResolver = join(stage, "resolver");
const archive = join(outputRoot, `${artifactName}.tar.gz`);

try {
  await copyPackage(resolverRoot, stagedResolver, true);
  await copyPackage(runtimeRoot, join(stage, "arena-runtime"));
  await mkdir(join(stagedResolver, "idl"), { recursive: true });
  await cp(contractIdl, join(stagedResolver, "idl", "arena_escrow.json"));
  await run(
    "npm",
    ["ci", "--omit=dev", "--ignore-scripts", "--no-audit"],
    stagedResolver,
  );

  const releasePackage = JSON.parse(
    await readFile(join(stagedResolver, "package.json"), "utf8"),
  );
  delete releasePackage.devDependencies;
  releasePackage.scripts = { start: "node --env-file-if-exists=.env dist/src/main.js" };
  await writeFile(
    join(stagedResolver, "package.json"),
    `${JSON.stringify(releasePackage, null, 2)}\n`,
  );
  await writeFile(
    join(stage, "RELEASE.json"),
    `${JSON.stringify(
      { schemaVersion: 1, component: "arena90-solana-resolver", releaseVersion },
      null,
      2,
    )}\n`,
  );
  await mkdir(dirname(archive), { recursive: true });
  await rm(archive, { force: true });
  await run(
    "tar",
    ["--no-xattrs", "-czf", archive, "-C", temporaryRoot, artifactName],
    resolverRoot,
  );
  await writeFile(
    `${archive}.sha256`,
    `${await checksum(archive)}  ${basename(archive)}\n`,
  );
  console.log(`Solana resolver release created: ${archive}`);
} catch {
  console.error("Solana resolver release failed: BUILD_FAILURE.");
  process.exitCode = 1;
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
