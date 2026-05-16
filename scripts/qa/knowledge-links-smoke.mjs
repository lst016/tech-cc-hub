#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const DEFAULT_REPOWIKI_ROOT = path.join(REPO_ROOT, ".tech", "repowiki");

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const writeReport = args.has("--write-report");
const jsonOutput = args.has("--json");
const rootArg = rawArgs.find((arg) => !arg.startsWith("--"));
const repowikiRoot = path.resolve(REPO_ROOT, rootArg ?? DEFAULT_REPOWIKI_ROOT);

const report = {
  ok: true,
  root: toPosix(path.relative(REPO_ROOT, repowikiRoot) || "."),
  generatedAt: new Date().toISOString(),
  summary: {
    wikiRoots: 0,
    markdownFiles: 0,
    sidebarLinks: 0,
    metadataPages: 0,
    agentCards: 0,
    fileLinks: 0,
    mermaidBlocks: 0,
    orphanMarkdownFiles: 0,
    softReferences: 0,
  },
  errors: [],
  warnings: [],
};

const SOURCE_EXTENSIONS = [
  ".cjs",
  ".css",
  ".cts",
  ".go",
  ".html",
  ".java",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".mjs",
  ".mts",
  ".py",
  ".rs",
  ".sh",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
];

const COMPILED_JS_SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".jsx"];

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function addIssue(kind, type, file, message, target) {
  const issue = {
    type,
    file: file ? toPosix(path.relative(REPO_ROOT, file)) : undefined,
    target,
    message,
  };
  if (kind === "error") {
    report.errors.push(issue);
    report.ok = false;
  } else {
    report.warnings.push(issue);
  }
}

function readText(file) {
  return readFileSync(file, "utf8");
}

function readJson(file) {
  try {
    return JSON.parse(readText(file));
  } catch (error) {
    addIssue("error", "invalid-json", file, error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

function walkFiles(root, predicate = () => true) {
  if (!existsSync(root)) return [];
  const output = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of readdirSync(current)) {
      const fullPath = path.join(current, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        stack.push(fullPath);
      } else if (predicate(fullPath)) {
        output.push(fullPath);
      }
    }
  }
  return output.sort();
}

function detectWikiRoots(root) {
  if (!existsSync(root)) return [];
  const roots = [];
  if (existsSync(path.join(root, "content")) || existsSync(path.join(root, "agent-cards"))) {
    roots.push(root);
  }
  for (const entry of readdirSync(root)) {
    const fullPath = path.join(root, entry);
    if (!statSync(fullPath).isDirectory()) continue;
    if (existsSync(path.join(fullPath, "content")) || existsSync(path.join(fullPath, "agent-cards"))) {
      roots.push(fullPath);
    }
  }
  return roots.sort();
}

function stripMarkdownTitle(target) {
  const trimmed = target.trim().replace(/^<(.+)>$/, "$1");
  const titleMatch = /^(.+?)(?:\s+["'][^"']+["'])$/.exec(trimmed);
  return titleMatch ? titleMatch[1].trim() : trimmed;
}

function splitTarget(target) {
  const cleanTarget = stripMarkdownTitle(target);
  const hashIndex = cleanTarget.indexOf("#");
  if (hashIndex === -1) return { pathPart: cleanTarget, anchor: "" };
  return {
    pathPart: cleanTarget.slice(0, hashIndex),
    anchor: cleanTarget.slice(hashIndex + 1),
  };
}

function isExternalTarget(target) {
  return /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(target);
}

function decodeTargetPath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseMarkdownLinks(markdown) {
  const links = [];
  const linkPattern = /!?\[[^\]\n]*(?:\][^\]\n]*)*\]\(([^)\n]+)\)/g;
  let match;
  while ((match = linkPattern.exec(markdown)) !== null) {
    links.push(match[1]);
  }
  return links;
}

function parseMermaidBlocks(markdown) {
  const blocks = [];
  const mermaidPattern = /```mermaid\s*\n([\s\S]*?)```/gi;
  let match;
  while ((match = mermaidPattern.exec(markdown)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

function countLines(file) {
  return readText(file).split(/\r?\n/).length;
}

function extractLineAnchor(anchor, pathPart) {
  const lineFromAnchor = /(?:^|-)L?(\d+)(?:-L?(\d+))?$/i.exec(anchor);
  if (lineFromAnchor) {
    return {
      start: Number(lineFromAnchor[1]),
      end: Number(lineFromAnchor[2] ?? lineFromAnchor[1]),
    };
  }
  const lineFromPath = /:(\d+)(?:-(\d+))?$/.exec(pathPart);
  if (!lineFromPath) return undefined;
  return {
    start: Number(lineFromPath[1]),
    end: Number(lineFromPath[2] ?? lineFromPath[1]),
  };
}

function stripTrailingLineSuffix(value) {
  return value.replace(/:\d+(?:-\d+)?$/, "");
}

function isCommandReference(value) {
  return /^npm:[\w:.-]+$/.test(value);
}

function isBareModuleSpecifier(value) {
  if (/^(?:node:|npm:)/.test(value)) return true;
  if (value.startsWith(".") || value.startsWith("/") || value.includes("\\")) return false;
  if (SOURCE_EXTENSIONS.some((extension) => value.endsWith(extension))) return false;
  if (value.startsWith("@")) {
    return /^@[a-z0-9_.-]+\/[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)*$/i.test(value);
  }
  return /^[A-Za-z_][\w.-]*(?:\/[A-Za-z_][\w.-]*)*$/.test(value);
}

function isRelativeImportSpecifier(value) {
  return /^\.{1,2}\//.test(value);
}

function maybeCompiledJsCandidates(sourcePath) {
  const extension = path.extname(sourcePath);
  if (extension !== ".js" && extension !== ".jsx" && extension !== ".mjs" && extension !== ".cjs") {
    return [];
  }
  const withoutExtension = sourcePath.slice(0, -extension.length);
  return COMPILED_JS_SOURCE_EXTENSIONS.map((sourceExtension) => `${withoutExtension}${sourceExtension}`);
}

function resolveProjectPath(value) {
  const cleanValue = stripTrailingLineSuffix(decodeTargetPath(value));
  const directPath = path.isAbsolute(cleanValue) ? cleanValue : path.resolve(REPO_ROOT, cleanValue);
  if (existsSync(directPath)) {
    return { filePath: directPath, exists: true, resolvedFrom: value };
  }

  for (const candidate of maybeCompiledJsCandidates(directPath)) {
    if (existsSync(candidate)) {
      return { filePath: candidate, exists: true, resolvedFrom: value };
    }
  }

  return { filePath: directPath, exists: false, resolvedFrom: value };
}

function isSoftEvidenceReference(value) {
  return isCommandReference(value) || isBareModuleSpecifier(value) || isRelativeImportSpecifier(value);
}

function resolveSourceTarget(target) {
  const { pathPart, anchor } = splitTarget(target);
  const rawPath = pathPart.replace(/^file:\/\//i, "").replace(/^file=/i, "");
  const line = extractLineAnchor(anchor, rawPath);
  const resolved = resolveProjectPath(rawPath);
  return { filePath: resolved.filePath, anchor, line, exists: resolved.exists };
}

function resolveWikiLink(sourceFile, target, wikiRoot) {
  const { pathPart, anchor } = splitTarget(target);
  if (!pathPart && anchor) return undefined;
  const decodedPath = decodeTargetPath(pathPart);
  const baseDir = path.dirname(sourceFile);
  const candidates = [
    path.resolve(baseDir, decodedPath),
    path.resolve(wikiRoot, decodedPath),
    path.resolve(path.join(wikiRoot, "content"), decodedPath),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function validateLineTarget(sourceFile, targetFile, line) {
  if (!line) return;
  const totalLines = countLines(targetFile);
  if (line.start < 1 || line.end < line.start || line.end > totalLines) {
    addIssue(
      "error",
      "invalid-line-anchor",
      sourceFile,
      `行号超出文件范围：${line.start}-${line.end}，目标文件共 ${totalLines} 行。`,
      toPosix(path.relative(REPO_ROOT, targetFile)),
    );
  }
}

function firstHeading(markdown) {
  const match = /^#\s+(.+)$/m.exec(markdown);
  return match?.[1]?.trim();
}

function slugifyTitle(title) {
  return `${String(title)
    .trim()
    .toLowerCase()
    .replace(/[：:、，,\/\\?\s]+/gu, "-")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")}.md`;
}

function validateMarkdownFiles(wikiRoot, referencedWikiFiles) {
  const markdownFiles = walkFiles(wikiRoot, (file) => file.endsWith(".md"));
  report.summary.markdownFiles += markdownFiles.length;

  const headingOwners = new Map();
  for (const file of markdownFiles) {
    const markdown = readText(file);
    const heading = firstHeading(markdown);
    if (heading) {
      const owners = headingOwners.get(heading) ?? [];
      owners.push(file);
      headingOwners.set(heading, owners);
    }

    const mermaidBlocks = parseMermaidBlocks(markdown);
    report.summary.mermaidBlocks += mermaidBlocks.length;
    for (const block of mermaidBlocks) {
      if (!/^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|journey|pie|mindmap|timeline|quadrantChart|requirementDiagram|gitGraph|C4)/m.test(block)) {
        addIssue("warning", "suspicious-mermaid-block", file, "Mermaid 代码块没有以常见图类型开头。");
      }
    }

    for (const rawTarget of parseMarkdownLinks(markdown)) {
      const target = stripMarkdownTitle(rawTarget);
      if (!target || target.startsWith("#") || isExternalTarget(target)) continue;

      if (/^file:\/\//i.test(target)) {
        report.summary.fileLinks += 1;
        const { filePath, line, exists } = resolveSourceTarget(target);
        if (!exists) {
          addIssue("error", "missing-file-url-target", file, "file:// 引用的源码文件不存在。", target);
          continue;
        }
        validateLineTarget(file, filePath, line);
        continue;
      }

      if (/^file=/i.test(target)) {
        report.summary.fileLinks += 1;
        const { filePath, line, exists } = resolveSourceTarget(target);
        if (!exists) {
          addIssue("error", "missing-file-reference-target", file, "file= 引用的源码/文档文件不存在。", target);
          continue;
        }
        validateLineTarget(file, filePath, line);
        continue;
      }

      if (target.includes("://")) continue;
      const resolved = resolveWikiLink(file, target, wikiRoot);
      if (resolved.endsWith(".md")) {
        if (!existsSync(resolved)) {
          addIssue("error", "missing-markdown-link-target", file, "Markdown 链接指向的文档不存在。", target);
          continue;
        }
        if (resolved.startsWith(wikiRoot)) {
          referencedWikiFiles.add(path.resolve(resolved));
        }
      }
    }
  }

  for (const [heading, owners] of headingOwners.entries()) {
    if (owners.length > 1) {
      addIssue(
        "warning",
        "duplicate-heading",
        owners[0],
        `重复一级标题：${heading}`,
        owners.map((file) => toPosix(path.relative(REPO_ROOT, file))).join(", "),
      );
    }
  }

  return markdownFiles;
}

function validateSidebar(wikiRoot, referencedWikiFiles) {
  const sidebars = walkFiles(path.join(wikiRoot, "content"), (file) => path.basename(file) === "_sidebar.md");
  if (sidebars.length === 0) {
    addIssue("error", "missing-sidebar", wikiRoot, "RepoWiki content 目录缺少 _sidebar.md。");
    return;
  }

  for (const sidebar of sidebars) {
    for (const rawTarget of parseMarkdownLinks(readText(sidebar))) {
      const target = stripMarkdownTitle(rawTarget);
      if (!target || target.startsWith("#") || isExternalTarget(target)) continue;
      report.summary.sidebarLinks += 1;
      const resolved = resolveWikiLink(sidebar, target, wikiRoot);
      if (!existsSync(resolved)) {
        addIssue("error", "missing-sidebar-target", sidebar, "Sidebar 指向的页面不存在。", target);
        continue;
      }
      if (resolved.endsWith(".md") && resolved.startsWith(wikiRoot)) {
        referencedWikiFiles.add(path.resolve(resolved));
      }
    }
  }
}

function validateMetadata(wikiRoot, referencedWikiFiles) {
  const metadataFile = path.join(wikiRoot, "meta", "repowiki-metadata.json");
  if (!existsSync(metadataFile)) {
    addIssue("warning", "missing-metadata", wikiRoot, "未找到 repowiki-metadata.json。");
    return;
  }

  const metadata = readJson(metadataFile);
  if (!metadata) return;
  if (!metadata.schemaVersion) {
    addIssue("warning", "missing-schema-version", metadataFile, "metadata 顶层缺少 schemaVersion，后续 schema 演进会难迁移。");
  }

  const catalogs = Array.isArray(metadata.wiki_catalogs) ? metadata.wiki_catalogs : [];
  report.summary.metadataPages += catalogs.length;
  const contentRoot = path.join(wikiRoot, "content");
  for (const item of catalogs) {
    if (!item || typeof item !== "object") continue;
    if (typeof item.path === "string" && item.path.trim()) {
      const pagePath = path.resolve(contentRoot, item.path);
      if (!existsSync(pagePath)) {
        addIssue("error", "missing-catalog-page", metadataFile, "metadata catalog 指向的页面不存在。", item.path);
      } else {
        referencedWikiFiles.add(pagePath);
      }
    } else {
      addIssue("warning", "catalog-missing-path", metadataFile, "catalog 节点缺少 path。", item.id ?? item.title);
    }

    const dependentFiles = Array.isArray(item.dependent_files) ? item.dependent_files : [];
    if (dependentFiles.length === 0) {
      addIssue("warning", "catalog-missing-evidence", metadataFile, "catalog 节点缺少 dependent_files 证据文件。", item.path ?? item.id);
    }
    for (const dependentFile of dependentFiles) {
      if (typeof dependentFile !== "string" || !dependentFile.trim()) continue;
      const resolved = resolveProjectPath(dependentFile);
      if (!resolved.exists && isSoftEvidenceReference(dependentFile)) {
        report.summary.softReferences += 1;
        addIssue(
          "warning",
          "soft-evidence-reference",
          metadataFile,
          "dependent_files 里出现模块名、命令或相对 import，先按软引用记录；后续应由生成器拆成 sourceFiles/imports/scripts。",
          dependentFile,
        );
        continue;
      }
      if (!resolved.exists) {
        addIssue("error", "missing-evidence-file", metadataFile, "dependent_files 指向的源码/文档不存在。", dependentFile);
      }
    }
  }
}

function validateAgentCards(wikiRoot, referencedWikiFiles) {
  const cardsRoot = path.join(wikiRoot, "agent-cards");
  if (!existsSync(cardsRoot)) return;
  const indexFile = path.join(cardsRoot, "_index.json");
  if (!existsSync(indexFile)) {
    addIssue("warning", "missing-agent-card-index", cardsRoot, "agent-cards 缺少 _index.json。");
    return;
  }

  const index = readJson(indexFile);
  if (!index) return;
  const cards = Array.isArray(index.cards) ? index.cards : [];
  report.summary.agentCards += cards.length;
  const cardMarkdownFiles = new Set(walkFiles(cardsRoot, (file) => file.endsWith(".md")).map((file) => path.resolve(file)));

  for (const card of cards) {
    if (!card || typeof card !== "object") continue;
    const explicitPath = card.path ?? card.file ?? card.markdownPath ?? card.docPath;
    let cardFile;
    if (typeof explicitPath === "string" && explicitPath.trim()) {
      cardFile = path.resolve(cardsRoot, explicitPath);
    } else if (typeof card.title === "string") {
      cardFile = path.resolve(cardsRoot, slugifyTitle(card.title));
      if (!existsSync(cardFile)) {
        addIssue("warning", "agent-card-missing-doc-path", indexFile, "Agent Card 没有显式 docPath，且无法通过 title 匹配 Markdown 文件。", card.title);
        cardFile = undefined;
      }
    }
    if (cardFile) {
      if (!existsSync(cardFile)) {
        addIssue("error", "missing-agent-card-doc", indexFile, "Agent Card 指向的 Markdown 文件不存在。", explicitPath ?? card.title);
      } else {
        referencedWikiFiles.add(cardFile);
      }
    }

    const entryFiles = Array.isArray(card.entryFiles) ? card.entryFiles : [];
    for (const entry of entryFiles) {
      const entryPath = typeof entry === "string" ? entry : entry?.path;
      if (typeof entryPath !== "string" || !entryPath.trim()) continue;
      if (isCommandReference(entryPath)) continue;
      const resolved = resolveProjectPath(entryPath);
      if (!resolved.exists) {
        addIssue("error", "missing-agent-card-entry-file", indexFile, "Agent Card entryFiles 指向的文件不存在。", entryPath);
      }
    }

    const relatedFiles = Array.isArray(card.relatedFiles) ? card.relatedFiles : [];
    for (const relatedFile of relatedFiles) {
      if (typeof relatedFile !== "string" || !relatedFile.trim()) continue;
      if (isCommandReference(relatedFile) || isBareModuleSpecifier(relatedFile)) {
        report.summary.softReferences += 1;
        continue;
      }
      const resolved = resolveProjectPath(relatedFile);
      if (!resolved.exists) {
        addIssue("error", "missing-agent-card-related-file", indexFile, "Agent Card relatedFiles 指向的文件不存在。", relatedFile);
      }
    }
  }

  for (const file of cardMarkdownFiles) {
    if (!referencedWikiFiles.has(file)) {
      addIssue("warning", "orphan-agent-card", file, "Agent Card Markdown 没有被 _index.json 显式或 title 推导引用。");
    }
  }
}

function validateOrphans(wikiRoot, markdownFiles, referencedWikiFiles) {
  for (const file of markdownFiles) {
    const relativePath = toPosix(path.relative(wikiRoot, file));
    if (relativePath.endsWith("/_sidebar.md") || relativePath === "content/_sidebar.md") continue;
    if (relativePath.startsWith("agent-cards/")) continue;
    if (!referencedWikiFiles.has(path.resolve(file))) {
      report.summary.orphanMarkdownFiles += 1;
      addIssue("warning", "orphan-content-page", file, "Markdown 页面没有被 sidebar 或 metadata catalog 引用。");
    }
  }
}

if (!existsSync(repowikiRoot)) {
  addIssue("error", "missing-repowiki-root", repowikiRoot, "RepoWiki 根目录不存在。");
} else {
  const wikiRoots = detectWikiRoots(repowikiRoot);
  report.summary.wikiRoots = wikiRoots.length;
  if (wikiRoots.length === 0) {
    addIssue("error", "missing-wiki-root", repowikiRoot, "没有发现 content 或 agent-cards 目录。");
  }

  for (const wikiRoot of wikiRoots) {
    const referencedWikiFiles = new Set();
    validateSidebar(wikiRoot, referencedWikiFiles);
    validateMetadata(wikiRoot, referencedWikiFiles);
    validateAgentCards(wikiRoot, referencedWikiFiles);
    const markdownFiles = validateMarkdownFiles(wikiRoot, referencedWikiFiles);
    validateOrphans(wikiRoot, markdownFiles, referencedWikiFiles);
  }
}

if (writeReport) {
  const reportPath = path.join(repowikiRoot, ".validation-report.json");
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function formatIssue(issue) {
  const location = issue.file ? `${issue.file}` : "(unknown)";
  const target = issue.target ? ` -> ${issue.target}` : "";
  return `- [${issue.type}] ${location}${target}\n  ${issue.message}`;
}

function printHumanReport() {
  const status = report.ok ? "PASS" : "FAIL";
  console.log(`RepoWiki link smoke: ${status}`);
  console.log(`root: ${report.root}`);
  console.log(
    [
      `wikiRoots=${report.summary.wikiRoots}`,
      `markdown=${report.summary.markdownFiles}`,
      `sidebarLinks=${report.summary.sidebarLinks}`,
      `catalogPages=${report.summary.metadataPages}`,
      `agentCards=${report.summary.agentCards}`,
      `fileRefs=${report.summary.fileLinks}`,
      `mermaid=${report.summary.mermaidBlocks}`,
      `orphans=${report.summary.orphanMarkdownFiles}`,
      `softRefs=${report.summary.softReferences}`,
    ].join(" "),
  );

  if (report.errors.length > 0) {
    console.log(`\nErrors (${report.errors.length}):`);
    console.log(report.errors.map(formatIssue).join("\n"));
  }

  if (report.warnings.length > 0) {
    const preview = report.warnings.slice(0, 10);
    console.log(`\nWarnings (${report.warnings.length}, showing ${preview.length}):`);
    console.log(preview.map(formatIssue).join("\n"));
    if (report.warnings.length > preview.length) {
      console.log(`... ${report.warnings.length - preview.length} more warnings. Use --json or --write-report for the full report.`);
    }
  }
}

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printHumanReport();
}

if (!report.ok) {
  process.exit(1);
}
