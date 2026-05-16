# src/electron/libs/knowledge/repowiki/prompts.ts

> 模块：`knowledge-engine` · 语言：`typescript` · 行数：235

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `buildOverviewPrompt@5`
- `buildModulePrompt@54`
- `buildArchitecturePrompt@107`
- `buildReadingGuidePrompt@152`
- `extractJson@191`
- `languageInstruction@217`
- `jsonInstruction@227`
- `escapeJsonString@231`
- `stripped@193`
- `start@206`
- `end@207`
- `ChatMessage@1`

## 对外暴露

- `ChatMessage`
- `buildOverviewPrompt`
- `buildModulePrompt`
- `buildArchitecturePrompt`
- `buildReadingGuidePrompt`
- `extractJson`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function buildOverviewPrompt(fileTree: string, keyFiles: string, codeIntelligence: string, language = "zh"): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are generating Repo Wiki documentation for coding agents, not a marketing README.",
        "The output must help an agent decide which files to read, which runtime paths matter, and how to validate changes.",
        "Every important claim should be grounded in concrete file paths from the provided evidence.",
        "Avoid generic project descriptions, filler phrases, and guesses.",
        languageInstruction(language),
      ].join(" "),
    },
    {
      role: "user",
      content: [
        "Here is the file tree and key files of a project:",
        "",
        "## File Tree",
        "```",
        fileTree,
        "```",
        "",
        "## Key Files",
        keyFiles,
        "",
        codeIntelligence,
        "",
        "Generate a project overview as JSON with this structure:",
        "{",
        '  "name": "project name",',
        '  "one_liner": "what this project does in one sentence (max 20 words)",',
        '  "description": "3-5 concrete paragraphs explaining what the app does and where the implementation lives",',
        '  "tech_stack": [{"name": "TypeScript", "category": "language", "version": ""}],',
        '  "setup_instructions": ["exact command or setup step"],',
        '  "key_features": ["feature with implementation hint"],',
        '  "agent_summary": ["what an agent must remember before editing this repo"],',
        '  "key_workflows": [{"name": "workflow name", "summary": "step-by-step runtime summary", "files": ["file.ts"]}],',
        '  "runtime_surfaces": ["UI, Electron, MCP, DB, or dev bridge surface and where it is implemented"],',
        '  "storage_and_indexes": ["persistent store/table/index and owning file"],',
        '  "quality_gates": ["test or command that proves a behavior"],',
        '  "change_risks": ["concrete risk and file area"]',
        "}",
        "",
        jsonInstruction(),
      ].join("\n"),
    },
  ];
}

export function buildModulePrompt(
  moduleName: string,
  filesContext: string,
  moduleEvidence: string,
  projectSummary: string,
  language = "zh",
): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are documenting one module for coding agents who will modify this repository.",
        "Prioritize operational facts: entrypoints, contracts, state, database tables, IPC/MCP tools, call relationships, and validation commands.",
        "Explain why files matter and what can break when they change.",
        "Ground details in file paths and symbol names from the evidence. Do not invent APIs.",
        languageInstruction(language),
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Project: ${projectSummary}`,
        "",
        `Document the '${moduleName}' module. Here are its files:`,
        "",
        filesContext,
        "",
        moduleEvidence,
        "",
        "Output JSON:",
        "{",
        `  "name": "${escapeJsonString(moduleName)}",`,
        '  "purpose": "one sentence describing the module role",',
        '  "description": "detailed explanation with concrete runtime behavior and file paths",',
        '  "files": [',
        '    {"path": "file.ts", "purpose": "what it does and why an agent would read it", "key_symbols": [{"name": "func_name", "kind": "function", "line": 10, "description": "..."}]}',
        "  ],",
        '  "relationships": [{"source": "a.ts", "target": "b.ts", "description": "a imports b for..."}],',
        '  "key_concepts": [{"name": "concept", "explanation": "..."}],',
        '  "agent_value": ["specific knowledge this page gives a future agent"],',
        '  "entrypoints": [{"path": "file.ts", "reason": "why this is the first read"}],',
        '  "data_contracts": [{"name": "IPC channel/table/type/tool", "explanation": "contract and owner file"}],',
        '  "operational_notes": ["runtime behavior, reload behavior, or config so
... (truncated)
```
