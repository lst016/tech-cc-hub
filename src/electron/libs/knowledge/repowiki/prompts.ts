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
        '  "operational_notes": ["runtime behavior, reload behavior, or config source"],',
        '  "change_risks": ["what breaks if this area changes"],',
        '  "validation": ["specific command or UI check"]',
        "}",
        "",
        jsonInstruction(),
      ].join("\n"),
    },
  ];
}

export function buildArchitecturePrompt(fileTree: string, keyFiles: string, codeIntelligence: string, language = "zh"): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a software architect analyzing a codebase.",
        "Document architecture for agents that need to safely edit the app.",
        "Focus on process boundaries, runtime data flow, persistence, IPC/MCP contracts, and validation surfaces.",
        "Mermaid syntax must be valid. Use simple node names without special characters.",
        languageInstruction(language),
      ].join(" "),
    },
    {
      role: "user",
      content: [
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
        "Analyze the architecture. Output JSON:",
        "{",
        '  "architecture_type": "one of: monolith, client-server, microservices, library, cli-tool, framework, plugin-system, pipeline",',
        '  "description": "explain the architecture in concrete terms with file paths",',
        '  "components": [{"name": "...", "purpose": "...", "files": ["..."]}],',
        '  "mermaid_component": "graph TD\\n  A[Component] --> B[Component]\\n  ...",',
        '  "mermaid_sequence": "sequenceDiagram\\n  participant A\\n  A->>B: request\\n  ...",',
        '  "data_flow": "describe the main data flow with persistence and event boundaries",',
        '  "layers": [{"name": "layer", "purpose": "responsibility", "files": ["..."]}],',
        '  "boundaries": ["boundary rule and file evidence"],',
        '  "integration_points": ["external or internal integration point and owner file"]',
        "}",
        "",
        "IMPORTANT: Mermaid code must be a single string with \\n for newlines. Use simple alphanumeric node IDs.",
        jsonInstruction(),
      ].join("\n"),
    },
  ];
}

export function buildReadingGuidePrompt(rankings: string, moduleSummaries: string, codeIntelligence: string, language = "zh"): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a mentor helping a developer understand a new codebase.",
        "Create an agent-oriented reading guide: what to read for specific tasks, what contracts to preserve, and what commands validate the work.",
        "Start from runtime entry points and high-value flows, not whatever PageRank happens to rank first.",
        "Each step must say what to look for and why it matters when modifying code.",
        languageInstruction(language),
      ].join(" "),
    },
    {
      role: "user",
      content: [
        "## File Importance Rankings (by PageRank)",
        rankings,
        "",
        "## Module Summaries",
        moduleSummaries,
        "",
        codeIntelligence,
        "",
        "Create a reading guide with 5-10 steps. Output JSON:",
        "{",
        '  "introduction": "brief intro on how to approach this codebase",',
        '  "steps": [',
        '    {"order": 1, "title": "step title", "files": ["file1.ts", "file2.ts"], "explanation": "what to look for and why", "time_estimate": "5 min"}',
        "  ],",
        '  "tips": ["specific reading or editing tip"],',
        '  "task_paths": [{"task": "change knowledge generation", "files": ["file1.ts"], "why": "why these files are the path"}]',
        "}",
        "",
        jsonInstruction(),
      ].join("\n"),
    },
  ];
}

export function extractJson(text: string): unknown {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(stripped);
  } catch {
    // Continue to bracket matching.
  }

  for (const [startChar, endChar] of [["{", "}"], ["[", "]"]] as const) {
    const start = stripped.indexOf(startChar);
    const end = stripped.lastIndexOf(endChar);
    if (start < 0 || end <= start) continue;
    try {
      return JSON.parse(stripped.slice(start, end + 1));
    } catch {
      // Try the next bracket shape.
    }
  }
  return undefined;
}

function languageInstruction(language: string): string {
  const map: Record<string, string> = {
    en: "Respond in English.",
    zh: "请用中文回答。",
    ja: "日本語で回答してください。",
    ko: "한국어로 답변해주세요.",
  };
  return map[language] ?? map.zh;
}

function jsonInstruction(): string {
  return "Output ONLY valid JSON. No markdown fences, no explanation text before or after. Just the JSON object/array.";
}

function escapeJsonString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
