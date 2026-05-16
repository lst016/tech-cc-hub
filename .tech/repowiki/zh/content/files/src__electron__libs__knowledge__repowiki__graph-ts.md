# src/electron/libs/knowledge/repowiki/graph.ts

> 模块：`knowledge-engine` · 语言：`typescript` · 行数：218

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `getModuleName@184`
- `mermaidId@214`
- `RepoWikiDependencyGraph@32`
- `graph@39`
- `content@47`
- `patterns@49`
- `importPath@53`
- `resolved@55`
- `nodeIds@67`
- `damping@69`
- `baseScore@71`
- `scores@72`
- `next@75`
- `outgoing@77`
- `share@78`
- `incoming@100`
- `dependencies@112`
- `sourceModule@115`
- `targetModule@116`
- `list@118`
- `dependencies@127`
- `lines@129`
- `seen@131`
- `key@134`
- `rel@147`
- `rel@155`
- `parts@169`
- `rel@172`
- `rel@175`
- `parts@205`
- `first@208`

## 依赖输入

- `path`
- `./types.js`

## 对外暴露

- `RepoWikiDependencyGraph`
- `getModuleName`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { dirname, join, normalize } from "path";
import type { RepoWikiProjectContext } from "./types.js";

const IMPORT_PATTERNS: Record<string, RegExp[]> = {
  python: [
    /^\s*import\s+([\w.]+)/gm,
    /^\s*from\s+([\w.]+)\s+import/gm,
  ],
  javascript: [
    /import\s+.*?\s+from\s+['"]([^'"]+)['"]/gm,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
  ],
  typescript: [
    /import\s+.*?\s+from\s+['"]([^'"]+)['"]/gm,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
  ],
  go: [
    /"([^"]+)"/gm,
  ],
  rust: [
    /^\s*use\s+([\w:]+)/gm,
    /^\s*mod\s+(\w+)/gm,
  ],
  java: [
    /^\s*import\s+([\w.]+);/gm,
  ],
};

for (const alias of ["jsx", "tsx", "mjs", "cjs"]) {
  IMPORT_PATTERNS[alias] = IMPORT_PATTERNS.javascript;
}

export class RepoWikiDependencyGraph {
  private readonly nodes = new Map<string, { language: string; lines: number }>();
  private readonly edges = new Map<string, Set<string>>();
  private readonly knownPaths = new Set<string>();

  static buildFromProject(project: RepoWikiProjectContext): RepoWikiDependencyGraph {
    const graph = new RepoWikiDependencyGraph();
    for (const file of project.files) {
      graph.knownPaths.add(file.path);
      graph.nodes.set(file.path, { language: file.language, lines: file.lines });
      graph.edges.set(file.path, new Set());
    }

    for (const file of project.files) {
      const content = file.content || file.preview;
      if (!content) continue;
      const patterns = IMPORT_PATTERNS[file.language] ?? [];
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        for (const match of content.matchAll(pattern)) {
          const importPath = match[1];
          if (!importPath) continue;
          const resolved = graph.resolveImport(importPath, file.path, file.language);
          if (resolved && resolved !== file.path) {
            graph.edges.get(file.path)?.add(resolved);
          }
        }
      }
    }

    return graph;
  }

  rankFiles(): Array<[string, number]> {
    const nodeIds = Array.from(this.nodes.keys());
    if (nodeIds.length === 0) return [];

    const damping = 0.85;
    const baseScore = (1 - damping) / nodeIds.length;
    let scores = new Map(nodeIds.map((node) => [node, 1 / nodeIds.length]));

    for (let iteration = 0; iteration < 30; iteration += 1) {
      const next = new Map(nodeIds.map((node) => [node, baseScore]));
      for (const node of nodeIds) {
        const outgoing = Array.from(this.edges.get(node) ?? []);
        const share = (scores.get(node) ?? 0) / Math.max(1, outgoing.length || nodeIds.length);
        if (outgoing.length === 0) {
          for (const target of nodeIds) {
            next.set(target, (next.get(target) ?? 0) + damping * share);
          }
          continue;
        }
        for (const target of outgoing) {
          next.set(target, (next.get(target) ?? 0) + damping * share);
        }
      }
      scores = next;
    }

    return Array.from(scores.entries()).sort((left, right) => right[1] - left[1]);
  }

  getCoreFiles(topN = 10): string[] {
    return this.rankFiles().slice(0, topN).map(([path]) => path);
  }

  getEntryPoints(): string[] {
    const incoming = new Map(Array.from(this.nodes.keys()).map((node) => [node, 0]));
    for (const targets of this.edges.values()) {
      for (const target of targets) {
        incoming.set(target, (incoming.get(target) ?? 0) + 1);
      }
    }
    return Array.from(incoming.entries())
      .filter(([, count]) => count <= 1)
      .map(([path]) => path);
  }

  getModuleDependencies(): Map<string, Set<string>> {
    const dependencies = new Map<string, Set<string>>();
    for (const [source, targets] of this.edges.entries()) {
      for (const target of targets) {
        const sourceModule = getModuleName(source);
        const targetModule = getModuleName(target);
        if (sourceModule === targetModule) continue;
        const list = dependencies.get(sourceModule) ?? new Set<string>();
        list.add(targetModule);
        dependencies.set(sourceModule, list);
      }
    }
    return dependencies;
  }

  toMermaid(): string {
    const dependencies = this.getModuleDependencies();
    if (dependencies.size === 0)
... (truncated)
```
