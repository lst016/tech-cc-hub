import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { WikiModelSettings } from "../knowledge-types.js";
import type { KnowledgeWorkspacePaths } from "../knowledge-paths.js";
import { RepoWikiAnalyzer } from "./analyzer.js";
import { RepoWikiBuilder } from "./builder.js";
import { exportRepoWikiMarkdown } from "./exporter.js";
import { RepoWikiDependencyGraph } from "./graph.js";
import { buildRepoWikiIntelligence } from "./intelligence.js";
import { scanRepoWikiProject } from "./scanner.js";
import type { RepoWikiSkippedFile } from "./types.js";

export type RepoWikiGenerationResult = {
  generatedFiles: string[];
  skipped: RepoWikiSkippedFile[];
  pageCount: number;
  scannedFiles: number;
  totalLines: number;
};

export async function generateRepoWiki(paths: KnowledgeWorkspacePaths, wiki: WikiModelSettings): Promise<RepoWikiGenerationResult> {
  const scan = scanRepoWikiProject(paths.workspaceRoot, {
    maxFileSize: Math.max(64 * 1024, Math.min(300 * 1024, Math.floor((wiki.maxInputTokens || 32_000) * 8))),
    maxFiles: 1_200,
    previewLines: 80,
  });

  const graph = RepoWikiDependencyGraph.buildFromProject(scan.project);
  const project = {
    ...scan.project,
    intelligence: buildRepoWikiIntelligence(scan.project, graph),
  };
  const analyzer = new RepoWikiAnalyzer(wiki, {
    language: "zh",
    concurrency: wiki.costTier === "free" ? 1 : 2,
    onProgress: (message) => console.log(`[repowiki] ${message}`),
  });
  const wikiData = await analyzer.analyze(project, graph);
  const builder = new RepoWikiBuilder();
  const repoWiki = builder.build(project, wikiData, graph);
  const generatedFiles = exportRepoWikiMarkdown(repoWiki, paths.repowikiContentDir, paths.workspaceRoot);

  mkdirSync(paths.repowikiMetaDir, { recursive: true });
  writeFileSync(paths.repowikiMetadataPath, `${JSON.stringify({
    version: 2,
    engine: "he-yufeng/RepoWiki-compatible",
    upstream: {
      repository: "https://github.com/he-yufeng/RepoWiki",
      license: "MIT",
      vendoredPath: "third_party/repowiki",
    },
    generatedAt: Date.now(),
    workspaceScope: paths.workspaceScope,
    projectName: repoWiki.projectName,
    wikiModel: wiki.model,
    costTier: wiki.costTier,
    scannedFiles: scan.project.files.length,
    totalLines: scan.project.totalLines,
    intelligence: {
      scripts: project.intelligence.scripts,
      highValueFiles: project.intelligence.highValueFiles.slice(0, 30),
      runtimeFlows: project.intelligence.runtimeFlows,
      ipcChannels: project.intelligence.ipcChannels.length,
      uiIpcCalls: project.intelligence.uiIpcCalls.length,
      mcpTools: project.intelligence.mcpTools.length,
      databaseTables: project.intelligence.databaseTables.length,
    },
    pages: repoWiki.pages.map((page) => ({
      id: page.id,
      title: page.title,
      parentId: page.parentId ?? "",
      order: page.order,
      path: join(paths.repowikiContentDir, `${page.id}.md`),
    })),
    sidebar: repoWiki.sidebar,
    files: generatedFiles,
  }, null, 2)}\n`, "utf8");

  return {
    generatedFiles,
    skipped: scan.skipped,
    pageCount: repoWiki.pages.length,
    scannedFiles: scan.project.files.length,
    totalLines: scan.project.totalLines,
  };
}
