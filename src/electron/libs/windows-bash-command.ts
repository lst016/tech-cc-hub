export function normalizeWindowsBashCommand(
  command: string,
  platform: NodeJS.Platform = process.platform,
): { command: string; changed: boolean; note?: string } {
  if (platform !== "win32") {
    return { command, changed: false };
  }

  const fixed = protectWindowsNativeSwitches(command);
  return {
    command: fixed,
    changed: fixed !== command,
    note: fixed !== command
      ? "Protected Windows command switches from Git Bash path conversion"
      : undefined,
  };
}

export function getBashBackgroundServiceGuidance(
  toolName: string,
  toolInput: unknown,
  toolResponse: unknown,
): string | undefined {
  if (toolName !== "Bash" || !isRecord(toolInput) || typeof toolInput.command !== "string") {
    return undefined;
  }

  const command = toolInput.command;
  if (!/(spring-boot:run|bootRun|java\s+-jar|mvnw?(?:\.cmd)?\s|gradlew?(?:\.bat)?\s)/i.test(command)) {
    return undefined;
  }

  const responseText = typeof toolResponse === "string"
    ? toolResponse
    : safeStringify(toolResponse);
  if (!/(background|pid|exit\s+code\s+0|running)/i.test(responseText)) {
    return undefined;
  }

  return [
    "Background service launch is not readiness proof.",
    "Verify the actual listener and health endpoint with diagnose_port/http_ping, and inspect the service log before treating the app as usable.",
    "For Spring Boot /actuator/health, HTTP 503 can mean the process is reachable but readiness is still failing.",
  ].join(" ");
}

function protectWindowsNativeSwitches(command: string): string {
  return command
    .replace(/\btaskkill(\s+(?:"[^"]*"|'[^']*'|[^;&|])+)/gi, (match) => protectSlashSwitches(match))
    .replace(/\bcmd(?:\.exe)?(\s+\/[a-z](?:\s+\/[a-z])*)/gi, (match) => protectSlashSwitches(match));
}

function protectSlashSwitches(segment: string): string {
  return segment.replace(/(^|\s)\/(?=[A-Za-z][A-Za-z0-9-]*(?=\s|$))/g, "$1//");
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
