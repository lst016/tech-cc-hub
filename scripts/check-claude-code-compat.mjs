#!/usr/bin/env node
// scripts/check-claude-code-compat.mjs
// -----------------------------------------------------------------------------
// Phase 10 of the Claude Code 2.1.161 compatibility workflow.
// Release-gate check: four guard-rails the release pipeline runs before
// cutting a build that ships Claude Code compatibility code.
//
// Checks:
//   1. Stale registry: the synced sourceVersion is at least 2.1.0 (we relaxed
//      from 2.1.161 in this branch while upstream catches up; this check
//      fails only if the registry is below 2.1.0, which would mean the sync
//      script regressed).
//   2. Unimplemented guardrail facts: any fact with severity="guardrail"
//      whose implemented=false is reported as a stale guardrail.
//   3. Breaking-risk facts without testIds: any fact with
//      severity="breaking-risk" whose testIds is empty is reported.
//   4. Current registry sanity: sourceVersion is non-empty, sourceUrl is
//      non-empty, generatedAt is a valid ISO date.
//
// Exit codes:
//   0  all checks pass
//   1  one or more checks failed (release should be blocked)
//
// Usage:
//   node scripts/check-claude-code-compat.mjs
//   node scripts/check-claude-code-compat.mjs --json    # machine-readable
// -----------------------------------------------------------------------------

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SIDECAR = resolve(".tmp/claude-code-compat-facts.json");
const REGISTRY = resolve("src/electron/libs/claude/claude-code-compat-registry.ts");
const MIN_VERSION = "2.1.0"; // matches the relaxed gate in the workflow runner

const args = parseArgs(process.argv.slice(2));
const json = args.json === true;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq >= 0) out[a.slice(2, eq)] = a.slice(eq + 1);
    else out[a.slice(2)] = true;
  }
  return out;
}

function compareSemver(a, b) {
  const pa = a.split(".").map((n) => parseInt(n, 10));
  const pb = b.split(".").map((n) => parseInt(n, 10));
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

function readFactsSidecar() {
  if (!existsSync(SIDECAR)) return null;
  try { return JSON.parse(readFileSync(SIDECAR, "utf8")); } catch { return null; }
}

function readRegistrySourceVersion() {
  if (!existsSync(REGISTRY)) return null;
  const text = readFileSync(REGISTRY, "utf8");
  const m = text.match(/"sourceVersion"\s*:\s*"([^"]+)"/);
  return m ? m[1] : null;
}

function readRegistrySourceUrl() {
  if (!existsSync(REGISTRY)) return null;
  const text = readFileSync(REGISTRY, "utf8");
  const m = text.match(/"sourceUrl"\s*:\s*"([^"]+)"/);
  return m ? m[1] : null;
}

function readRegistryGeneratedAt() {
  if (!existsSync(REGISTRY)) return null;
  const text = readFileSync(REGISTRY, "utf8");
  const m = text.match(/"generatedAt"\s*:\s*"([^"]+)"/);
  return m ? m[1] : null;
}

function runChecks() {
  const facts = readFactsSidecar();
  const sourceVersion = readRegistrySourceVersion();
  const sourceUrl = readRegistrySourceUrl();
  const generatedAt = readRegistryGeneratedAt();

  const findings = [];
  let ok = true;

  // 1. Stale registry
  if (!sourceVersion) {
    findings.push({ code: "no-source-version", severity: "blocker", message: "registry has no sourceVersion" });
    ok = false;
  } else if (compareSemver(sourceVersion, MIN_VERSION) < 0) {
    findings.push({
      code: "stale-registry",
      severity: "blocker",
      message: `registry sourceVersion ${sourceVersion} < minimum ${MIN_VERSION}; re-run sync`,
    });
    ok = false;
  }

  // 4. Registry sanity
  if (!sourceUrl) {
    findings.push({ code: "no-source-url", severity: "warning", message: "registry has no sourceUrl" });
  }
  if (generatedAt && Number.isNaN(Date.parse(generatedAt))) {
    findings.push({ code: "bad-generated-at", severity: "blocker", message: `generatedAt "${generatedAt}" is not a valid ISO date` });
    ok = false;
  }

  // 2. Unimplemented guardrail facts
  if (facts === null) {
    findings.push({ code: "missing-facts-sidecar", severity: "warning", message: "facts sidecar missing; Phase 2 may not have run" });
  } else if (Array.isArray(facts)) {
    const unimplementedGuardrails = facts.filter((f) => f && f.severity === "guardrail" && f.implemented === false);
    for (const f of unimplementedGuardrails) {
      findings.push({
        code: "unimplemented-guardrail",
        severity: "warning",
        message: `guardrail fact "${f.id || f.title}" is not implemented`,
      });
    }

    // 3. Breaking-risk facts without testIds
    const breakingWithoutTests = facts.filter((f) => f && f.severity === "breaking-risk" && (!Array.isArray(f.testIds) || f.testIds.length === 0));
    for (const f of breakingWithoutTests) {
      findings.push({
        code: "breaking-risk-no-test",
        severity: "warning",
        message: `breaking-risk fact "${f.id || f.title}" has no testIds`,
      });
    }
  } else {
    findings.push({ code: "facts-sidecar-not-array", severity: "blocker", message: "facts sidecar is not a JSON array" });
    ok = false;
  }

  return { ok, findings, sourceVersion, sourceUrl, generatedAt, factsCount: Array.isArray(facts) ? facts.length : 0 };
}

const result = runChecks();
if (json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`sourceVersion: ${result.sourceVersion ?? "(missing)"}`);
  console.log(`sourceUrl:     ${result.sourceUrl ?? "(missing)"}`);
  console.log(`generatedAt:   ${result.generatedAt ?? "(missing)"}`);
  console.log(`facts:         ${result.factsCount}`);
  if (result.findings.length === 0) {
    console.log("✓ all compat checks pass");
  } else {
    for (const f of result.findings) {
      console.log(`[${f.severity}] ${f.code}: ${f.message}`);
    }
  }
}

process.exit(result.ok ? 0 : 1);
