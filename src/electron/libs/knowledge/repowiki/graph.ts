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
    if (dependencies.size === 0) return "";

    const lines = ["graph TD"];
    const seen = new Set<string>();
    for (const [source, targets] of Array.from(dependencies.entries()).sort()) {
      for (const target of Array.from(targets).sort()) {
        const key = `${source}->${target}`;
        if (seen.has(key)) continue;
        seen.add(key);
        lines.push(`  ${mermaidId(source)}[${source}] --> ${mermaidId(target)}[${target}]`);
      }
    }
    return lines.join("\n");
  }

  private resolveImport(importPath: string, sourceFile: string, language: string): string | undefined {
    let candidates: string[];

    if (language === "python" || language === "pyi") {
      const rel = importPath.replace(/\./g, "/");
      candidates = [
        `${rel}.py`,
        `${rel}/__init__.py`,
        `src/${rel}.py`,
        `src/${rel}/__init__.py`,
      ];
    } else if (["javascript", "typescript", "jsx", "tsx", "mjs", "cjs"].includes(language)) {
      const rel = importPath.startsWith(".")
        ? normalize(join(dirname(sourceFile), importPath)).replace(/\\/g, "/")
        : importPath;
      candidates = [
        rel,
        `${rel}.ts`,
        `${rel}.tsx`,
        `${rel}.js`,
        `${rel}.jsx`,
        `${rel}/index.ts`,
        `${rel}/index.tsx`,
        `${rel}/index.js`,
      ];
    } else if (language === "go") {
      const parts = importPath.split("/");
      candidates = parts.length >= 2 ? [`${parts.slice(-2).join("/")}.go`] : [];
    } else if (language === "rust") {
      const rel = importPath.split("::")[0]?.replace(/::/g, "/") ?? "";
      candidates = [`src/${rel}.rs`, `src/${rel}/mod.rs`, `${rel}.rs`];
    } else if (language === "java") {
      const rel = importPath.replace(/\./g, "/");
      candidates = [`src/main/java/${rel}.java`, `${rel}.java`];
    } else {
      candidates = [];
    }

    return candidates.map((candidate) => normalize(candidate).replace(/\\/g, "/")).find((candidate) => this.knownPaths.has(candidate));
  }
}

export function getModuleName(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 1) return "root";
  const first = parts[0] ?? "root";
  if (["src", "lib", "pkg", "internal", "app"].includes(first) && parts.length > 2) {
    return parts[1] ?? first;
  }
  return first;
}

function mermaidId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}
