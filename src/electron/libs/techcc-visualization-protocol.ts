import { protocol } from "electron";

import {
  TECHCC_VISUALIZATION_SCHEME,
  buildTechccVisualizationDocument,
  buildTechccVisualizationUrl,
  createTechccVisualizationNonce,
  parseTechccVisualizationUrl,
  type TechccVisualizationLaunch,
} from "../../shared/techcc-visualization-protocol.js";
import { readVisualizationArtifact } from "./visualization-artifacts.js";

const LAUNCH_TTL_MS = 60_000;
const MAX_PENDING_LAUNCHES = 64;
const MAX_PENDING_LAUNCH_BYTES = 32 * 1024 * 1024;

type PendingVisualizationLaunch = {
  artifact: Awaited<ReturnType<typeof readVisualizationArtifact>>;
  createdAt: number;
  nonce: string;
};

const pendingLaunches = new Map<string, PendingVisualizationLaunch>();
let pendingLaunchBytes = 0;
let schemeRegistered = false;
let protocolInstalled = false;

function buildErrorDocument(message: string): string {
  const safeMessage = message
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>body{margin:0;padding:24px;font:14px/1.6 system-ui;color:#991b1b;background:#fff7f7}strong{display:block;margin-bottom:6px}</style><body><strong>交互视图无法加载</strong>${safeMessage}</body></html>`;
}

function deletePendingLaunch(token: string): PendingVisualizationLaunch | null {
  const launch = pendingLaunches.get(token);
  if (!launch) return null;
  pendingLaunches.delete(token);
  pendingLaunchBytes -= launch.artifact.metadata.sizeBytes;
  return launch;
}

function purgeExpiredLaunches(now: number): void {
  for (const [token, launch] of pendingLaunches) {
    if (now - launch.createdAt <= LAUNCH_TTL_MS) continue;
    deletePendingLaunch(token);
  }
}

function evictLaunchesForCapacity(incomingBytes: number): void {
  while (
    pendingLaunches.size >= MAX_PENDING_LAUNCHES
    || pendingLaunchBytes + incomingBytes > MAX_PENDING_LAUNCH_BYTES
  ) {
    const oldestToken = pendingLaunches.keys().next().value;
    if (typeof oldestToken !== "string") break;
    deletePendingLaunch(oldestToken);
  }
}

function createLaunchToken(): string {
  let token: string;
  do {
    token = `launch_${createTechccVisualizationNonce()}`;
  } while (pendingLaunches.has(token));
  return token;
}

export async function createTechccVisualizationLaunch(input: {
  rootDir: string;
  sessionId: string;
  fileName: string;
}): Promise<TechccVisualizationLaunch> {
  const artifact = await readVisualizationArtifact(input);
  const now = Date.now();
  purgeExpiredLaunches(now);
  evictLaunchesForCapacity(artifact.metadata.sizeBytes);

  const token = createLaunchToken();
  const nonce = createTechccVisualizationNonce();
  pendingLaunches.set(token, { artifact, createdAt: now, nonce });
  pendingLaunchBytes += artifact.metadata.sizeBytes;
  return { url: buildTechccVisualizationUrl({ token }), nonce };
}

export function registerTechccVisualizationScheme(): void {
  if (schemeRegistered) return;
  protocol.registerSchemesAsPrivileged([{
    scheme: TECHCC_VISUALIZATION_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: false,
      corsEnabled: false,
      stream: false,
      allowServiceWorkers: false,
      codeCache: false,
    },
  }]);
  schemeRegistered = true;
}

export function installTechccVisualizationProtocol(): void {
  if (protocolInstalled) return;
  protocol.handle(TECHCC_VISUALIZATION_SCHEME, async (request) => {
    const address = parseTechccVisualizationUrl(request.url);
    if (!address) {
      return new Response(buildErrorDocument("可视化地址无效。"), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    try {
      purgeExpiredLaunches(Date.now());
      const launch = deletePendingLaunch(address.token);
      if (!launch) {
        return new Response(buildErrorDocument("可视化启动凭证无效或已过期。"), {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        });
      }
      const artifact = launch.artifact;

      const document = buildTechccVisualizationDocument({
        fragment: artifact.content,
        nonce: launch.nonce,
        title: artifact.metadata.fileName.replace(/\.html$/i, ""),
        metadata: {
          sessionId: artifact.metadata.sessionId,
          fileName: artifact.metadata.fileName,
          sha256: artifact.sha256,
        },
      });
      return new Response(document, {
        headers: {
          "Content-Type": artifact.metadata.mimeType,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "X-Techcc-Visualization-Sha256": artifact.sha256,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "可视化制品读取失败。";
      return new Response(buildErrorDocument(message), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
  });
  protocolInstalled = true;
}
