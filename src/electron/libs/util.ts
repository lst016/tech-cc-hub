import { query, type SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import {
  buildClaudeCodeModelSettings,
  getCurrentApiConfig,
  buildEnvForConfig,
  getClaudeCodeModelOption,
  getClaudeCodePath,
  resolveApiConfigForModel,
} from "./claude/claude-settings.js";
import { app } from "electron";
import { buildExternalCliEnv } from "./external-cli.js";

// Build enhanced PATH for packaged environment
export function getEnhancedEnv(): Record<string, string | undefined> {

  const config = getCurrentApiConfig();
  if (!config) {
    return buildExternalCliEnv({
      ...process.env,
    });
  }
  
  const env = buildEnvForConfig(config);
  return buildExternalCliEnv({
    ...process.env,
    ...env,
  });
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
  const currentApiConfig = getCurrentApiConfig();
  if (!currentApiConfig?.model?.trim()) {
    const words = trimmedIntent.split(/\s+/).slice(0, 5);
    return words.join(" ").toUpperCase() + (trimmedIntent.split(/\s+/).length > 5 ? "..." : "");
  }
  const requestedModel = options.model?.trim() || currentApiConfig.analysisModel?.trim() || currentApiConfig.smallModel?.trim() || currentApiConfig.model;
  const resolvedRoute = resolveApiConfigForModel(requestedModel);
  const apiConfig = resolvedRoute?.config ?? currentApiConfig;
  const routedModel = resolvedRoute?.model ?? requestedModel;
  console.info("[single-query][route]", {
    purpose: "session-title",
    configProfileId: apiConfig.id,
    configProfileName: apiConfig.name,
    configProvider: apiConfig.provider,
    requestedModel,
    routedModel,
  });
  const currentEnv = buildExternalCliEnv({
    ...process.env,
    ...buildEnvForConfig(apiConfig, routedModel),
  });

  try {
    const claudeCodeModelOption = getClaudeCodeModelOption(apiConfig, routedModel);
    const result = await runSinglePromptQuery(
      `please analyze the following user input to generate a short but clear title to identify this conversation theme:
      ${trimmedIntent}
      directly output the title, do not include any other content`, {
      ...(claudeCodeModelOption ? { model: claudeCodeModelOption } : {}),
      maxTurns: 1,
      tools: [],
      settingSources: [],
      settings: buildClaudeCodeModelSettings(apiConfig, routedModel),
      env: currentEnv,
      pathToClaudeCodeExecutable: claudeCodePath,
    });

    if (result?.subtype === "success") {
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

async function runSinglePromptQuery(
  prompt: string,
  options: NonNullable<Parameters<typeof query>[0]["options"]>,
): Promise<SDKResultMessage | undefined> {
  const q = query({ prompt, options });
  let result: SDKResultMessage | undefined;
  for await (const message of q) {
    if (message.type === "result") {
      result = message;
      const origin = typeof (message as Record<string, unknown>).origin === "string"
        ? (message as Record<string, unknown>).origin
        : undefined;
      if (origin) {
        console.info("[single-query][result]", { origin });
      }
    }
  }
  return result;
}
