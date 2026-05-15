export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function buildOverviewPrompt(fileTree: string, keyFiles: string, language = "zh"): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a senior software engineer explaining a project to a new team member.",
        "Be direct, specific, and concrete.",
        "Do not use filler phrases. Describe what the code actually does.",
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
        "Generate a project overview as JSON with this structure:",
        "{",
        '  "name": "project name",',
        '  "one_liner": "what this project does in one sentence (max 20 words)",',
        '  "description": "2-3 paragraphs explaining the project in plain language",',
        '  "tech_stack": [{"name": "TypeScript", "category": "language", "version": ""}],',
        '  "setup_instructions": ["step 1", "step 2"],',
        '  "key_features": ["feature 1", "feature 2"]',
        "}",
        "",
        jsonInstruction(),
      ].join("\n"),
    },
  ];
}

export function buildModulePrompt(moduleName: string, filesContext: string, projectSummary: string, language = "zh"): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a senior engineer documenting your own code.",
        "Be direct and specific. No filler.",
        "Explain what each file does, how files relate to each other, and what the key functions/classes are.",
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
        "Output JSON:",
        "{",
        `  "name": "${escapeJsonString(moduleName)}",`,
        '  "purpose": "one sentence",',
        '  "description": "detailed explanation",',
        '  "files": [',
        '    {"path": "file.ts", "purpose": "what it does", "key_symbols": [{"name": "func_name", "kind": "function", "description": "..."}]}',
        "  ],",
        '  "relationships": [{"source": "a.ts", "target": "b.ts", "description": "a imports b for..."}],',
        '  "key_concepts": [{"name": "concept", "explanation": "..."}]',
        "}",
        "",
        jsonInstruction(),
      ].join("\n"),
    },
  ];
}

export function buildArchitecturePrompt(fileTree: string, keyFiles: string, language = "zh"): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a software architect analyzing a codebase.",
        "Identify the architecture pattern and generate Mermaid diagrams.",
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
        "Analyze the architecture. Output JSON:",
        "{",
        '  "architecture_type": "one of: monolith, client-server, microservices, library, cli-tool, framework, plugin-system, pipeline",',
        '  "description": "explain the architecture in 2-3 sentences",',
        '  "components": [{"name": "...", "purpose": "...", "files": ["..."]}],',
        '  "mermaid_component": "graph TD\\n  A[Component] --> B[Component]\\n  ...",',
        '  "mermaid_sequence": "sequenceDiagram\\n  participant A\\n  A->>B: request\\n  ...",',
        '  "data_flow": "describe the main data flow in 2-3 sentences"',
        "}",
        "",
        "IMPORTANT: Mermaid code must be a single string with \\n for newlines. Use simple alphanumeric node IDs.",
        jsonInstruction(),
      ].join("\n"),
    },
  ];
}

export function buildReadingGuidePrompt(rankings: string, moduleSummaries: string, language = "zh"): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a mentor helping a developer understand a new codebase.",
        "Create a reading guide: which files to read, in what order, and why.",
        "Start from entry points and configuration, then core logic, then utilities.",
        "Each step should say what to look for, not just which files.",
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
        "Create a reading guide with 5-10 steps. Output JSON:",
        "{",
        '  "introduction": "brief intro on how to approach this codebase",',
        '  "steps": [',
        '    {"order": 1, "title": "step title", "files": ["file1.ts", "file2.ts"], "explanation": "what to look for and why", "time_estimate": "5 min"}',
        "  ],",
        '  "tips": ["general tip 1", "general tip 2"]',
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
