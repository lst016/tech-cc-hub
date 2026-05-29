export type ClaudeCodeCompatSection = {
  version: string;
  date: string;
  items: string[];
};

export type ClaudeCodeCompatCommandItem = {
  name: string;
  description: string;
};

export declare function normalizeVersion(input: unknown): string;
export declare function extractSections(html: string): ClaudeCodeCompatSection[];
export declare function extractCommandItems(items: string[]): ClaudeCodeCompatCommandItem[];
export declare function buildPromptHints(items: string[]): string[];
