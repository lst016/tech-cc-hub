import { spawn } from "child_process";
import { delimiter } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";
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

async function runVendoredRepoWiki(paths: KnowledgeWorkspacePaths, wiki: WikiModelSettings): Promise<RepoWikiRunnerResult> {
  const repoRoot = findRepoRoot();
  const scriptPath = join(repoRoot, "scripts", "knowledge", "run-repowiki.py");
  const repowikiSrc = join(repoRoot, "third_party", "repowiki", "src");
  const cachePath = join(paths.appDataWorkspaceRoot, "repowiki-cache.sqlite");
  const maxFileSize = Math.max(64 * 1024, Math.min(400 * 1024, Math.floor((wiki.maxInputTokens || 32_000) * 8)));
  const args = [
    scriptPath,
    "--workspace", paths.workspaceRoot,
    "--output", paths.repowikiContentDir,
    "--cache", cachePath,
    "--model", wiki.model,
    "--api-key", wiki.apiKey,
    "--api-base", wiki.baseURL,
    "--language", "zh",
    "--concurrency", wiki.costTier === "free" ? "1" : "3",
    "--max-files", process.env.REPOWIKI_MAX_FILES || "0",
    "--max-file-size", String(maxFileSize),
    "--file-page-limit", process.env.REPOWIKI_FILE_PAGE_LIMIT || process.env.TECH_CC_HUB_REPOWIKI_FILE_PAGE_LIMIT || "0",
  ];

  return await new Promise((resolvePromise, reject) => {
    const child = spawn(pythonExecutable(), args, {
      cwd: repoRoot,
      env: {
        ...process.env,
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
      if (text) console.log(`[repowiki] ${text}`);
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

export async function generateRepoWiki(paths: KnowledgeWorkspacePaths, wiki: WikiModelSettings): Promise<RepoWikiGenerationResult> {
  mkdirSync(paths.repowikiMetaDir, { recursive: true });
  mkdirSync(paths.appDataWorkspaceRoot, { recursive: true });

  const result = await runVendoredRepoWiki(paths, wiki);
  const generatedFiles = Array.isArray(result.generatedFiles) ? result.generatedFiles : [];
  const pageCount = Number(result.pageCount || generatedFiles.filter((file) => file.endsWith(".md") && !file.endsWith("_sidebar.md")).length);
  const scannedFiles = Number(result.scannedFiles || 0);
  const totalLines = Number(result.totalLines || 0);

  writeFileSync(paths.repowikiMetadataPath, `${JSON.stringify({
    version: 3,
    engine: "he-yufeng/RepoWiki-vendored-python",
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
    pages: generatedFiles
      .filter((file) => file.endsWith(".md") && !file.endsWith("_sidebar.md"))
      .map((file, index) => ({
        id: file.replace(/^\.tech\/repowiki\/zh\/content\//, "").replace(/\.md$/, ""),
        title: file.split(/[\\/]/).at(-1)?.replace(/\.md$/, "") || file,
        parentId: "",
        order: index,
        path: join(paths.workspaceRoot, file),
      })),
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
