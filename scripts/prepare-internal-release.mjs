#!/usr/bin/env node

import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const TARGETS = new Set(["win-x64", "mac-arm64", "mac-x64"]);

function fail(message) {
  throw new Error(`[internal-release] ${message}`);
}

function parseArguments(argv) {
  const options = {
    target: "",
    distDir: "dist",
    outputDir: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--") && !options.target) {
      options.target = value;
      continue;
    }
    if (value === "--dist") {
      options.distDir = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (value === "--output") {
      options.outputDir = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    fail(`unknown argument: ${value}`);
  }

  if (!TARGETS.has(options.target)) {
    fail(`target must be one of: ${[...TARGETS].join(", ")}`);
  }
  if (!options.distDir) {
    fail("--dist requires a directory");
  }

  return options;
}

function extractMetadataVersion(metadata) {
  const match = metadata.match(/^version:\s*['"]?([^'"\s]+)['"]?\s*$/m);
  return match?.[1] ?? "";
}

function extractDeclaredArtifact(metadata, keyPattern) {
  const match = metadata.match(keyPattern);
  return match?.[1]?.trim() ?? "";
}

function normalizeArtifactName(value) {
  const unquoted = value.replace(/^['"]|['"]$/g, "").trim();
  if (!unquoted) {
    fail("update metadata contains an empty artifact name");
  }

  let decoded = unquoted;
  try {
    decoded = decodeURIComponent(unquoted);
  } catch {
    // Keep the original value when it is not URI encoded.
  }

  if (
    path.isAbsolute(decoded)
    || decoded.includes("/")
    || decoded.includes("\\")
    || decoded === "."
    || decoded === ".."
    || decoded.includes("\0")
  ) {
    fail(`update metadata declares an unsafe artifact path: ${value}`);
  }

  return decoded;
}

function extractPrimaryArtifact(metadata) {
  const declared = extractDeclaredArtifact(
    metadata,
    /^path:\s*['"]?(.+?)['"]?\s*$/m,
  );
  if (!declared) {
    fail("update metadata does not declare path");
  }
  return normalizeArtifactName(declared);
}

function extractAllArtifacts(metadata) {
  const artifacts = new Set([extractPrimaryArtifact(metadata)]);
  for (const match of metadata.matchAll(/^\s*-\s+url:\s*['"]?(.+?)['"]?\s*$/gm)) {
    artifacts.add(normalizeArtifactName(match[1]));
  }
  return [...artifacts];
}

async function assertNonEmptyFile(filePath, label) {
  let fileStats;
  try {
    fileStats = await stat(filePath);
  } catch {
    fail(`${label} is missing: ${filePath}`);
  }
  if (!fileStats.isFile() || fileStats.size === 0) {
    fail(`${label} is empty or not a file: ${filePath}`);
  }
}

async function copyRequiredFile(sourcePath, destinationPath, label) {
  await assertNonEmptyFile(sourcePath, label);
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
}

function hasArchitectureMarker(fileName, architecture) {
  const escaped = architecture.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[-_. ])${escaped}(?:[-_. ]|$)`, "i").test(fileName);
}

function addArchitectureMarker(fileName, architecture) {
  if (hasArchitectureMarker(fileName, architecture)) {
    return fileName;
  }
  const parsed = path.parse(fileName);
  return `${parsed.name}-${architecture}${parsed.ext}`;
}

function replaceArtifactName(metadata, sourceName, destinationName) {
  if (sourceName === destinationName) {
    return metadata;
  }
  return metadata.split(sourceName).join(destinationName);
}

async function readAndValidateMetadata(metadataPath, expectedVersion) {
  await assertNonEmptyFile(metadataPath, "update metadata");
  const metadata = await readFile(metadataPath, "utf8");
  const metadataVersion = extractMetadataVersion(metadata);
  if (metadataVersion !== expectedVersion) {
    fail(
      `${path.basename(metadataPath)} version ${metadataVersion || "(missing)"} `
      + `does not match package.json version ${expectedVersion}`,
    );
  }
  return metadata;
}

async function prepareWindows({ distDir, outputDir, version }) {
  const metadataName = "latest.yml";
  const metadataPath = path.join(distDir, metadataName);
  const metadata = await readAndValidateMetadata(metadataPath, version);
  const artifacts = extractAllArtifacts(metadata);

  for (const artifact of artifacts) {
    await copyRequiredFile(
      path.join(distDir, artifact),
      path.join(outputDir, artifact),
      `Windows updater artifact ${artifact}`,
    );
    if (artifact.toLowerCase().endsWith(".exe")) {
      await copyRequiredFile(
        path.join(distDir, `${artifact}.blockmap`),
        path.join(outputDir, `${artifact}.blockmap`),
        `Windows updater blockmap ${artifact}.blockmap`,
      );
    }
  }

  await writeFile(path.join(outputDir, metadataName), metadata, "utf8");
  return [metadataName, ...artifacts];
}

function matchesMacDmg(fileName, architecture, version) {
  if (!fileName.toLowerCase().endsWith(".dmg") || !fileName.includes(version)) {
    return false;
  }
  if (architecture === "arm64") {
    return hasArchitectureMarker(fileName, "arm64");
  }
  return !hasArchitectureMarker(fileName, "arm64");
}

async function prepareMac({ distDir, outputDir, version, architecture }) {
  const sourceMetadataName = "latest-mac.yml";
  const outputMetadataName = architecture === "x64"
    ? "latest-x64-mac.yml"
    : sourceMetadataName;
  const sourceMetadataPath = path.join(distDir, sourceMetadataName);
  let metadata = await readAndValidateMetadata(sourceMetadataPath, version);
  const sourceZipName = extractPrimaryArtifact(metadata);
  if (!sourceZipName.toLowerCase().endsWith(".zip")) {
    fail(`${sourceMetadataName} must point to a .zip artifact`);
  }

  const outputZipName = addArchitectureMarker(sourceZipName, architecture);
  metadata = replaceArtifactName(metadata, sourceZipName, outputZipName);

  await copyRequiredFile(
    path.join(distDir, sourceZipName),
    path.join(outputDir, outputZipName),
    `macOS ${architecture} updater zip`,
  );
  await copyRequiredFile(
    path.join(distDir, `${sourceZipName}.blockmap`),
    path.join(outputDir, `${outputZipName}.blockmap`),
    `macOS ${architecture} updater blockmap`,
  );

  const entries = await readdir(distDir, { withFileTypes: true });
  const dmgNames = entries
    .filter((entry) => entry.isFile() && matchesMacDmg(entry.name, architecture, version))
    .map((entry) => entry.name);
  if (dmgNames.length === 0) {
    fail(`macOS ${architecture} DMG is missing from ${distDir}`);
  }

  const outputDmgNames = [];
  for (const dmgName of dmgNames) {
    const outputDmgName = addArchitectureMarker(dmgName, architecture);
    await copyRequiredFile(
      path.join(distDir, dmgName),
      path.join(outputDir, outputDmgName),
      `macOS ${architecture} DMG`,
    );
    outputDmgNames.push(outputDmgName);
  }

  await writeFile(path.join(outputDir, outputMetadataName), metadata, "utf8");
  return [
    outputMetadataName,
    outputZipName,
    `${outputZipName}.blockmap`,
    ...outputDmgNames,
  ];
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const projectRoot = process.cwd();
  const packageJson = JSON.parse(
    await readFile(path.join(projectRoot, "package.json"), "utf8"),
  );
  const version = String(packageJson.version ?? "").trim();
  if (!version) {
    fail("package.json does not declare a version");
  }

  const distDir = path.resolve(projectRoot, options.distDir);
  const outputDir = path.resolve(
    projectRoot,
    options.outputDir || path.join(options.distDir, "internal-release", `v${version}`),
  );
  await mkdir(outputDir, { recursive: true });

  const context = { distDir, outputDir, version };
  const files = options.target === "win-x64"
    ? await prepareWindows(context)
    : await prepareMac({
      ...context,
      architecture: options.target === "mac-arm64" ? "arm64" : "x64",
    });

  console.log(`[internal-release] prepared ${options.target} v${version}`);
  console.log(`[internal-release] upload directory: ${outputDir}`);
  for (const file of files) {
    console.log(`  - ${file}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
