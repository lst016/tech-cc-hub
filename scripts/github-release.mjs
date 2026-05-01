#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const cwd = process.cwd();
const packagePath = path.join(cwd, "package.json");
const packageLockPath = path.join(cwd, "package-lock.json");
const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const positionals = args.filter((arg) => !arg.startsWith("--"));
const requestedVersion = positionals[0] ?? "patch";
const dryRun = flags.has("--dry-run");
const noPush = flags.has("--no-push");
const allowDirty = flags.has("--allow-dirty");

function log(message) {
  console.log(`[github-release] ${message}`);
}

function fail(message) {
  console.error(`[github-release] ${message}`);
  process.exit(1);
}

function run(command, commandArgs, options = {}) {
  if (dryRun && options.mutates !== false) {
    log(`dry-run: ${command} ${commandArgs.join(" ")}`);
    return { stdout: "", status: 0 };
  }

  const result = spawnSync(command, commandArgs, {
    cwd,
    env: process.env,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: false,
  });

  if (result.error) {
    fail(`${command} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    fail(stderr || `${command} exited with ${result.status}`);
  }

  return {
    stdout: result.stdout?.trim() ?? "",
    status: result.status ?? 0,
  };
}

function readPackageJson() {
  return JSON.parse(readFileSync(packagePath, "utf8"));
}

function parseVersion(value) {
  const normalized = value.replace(/^v/i, "").trim();
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    value: normalized,
  };
}

function bumpVersion(current, mode) {
  const version = parseVersion(current);
  if (!version) {
    fail(`package.json version is not semver: ${current}`);
  }

  if (mode === "major") {
    return `${version.major + 1}.0.0`;
  }
  if (mode === "minor") {
    return `${version.major}.${version.minor + 1}.0`;
  }
  if (mode === "patch") {
    return `${version.major}.${version.minor}.${version.patch + 1}`;
  }

  const explicit = parseVersion(mode);
  if (!explicit) {
    fail("Usage: npm run release:github -- [patch|minor|major|vX.Y.Z] [--dry-run] [--no-push] [--allow-dirty]");
  }
  return explicit.value;
}

function ensureGitRepository() {
  run("git", ["rev-parse", "--is-inside-work-tree"], { capture: true, mutates: false });
}

function ensureCleanWorktree() {
  if (allowDirty) {
    log("warning: --allow-dirty enabled; release commit may include only version files while other changes remain.");
    return;
  }

  const status = run("git", ["status", "--porcelain"], { capture: true, mutates: false }).stdout;
  if (status) {
    fail("working tree is dirty. Commit or stash changes before releasing, or pass --allow-dirty intentionally.");
  }
}

function ensureTagDoesNotExist(tag) {
  const local = spawnSync("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (local.status === 0) {
    fail(`local tag already exists: ${tag}`);
  }

  const remote = run("git", ["ls-remote", "--tags", "origin", tag], { capture: true, mutates: false }).stdout;
  if (remote) {
    fail(`remote tag already exists: ${tag}`);
  }
}

function ensureOriginRemote() {
  const remote = run("git", ["remote", "get-url", "origin"], { capture: true, mutates: false }).stdout;
  if (!/github\.com[:/]lst016\/tech-cc-hub(?:\.git)?$/i.test(remote)) {
    log(`warning: origin is ${remote}`);
    log("expected GitHub update repo: https://github.com/lst016/tech-cc-hub");
  }
}

function main() {
  if (!existsSync(packagePath)) {
    fail("package.json not found. Run this from the project root.");
  }

  ensureGitRepository();
  ensureOriginRemote();
  ensureCleanWorktree();

  const packageJson = readPackageJson();
  const currentVersion = String(packageJson.version ?? "");
  const nextVersion = bumpVersion(currentVersion, requestedVersion);
  const tag = `v${nextVersion}`;
  ensureTagDoesNotExist(tag);

  log(`current version: ${currentVersion}`);
  log(`next version: ${nextVersion}`);
  log(`release tag: ${tag}`);

  if (currentVersion !== nextVersion) {
    run("npm", ["version", nextVersion, "--no-git-tag-version"]);
  } else {
    log("package.json already has the requested version; skipping npm version.");
  }

  const filesToCommit = ["package.json"];
  if (existsSync(packageLockPath)) {
    filesToCommit.push("package-lock.json");
  }
  run("git", ["add", ...filesToCommit]);
  run("git", ["commit", "-m", `chore: release ${tag}`]);
  run("git", ["tag", "-a", tag, "-m", tag]);

  if (noPush) {
    log("--no-push enabled; release commit and tag were created locally only.");
    log(`push later with: git push origin HEAD && git push origin ${tag}`);
    return;
  }

  run("git", ["push", "origin", "HEAD"]);
  run("git", ["push", "origin", tag]);
  log("GitHub Actions release workflow has been triggered by the tag push.");
  log("Release page: https://github.com/lst016/tech-cc-hub/releases");
}

main();
