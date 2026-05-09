#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import https from "node:https";
import path from "node:path";
import process from "node:process";

const OWNER = "lst016";
const REPO = "tech-cc-hub";
const DEFAULT_BRANCH = "main";

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const values = new Map();
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg.startsWith("--") && args[index + 1] && !args[index + 1].startsWith("--")) {
    values.set(arg, args[index + 1]);
    index += 1;
  }
}

const tag = values.get("--tag") ?? "";
const notesPath = values.get("--notes") ?? "";
const retag = flags.has("--retag");
const deleteRelease = flags.has("--delete-release");
const apiOnly = flags.has("--api-only");
const notesOnly = flags.has("--notes-only");

function log(message) {
  console.log(`[tech-cc-hub-release] ${message}`);
}

function fail(message) {
  console.error(`[tech-cc-hub-release] ${message}`);
  process.exit(1);
}

function git(argsForGit, options = {}) {
  return execFileSync("git", argsForGit, {
    encoding: options.encoding ?? "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
}

function gitBuffer(argsForGit) {
  return execFileSync("git", argsForGit, {
    encoding: "buffer",
    maxBuffer: 128 * 1024 * 1024,
  });
}

function runGit(argsForGit) {
  const result = spawnSync("git", argsForGit, {
    stdio: "inherit",
    shell: false,
  });
  return result.status === 0;
}

function getCredentialToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;

  const credential = execFileSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
  });
  const passwordLine = credential.split(/\r?\n/).find((line) => line.startsWith("password="));
  return passwordLine?.slice("password=".length).trim() || "";
}

function request(method, apiPath, body, token) {
  const data = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.github.com",
      path: apiPath,
      method,
      headers: {
        "Accept": "application/vnd.github+json",
        "User-Agent": "tech-cc-hub-release-deploy",
        "Authorization": `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(data ? { "Content-Type": "application/json", "Content-Length": data.length } : {}),
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        const parsed = text ? JSON.parse(text) : null;
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
          return;
        }
        if (res.statusCode === 404) {
          resolve({ __notFound: true, status: 404, message: parsed?.message ?? text });
          return;
        }
        reject(new Error(`${method} ${apiPath} failed ${res.statusCode}: ${parsed?.message ?? text}`));
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function parseNameStatus(raw) {
  const parts = raw.split("\0").filter(Boolean);
  const entries = [];
  for (let index = 0; index < parts.length;) {
    const status = parts[index++];
    if (status.startsWith("R") || status.startsWith("C")) {
      entries.push({ status: "D", filePath: parts[index++] });
      entries.push({ status: "A", filePath: parts[index++] });
    } else {
      entries.push({ status, filePath: parts[index++] });
    }
  }
  return entries;
}

function readTreeMode(ref, filePath) {
  const output = git(["ls-tree", ref, "--", filePath]).trim();
  const match = output.match(/^(\d+)\s+blob\s+[0-9a-f]+\t(.+)$/);
  if (!match) fail(`Cannot read tree entry for ${ref}:${filePath}`);
  return match[1];
}

async function updateReleaseNotes(token) {
  if (!tag || !notesPath) fail("--notes-only requires --tag and --notes");
  const absoluteNotesPath = path.resolve(notesPath);
  if (!existsSync(absoluteNotesPath)) fail(`Release notes file not found: ${absoluteNotesPath}`);
  const body = readFileSync(absoluteNotesPath, "utf8").trim();
  const release = await request("GET", `/repos/${OWNER}/${REPO}/releases/tags/${encodeURIComponent(tag)}`, undefined, token);
  if (release?.__notFound) fail(`Release not found for ${tag}`);
  await request("PATCH", `/repos/${OWNER}/${REPO}/releases/${release.id}`, {
    name: tag.replace(/^v/, ""),
    body,
  }, token);
  log(`updated release notes for ${tag}`);
}

async function publishViaApi(token) {
  const localHead = git(["rev-parse", "HEAD"]).trim();
  const remoteLine = git(["ls-remote", "origin", `refs/heads/${DEFAULT_BRANCH}`]).trim();
  const remoteHead = remoteLine.split(/\s+/)[0];
  if (!remoteHead) fail(`Cannot resolve origin/${DEFAULT_BRANCH}`);

  const remoteCommit = await request("GET", `/repos/${OWNER}/${REPO}/git/commits/${remoteHead}`, undefined, token);
  const rawStatus = git(["diff", "--name-status", "-z", remoteHead, localHead]);
  const changes = parseNameStatus(rawStatus);
  if (changes.length === 0) {
    log("remote main already has the same tree as HEAD or no diff was detected");
  }

  const tree = [];
  let blobCount = 0;
  for (const change of changes) {
    if (change.status === "D") {
      tree.push({
        path: change.filePath,
        mode: readTreeMode(remoteHead, change.filePath),
        type: "blob",
        sha: null,
      });
      continue;
    }
    const content = gitBuffer(["show", `${localHead}:${change.filePath}`]).toString("base64");
    const blob = await request("POST", `/repos/${OWNER}/${REPO}/git/blobs`, {
      content,
      encoding: "base64",
    }, token);
    tree.push({
      path: change.filePath,
      mode: readTreeMode(localHead, change.filePath),
      type: "blob",
      sha: blob.sha,
    });
    blobCount += 1;
  }

  const nextTree = await request("POST", `/repos/${OWNER}/${REPO}/git/trees`, {
    base_tree: remoteCommit.tree.sha,
    tree,
  }, token);
  const message = git(["log", "-1", "--format=%B"]);
  const nextCommit = await request("POST", `/repos/${OWNER}/${REPO}/git/commits`, {
    message,
    tree: nextTree.sha,
    parents: [remoteHead],
  }, token);

  if (deleteRelease && tag) {
    const release = await request("GET", `/repos/${OWNER}/${REPO}/releases/tags/${encodeURIComponent(tag)}`, undefined, token);
    if (release && !release.__notFound) {
      await request("DELETE", `/repos/${OWNER}/${REPO}/releases/${release.id}`, undefined, token);
      log(`deleted existing release ${tag}`);
    }
  }

  await request("PATCH", `/repos/${OWNER}/${REPO}/git/refs/heads/${DEFAULT_BRANCH}`, {
    sha: nextCommit.sha,
    force: false,
  }, token);

  if (tag) {
    if (!retag) {
      const existing = await request("GET", `/repos/${OWNER}/${REPO}/git/ref/tags/${encodeURIComponent(tag)}`, undefined, token);
      if (existing && !existing.__notFound) fail(`Tag ${tag} exists. Use --retag to move it.`);
    }
    const tagObject = await request("POST", `/repos/${OWNER}/${REPO}/git/tags`, {
      tag,
      message: tag,
      object: nextCommit.sha,
      type: "commit",
    }, token);
    const refPath = `/repos/${OWNER}/${REPO}/git/refs/tags/${encodeURIComponent(tag)}`;
    const existingRef = await request("GET", `/repos/${OWNER}/${REPO}/git/ref/tags/${encodeURIComponent(tag)}`, undefined, token);
    if (existingRef?.__notFound) {
      await request("POST", `/repos/${OWNER}/${REPO}/git/refs`, {
        ref: `refs/tags/${tag}`,
        sha: tagObject.sha,
      }, token);
    } else {
      await request("PATCH", refPath, {
        sha: tagObject.sha,
        force: Boolean(retag),
      }, token);
    }
    log(`updated ${tag} -> ${tagObject.sha}`);
  }

  log(`remote ${DEFAULT_BRANCH}: ${remoteHead} -> ${nextCommit.sha}`);
  log(`uploaded blobs=${blobCount}, tree entries=${tree.length}`);
}

async function main() {
  git(["rev-parse", "--is-inside-work-tree"]);
  const token = getCredentialToken();
  if (!token) fail("Missing GitHub token. Set GH_TOKEN/GITHUB_TOKEN or login with Git credential manager.");

  if (notesOnly) {
    await updateReleaseNotes(token);
    return;
  }

  if (!apiOnly) {
    const pushedMain = runGit(["push", "origin", DEFAULT_BRANCH]);
    const pushedTag = tag ? runGit(["push", "origin", retag ? `+refs/tags/${tag}` : `refs/tags/${tag}`]) : true;
    if (pushedMain && pushedTag) {
      log("published with normal git push");
      if (notesPath) await updateReleaseNotes(token);
      return;
    }
    log("normal git push failed; falling back to GitHub API");
  }

  await publishViaApi(token);
  if (notesPath && !deleteRelease) await updateReleaseNotes(token);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
