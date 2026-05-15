import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, join, relative } from "path";
import type { RepoWiki, SidebarItem } from "./types.js";

export function exportRepoWikiMarkdown(wiki: RepoWiki, outputDir: string, workspaceRoot: string): string[] {
  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true });
  }
  mkdirSync(outputDir, { recursive: true });

  const generated: string[] = [];
  for (const page of wiki.pages) {
    const pagePath = join(outputDir, `${page.id}.md`);
    mkdirSync(dirname(pagePath), { recursive: true });
    writeFileSync(pagePath, `${page.content.trim()}\n`, "utf8");
    generated.push(relative(workspaceRoot, pagePath));
  }

  const sidebarPath = join(outputDir, "_sidebar.md");
  writeFileSync(sidebarPath, buildSidebarMarkdown(wiki), "utf8");
  generated.push(relative(workspaceRoot, sidebarPath));
  return generated;
}

function buildSidebarMarkdown(wiki: RepoWiki): string {
  const lines = [`# ${wiki.projectName}`, ""];
  for (const item of wiki.sidebar) {
    writeSidebarItem(lines, item, 0);
  }
  return `${lines.join("\n")}\n`;
}

function writeSidebarItem(lines: string[], item: SidebarItem, depth: number): void {
  const indent = "  ".repeat(depth);
  if (item.pageId) {
    lines.push(`${indent}- [${item.title}](${item.pageId}.md)`);
  } else {
    lines.push(`${indent}- **${item.title}**`);
  }
  for (const child of item.children) {
    writeSidebarItem(lines, child, depth + 1);
  }
}
