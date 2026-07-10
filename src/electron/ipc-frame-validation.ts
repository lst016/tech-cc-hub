export const DEV_PORT = 4173;

const DEV_ALLOWED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isAllowedDevFrameUrl(frameUrl: string): boolean {
  try {
    const url = new URL(frameUrl);
    return DEV_ALLOWED_HOSTNAMES.has(url.hostname) && url.port === String(DEV_PORT);
  } catch {
    return false;
  }
}
