import { spawn } from "child_process";
import { delimiter } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import type { WikiModelSettings } from "../knowledge-types.js";
import type { KnowledgeWorkspacePaths } from "../knowledge-paths.js";
import type { RepoWikiSkippedFile } from "./types.js";

export type RepoWikiGenerationResult = {
  generatedFiles: string[];
  skipped: RepoWikiSkippedFile[];
  pageCount: number;
  scannedFiles: number;
  totalLines: number;
};

export type RepoWikiProgressEvent = {
  stage: "modules" | "architecture" | "reading-guide" | "done" | "embedding" | "indexing" | "message";
  message: string;
  completed?: number;
  total?: number;
};

type RepoWikiRunnerResult = {
  success?: boolean;
  engine?: string;
  projectName?: string;
  scannedFiles?: number;
  totalLines?: number;
  pageCount?: number;
  generatedFiles?: string[];
  tokens?: {
    input?: number;
    output?: number;
    cost?: number;
  };
  error?: string;
};

function findRepoRoot(): string {
  const candidates = [process.cwd(), resolve(process.cwd(), ".."), resolve(process.cwd(), "../..")];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, "third_party", "repowiki", "src", "repowiki"))) {
      return candidate;
    }
  }
  throw new Error("找不到 vendored RepoWiki：third_party/repowiki。");
}

function pythonExecutable(): string {
  return process.env.TECH_CC_HUB_PYTHON || process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
}

function resolveRepoWikiConcurrency(wiki: WikiModelSettings): string {
  const configured = Number(process.env.TECH_CC_HUB_REPOWIKI_CONCURRENCY || process.env.REPOWIKI_CONCURRENCY || 0);
  if (Number.isFinite(configured) && configured > 0) {
    return String(Math.max(1, Math.min(12, Math.floor(configured))));
  }
  return wiki.costTier === "free" ? "2" : "6";
}

function parseRunnerJson(stdout: string): RepoWikiRunnerResult {
  const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines.reverse()) {
    try {
      return JSON.parse(line) as RepoWikiRunnerResult;
    } catch {
      // Some Python tooling writes non-JSON informational lines. Keep looking.
    }
  }
  throw new Error(`RepoWiki runner 没有返回 JSON：${stdout.slice(0, 400)}`);
}

function readJsonObject(path: string): Record<string, unknown> {
  if (!existsSync(path)) {
    return {};
  }
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseRepoWikiProgress(text: string): RepoWikiProgressEvent[] {
  const events: RepoWikiProgressEvent[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let message = trimmed;
    try {
      const parsed = JSON.parse(trimmed) as { event?: unknown; message?: unknown };
      if (parsed.event !== "progress" || typeof parsed.message !== "string") {
        continue;
      }
      message = parsed.message;
    } catch {
      continue;
    }

    const analyzing = message.match(/^Analyzing\s+(\d+)\s+modules/i);
    if (analyzing) {
      const total = Number(analyzing[1]);
      events.push({ stage: "modules", message, completed: 0, total });
      continue;
    }

    const analyzed = message.match(/^Analyzed module\s+(\d+)\/(\d+)/i);
    if (analyzed) {
      events.push({
        stage: "modules",
        message,
        completed: Number(analyzed[1]),
        total: Number(analyzed[2]),
      });
      continue;
    }

    if (/Detecting architecture/i.test(message)) {
      events.push({ stage: "architecture", message });
      continue;
    }

    if (/Creating reading guide/i.test(message)) {
      events.push({ stage: "reading-guide", message });
      continue;
    }

    if (/Done/i.test(message)) {
      events.push({ stage: "done", message });
      continue;
    }

    events.push({ stage: "message", message });
  }
  return events;
}

async function runVendoredRepoWiki(
  paths: KnowledgeWorkspacePaths,
  wiki: WikiModelSettings,
  onProgress?: (event: RepoWikiProgressEvent) => void,
): Promise<RepoWikiRunnerResult> {
  const repoRoot = findRepoRoot();
  const scriptPath = join(repoRoot, "scripts", "knowledge", "run-repowiki.py");
  const repowikiSrc = join(repoRoot, "third_party", "repowiki", "src");
  const cachePath = join(paths.appDataWorkspaceRoot, "repowiki-cache.sqlite");
  const maxFileSize = Math.max(64 * 1024, Math.min(400 * 1024, Math.floor((wiki.maxInputTokens || 32_000) * 8)));
  const args = [
    scriptPath,
    "--workspace", paths.workspaceRoot,
    "--output", paths.repowikiRoot,
    "--cache", cachePath,
    "--model", wiki.model,
    "--api-base", wiki.baseURL,
    "--language", "zh",
    "--concurrency", resolveRepoWikiConcurrency(wiki),
    "--max-files", process.env.REPOWIKI_MAX_FILES || "0",
    "--max-file-size", String(maxFileSize),
    "--file-page-limit", process.env.REPOWIKI_FILE_PAGE_LIMIT || process.env.TECH_CC_HUB_REPOWIKI_FILE_PAGE_LIMIT || "0",
  ];

  return await new Promise((resolvePromise, reject) => {
    const child = spawn(pythonExecutable(), args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        TECH_WIKI_MODEL: wiki.model,
        TECH_WIKI_API_KEY: wiki.apiKey,
        TECH_WIKI_API_BASE: wiki.baseURL,
        PYTHONPATH: `${repowikiSrc}${process.env.PYTHONPATH ? `${delimiter}${process.env.PYTHONPATH}` : ""}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => {
      stderr.push(chunk);
      const text = chunk.toString("utf8").trim();
      if (text) {
        console.log(`[repowiki] ${text}`);
        for (const event of parseRepoWikiProgress(text)) {
          onProgress?.(event);
        }
      }
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const stdoutText = Buffer.concat(stdout).toString("utf8");
      const stderrText = Buffer.concat(stderr).toString("utf8");
      let result: RepoWikiRunnerResult;
      try {
        result = parseRunnerJson(stdoutText);
      } catch (error) {
        reject(error);
        return;
      }
      if (code !== 0 || result.success === false) {
        reject(new Error(result.error || stderrText || `RepoWiki runner exited with code ${code}`));
        return;
      }
      resolvePromise(result);
    });
  });
}

export async function generateRepoWiki(
  paths: KnowledgeWorkspacePaths,
  wiki: WikiModelSettings,
  onProgress?: (event: RepoWikiProgressEvent) => void,
): Promise<RepoWikiGenerationResult> {
  mkdirSync(paths.repowikiMetaDir, { recursive: true });
  mkdirSync(paths.appDataWorkspaceRoot, { recursive: true });

  const result = await runVendoredRepoWiki(paths, wiki, onProgress);
  const generatedFiles = Array.isArray(result.generatedFiles) ? result.generatedFiles : [];
  const pageCount = Number(result.pageCount || generatedFiles.filter((file) => file.endsWith(".md") && !file.endsWith("_sidebar.md")).length);
  const scannedFiles = Number(result.scannedFiles || 0);
  const totalLines = Number(result.totalLines || 0);
  const runnerMetadata = readJsonObject(paths.repowikiMetadataPath);
  const wikiCatalogs = Array.isArray(runnerMetadata.wiki_catalogs) ? runnerMetadata.wiki_catalogs as Array<Record<string, unknown>> : [];
  const metadataPages = wikiCatalogs.length > 0
    ? wikiCatalogs.map((catalog, index) => ({
        id: String(catalog.id ?? catalog.slug ?? catalog.name ?? index),
        title: String(catalog.title ?? catalog.name ?? catalog.id ?? `文档 ${index + 1}`),
        parentId: String(catalog.parent_id ?? ""),
        order: Number(catalog.order ?? index),
        path: join(paths.repowikiContentDir, String(catalog.path ?? "")),
      }))
    : generatedFiles
        .filter((file) => file.endsWith(".md") && !file.endsWith("_sidebar.md"))
        .map((file, index) => ({
          id: file.replace(/^\.tech\/repowiki\/zh\/content\//, "").replace(/\.md$/, ""),
          title: file.split(/[\\/]/).at(-1)?.replace(/\.md$/, "") || file,
          parentId: "",
          order: index,
          path: join(paths.workspaceRoot, file),
        }));

  writeFileSync(paths.repowikiMetadataPath, `${JSON.stringify({
    ...runnerMetadata,
    version: 3,
    engine: result.engine || "tech-cc-hub/qoder-style-repowiki",
    upstream: {
      repository: "https://github.com/he-yufeng/RepoWiki",
      license: "MIT",
      vendoredPath: "third_party/repowiki",
      adapter: "scripts/knowledge/run-repowiki.py",
    },
    generatedAt: Date.now(),
    workspaceScope: paths.workspaceScope,
    projectName: result.projectName || paths.workspaceSlug,
    wikiModel: wiki.model,
    costTier: wiki.costTier,
    scannedFiles,
    totalLines,
    pageCount,
    tokens: result.tokens ?? {},
    pages: metadataPages,
    files: generatedFiles,
  }, null, 2)}\n`, "utf8");

  return {
    generatedFiles,
    skipped: [],
    pageCount,
    scannedFiles,
    totalLines,
  };
}
