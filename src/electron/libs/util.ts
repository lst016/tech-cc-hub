import { unstable_v2_prompt } from "@anthropic-ai/claude-agent-sdk";
import type { SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { getCurrentApiConfig, buildEnvForConfig, getClaudeCodeModelOption, getClaudeCodePath} from "./claude-settings.js";
import { app } from "electron";

// Build enhanced PATH for packaged environment
export function getEnhancedEnv(): Record<string, string | undefined> {

  const config = getCurrentApiConfig();
  if (!config) {
    return {
      ...process.env,
    };
  }
  
  const env = buildEnvForConfig(config);
  return {
    ...process.env,
    ...env,
  };
}

export const generateSessionTitle = async (userIntent: string | null, options: { model?: string } = {}) => {
  if (!userIntent) return "New Session";
  const trimmedIntent = userIntent.trim();

  if (trimmedIntent.startsWith("/")) {
    const parts = trimmedIntent.slice(1).split(/\s+/).filter(Boolean);
    const command = parts[0] ?? "command";
    const context = parts.slice(1, 3).join(" ");
    const title = context ? `/${command} ${context}` : `/${command}`;
    return title.slice(0, 60);
  }

  // Get the Claude Code path when needed, not at module load time
  const claudeCodePath = getClaudeCodePath();
  // Get fresh env each time to ensure latest API config is used
  const apiConfig = getCurrentApiConfig();
  if (!apiConfig?.model?.trim()) {
    const words = trimmedIntent.split(/\s+/).slice(0, 5);
    return words.join(" ").toUpperCase() + (trimmedIntent.split(/\s+/).length > 5 ? "..." : "");
  }
  const requestedModel = options.model?.trim() || apiConfig.model;
  const currentEnv = {
    ...process.env,
    ...buildEnvForConfig(apiConfig, requestedModel),
  };

  try {
    const claudeCodeModelOption = getClaudeCodeModelOption(apiConfig, requestedModel);
    const result: SDKResultMessage = await unstable_v2_prompt(
      `please analynis the following user input to generate a short but clearly title to identify this conversation theme:
      ${trimmedIntent}
      directly output the title, do not include any other content`, {
      ...(claudeCodeModelOption ? { model: claudeCodeModelOption } : {}),
      env: currentEnv,
      pathToClaudeCodeExecutable: claudeCodePath,
    } as Parameters<typeof unstable_v2_prompt>[1]);

    if (result.subtype === "success") {
      return result.result;
    }

    // Log any non-success result for debugging
    console.error("Claude SDK returned non-success result:", result);
    return "New Session";
  } catch (error) {
    // Enhanced error logging for packaged app debugging
    console.error("Failed to generate session title:", error);
    console.error("Claude Code path:", claudeCodePath);
    console.error("Is packaged:", app.isPackaged);
    console.error("Resources path:", process.resourcesPath);

    // Return a simple title based on user input as fallback
    if (userIntent) {
      const words = userIntent.trim().split(/\s+/).slice(0, 5);
      return words.join(" ").toUpperCase() + (userIntent.trim().split(/\s+/).length > 5 ? "..." : "");
    }

    return "New Session";
  }
};
