const PACKAGE_DEV_SCRIPT_PATTERN =
  /(?:^|[;&|]\s*)(?:npm|pnpm|yarn|bun)(?:\.cmd)?\s+(?:(?:run|exec)\s+)?(?:dev|start|serve|preview|watch)(?=\s|$|:)/i;

const KNOWN_DEV_SERVER_PATTERN =
  /(?:^|[;&|]\s*)(?:vite|next|nuxt|astro|storybook|webpack-dev-server|webpack\s+serve|wrangler\s+dev|vercel\s+dev|netlify\s+dev)(?=\s|$)/i;

const WATCH_MODE_PATTERN =
  /(?:^|[;&|]\s*)(?:(?:nodemon|tsx\s+watch)(?=\s|$)|(?:tsc|vue-tsc|vitest|jest|mocha|node|deno)(?:\s+[^;&|]*)?\s(?:--watch|-w|watch)(?=\s|$))/i;

const JVM_DEV_SERVER_PATTERN =
  /(?:spring-boot:run|(?:^|[;&|]\s*)gradlew?(?:\.bat)?\b[^;&|]*\bbootRun\b|(?:^|[;&|]\s*)mvnw?(?:\.cmd)?\b[^;&|]*\bspring-boot:run\b)/i;

export function isLikelyLongRunningTerminalCommand(command: string): boolean {
  const normalized = command.trim();
  if (!normalized) return false;

  return [
    PACKAGE_DEV_SCRIPT_PATTERN,
    KNOWN_DEV_SERVER_PATTERN,
    WATCH_MODE_PATTERN,
    JVM_DEV_SERVER_PATTERN,
  ].some((pattern) => pattern.test(normalized));
}
