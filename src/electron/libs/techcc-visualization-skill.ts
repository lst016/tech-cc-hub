import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const VISUALIZATION_TRIGGER_PATTERN = /(?:^|\s)@可视化(?=\s|$|[，。！？、,:;])/u;
const VISUALIZATION_DIRECTORY_PLACEHOLDER = "{{TECHCC_VISUALIZATION_DIRECTORY}}";

export type BuildTechccVisualizationSkillPromptInput = {
  displayPrompt: string;
  sessionDirectory: string;
  skillMarkdown: string;
};

export function isTechccVisualizationRequested(displayPrompt: string): boolean {
  return VISUALIZATION_TRIGGER_PATTERN.test(displayPrompt);
}

export function resolveTechccVisualizationSdkSkills(
  displayPrompt: string,
  configuredSkills?: string[],
): string[] | undefined {
  if (isTechccVisualizationRequested(displayPrompt)) {
    return [];
  }
  return configuredSkills && configuredSkills.length > 0 ? configuredSkills : undefined;
}

export function buildTechccVisualizationSkillPrompt(
  input: BuildTechccVisualizationSkillPromptInput,
): string | undefined {
  if (!isTechccVisualizationRequested(input.displayPrompt)) return undefined;

  const sessionDirectory = input.sessionDirectory.replace(/\\/g, "/").replace(/\/+$/, "");
  return input.skillMarkdown.replaceAll(VISUALIZATION_DIRECTORY_PLACEHOLDER, sessionDirectory).trim();
}

export function loadTechccVisualizationSkillMarkdown(options: {
  cwd?: string;
  resourcesPath?: string;
  overridePath?: string;
} = {}): string {
  const runtimeResourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const candidates = [
    options.overridePath,
    process.env.TECH_CC_HUB_VISUALIZE_SKILL_PATH,
    join(options.cwd ?? process.cwd(), "skills", "techcc-visualize", "SKILL.md"),
    options.resourcesPath ? join(options.resourcesPath, "skills", "techcc-visualize", "SKILL.md") : undefined,
    runtimeResourcesPath ? join(runtimeResourcesPath, "skills", "techcc-visualize", "SKILL.md") : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate));

  const skillPath = candidates.find((candidate) => existsSync(candidate));
  if (!skillPath) {
    throw new Error("techcc-visualize Skill asset is unavailable.");
  }
  return readFileSync(skillPath, "utf8");
}
