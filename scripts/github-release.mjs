#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const cwd = process.cwd();
const packagePath = path.join(cwd, "package.json");
const packageLockPath = path.join(cwd, "package-lock.json");
const args = process.argv.slice(2);
const flags = new Set();
const options = new Map();
const positionals = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (!arg.startsWith("--")) {
    positionals.push(arg);
    continue;
  }

  const [key, ...rest] = arg.split("=");
  if (rest.length > 0) {
    options.set(key, rest.join("="));
    continue;
  }

  if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
    options.set(key, args[i + 1]);
    i += 1;
    continue;
  }

  flags.add(key);
}

const requestedVersion = positionals[0] ?? "patch";
const dryRun = flags.has("--dry-run");
const noPush = flags.has("--no-push");
const allowDirty = flags.has("--allow-dirty");
const noRelease = flags.has("--no-release");
const releaseTitleTemplate = options.get("--release-title-template") ?? "## {tag} 版本更新";
const releaseNoteTemplatePath = options.get("--release-note-template");

const GITHUB_API_BASE = "https://api.github.com";
const DEFAULT_RELEASE_NOTE_TEMPLATE = `{{title}}

### 变更提交
{{commits}}

### 变更文件
{{files}}

### 说明
- 发布时间（自动生成）：{{generated_at}}
- 来源：{{source}}
`;

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

function runWithInput(command, commandArgs, input, options = {}) {
  if (dryRun && options.mutates !== false) {
    log(`dry-run: ${command} ${commandArgs.join(" ")}`);
    return { stdout: "", status: 0 };
  }

  const result = spawnSync(command, commandArgs, {
    cwd,
    env: process.env,
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
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
    fail(
      "Usage: npm run release:github -- [patch|minor|major|vX.Y.Z] [--dry-run] [--no-push] [--allow-dirty] [--no-release] [--release-title-template \"<tmpl>\"] [--release-note-template <path>]"
    );
  }
  return explicit.value;
}

function resolveReleaseTitle(rawTemplate, tag) {
  return rawTemplate
    .replaceAll("{tag}", tag)
    .replaceAll("{{tag}}", tag)
    .trim();
}

function getReleaseNoteTemplate() {
  if (!releaseNoteTemplatePath) {
    return DEFAULT_RELEASE_NOTE_TEMPLATE;
  }
  const customPath = path.resolve(cwd, releaseNoteTemplatePath);
  return readFileSync(customPath, "utf8");
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

function getRepositoryInfo() {
  const remote = run("git", ["remote", "get-url", "origin"], { capture: true, mutates: false }).stdout;
  const match = remote.match(/github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/i);
  if (!match) {
    fail(`could not parse GitHub owner/repo from origin remote: ${remote}`);
  }
  return {
    owner: match[1],
    repo: match[2],
  };
}

function getGithubToken() {
  const tokenFromEnv = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_API_TOKEN;
  if (tokenFromEnv) {
    return tokenFromEnv;
  }

  const result = runWithInput(
    "git",
    ["credential", "fill"],
    "protocol=https\nhost=github.com\n\n",
    { capture: true, mutates: false },
  );
  const passwordLine = result.stdout
    .split(/\r?\n/)
    .find((line) => line.startsWith("password="));
  const token = passwordLine?.replace(/^password=/, "");
  return token ? token.trim() : "";
}

async function githubApiRequest(method, endpoint, token, payload) {
  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
    method,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `token ${token}`,
      "User-Agent": "tech-cc-hub-release-script",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(payload ? { "Content-Type": "application/json" } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const responseText = await response.text();
  if (!response.ok) {
    const error = new Error(
      `GitHub API ${method} ${endpoint} failed with ${response.status}: ${responseText || response.statusText}`
    );
    // @ts-ignore
    error.status = response.status;
    throw error;
  }

  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

function getPreviousTag(tag) {
  const tags = run("git", ["tag", "--sort=-creatordate", "--merged"], { capture: true, mutates: false }).stdout
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter((name) => /^v?\d+\.\d+\.\d+/.test(name));

  const currentTagIndex = tags.indexOf(tag);
  if (currentTagIndex === -1 || currentTagIndex + 1 >= tags.length) {
    return null;
  }
  return tags[currentTagIndex + 1];
}

function getCommitsSinceTag(tag) {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const stdout = run("git", ["log", "--no-merges", `--pretty=%h %s`, range], { capture: true, mutates: false }).stdout;
  return stdout ? stdout.split(/\r?\n/).filter(Boolean) : [];
}

function getFilesSinceTag(tag) {
  if (!tag) {
    return [];
  }

  const stdout = run("git", ["diff", "--name-only", `${tag}..HEAD`], { capture: true, mutates: false }).stdout;
  return stdout
    ? [...new Set(stdout.split(/\r?\n/).filter(Boolean))]
    : [];
}

function createReleaseBody({ tag, commits, files }) {
  const createdTime = new Date().toISOString();
  const title = resolveReleaseTitle(releaseTitleTemplate, tag);

  const listify = (items, fallback, max = 40) => {
    if (!items.length) {
      return `- ${fallback}`;
    }

    const visible = items.slice(0, max);
    const overflow = items.length - visible.length;
    const lines = visible.map((line) => `- ${line}`);
    if (overflow > 0) {
      lines.push(`- ...以及其余 ${overflow} 条变更`);
    }
    return lines.join("\n");
  };

  const template = getReleaseNoteTemplate();

  return template
    .replaceAll("{{title}}", title)
    .replaceAll("{{tag}}", tag)
    .replaceAll("{{commits}}", listify(commits, "无新增提交"))
    .replaceAll("{{files}}", listify(files, "无文件变更"))
    .replaceAll("{{generated_at}}", createdTime)
    .replaceAll("{{source}}", "脚本生成的提交日志与差异");
}

async function upsertGithubRelease(tagName, body) {
  const token = getGithubToken();
  if (!token) {
    log("no GitHub token available; skip release API update.");
    return;
  }

  const { owner, repo } = getRepositoryInfo();
  const encodedTag = encodeURIComponent(tagName);
  let existingRelease = null;

  try {
    existingRelease = await githubApiRequest("GET", `/repos/${owner}/${repo}/releases/tags/${encodedTag}`, token);
  } catch (error) {
    // @ts-ignore
    if (error?.status !== 404) {
      throw error;
    }
  }

  if (!existingRelease) {
    await githubApiRequest("POST", `/repos/${owner}/${repo}/releases`, token, {
      tag_name: tagName,
      name: tagName,
      target_commitish: "main",
      body,
      draft: false,
      prerelease: false,
    });
    log(`Created GitHub release via API: ${tagName}`);
  } else {
    await githubApiRequest("PATCH", `/repos/${owner}/${repo}/releases/${existingRelease.id}`, token, {
      name: existingRelease.name ?? tagName,
      body,
    });
    log(`Updated GitHub release via API: ${tagName}`);
  }
}

async function main() {
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

  if (!noRelease) {
    const previousTag = getPreviousTag(tag);
    const commits = getCommitsSinceTag(previousTag);
    const files = getFilesSinceTag(previousTag);
    const body = createReleaseBody({ tag, commits, files });
    await upsertGithubRelease(tag, body);
  }

  log("GitHub Actions release workflow has been triggered by the tag push.");
  log("Release page: https://github.com/lst016/tech-cc-hub/releases");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
