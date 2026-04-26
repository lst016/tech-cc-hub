import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export const DEV_BACKEND_BRIDGE_PORT = 4317;

type JsonHandler = (...args: any[]) => unknown | Promise<unknown>;

type DevBackendBridgeOptions = {
  port?: number;
  platform: string;
  handlers: Record<string, JsonHandler>;
  subscribeServerEvents: (listener: (event: unknown) => void) => () => void;
  subscribeBrowserEvents: (listener: (event: unknown) => void) => () => void;
};

type BridgeHandle = {
  stop: () => void;
};

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function writeSseHeaders(response: ServerResponse): void {
  response.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8",
  });
  response.write(":ok\n\n");
}

async function readJsonBody(request: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.trim() ? JSON.parse(raw) : {};
}

export function startDevBackendBridge(options: DevBackendBridgeOptions): BridgeHandle {
  const port = options.port ?? DEV_BACKEND_BRIDGE_PORT;
  const serverEventClients = new Set<ServerResponse>();
  const browserEventClients = new Set<ServerResponse>();

  const pushSseEvent = (clients: Set<ServerResponse>, payload: unknown) => {
    const serialized = JSON.stringify(payload);
    for (const response of clients) {
      response.write(`data: ${serialized}\n\n`);
    }
  };

  const unsubscribeServerEvents = options.subscribeServerEvents((event) => {
    pushSseEvent(serverEventClients, event);
  });
  const unsubscribeBrowserEvents = options.subscribeBrowserEvents((event) => {
    pushSseEvent(browserEventClients, event);
  });

  const server = createServer(async (request, response) => {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);

    if (method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      });
      response.end();
      return;
    }

    if (method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, {
        ok: true,
        platform: options.platform,
        methods: Object.keys(options.handlers),
      });
      return;
    }

    if (method === "GET" && url.pathname === "/events/server") {
      writeSseHeaders(response);
      serverEventClients.add(response);
      request.on("close", () => {
        serverEventClients.delete(response);
      });
      return;
    }

    if (method === "GET" && url.pathname === "/events/browser") {
      writeSseHeaders(response);
      browserEventClients.add(response);
      request.on("close", () => {
        browserEventClients.delete(response);
      });
      return;
    }

    if (method === "POST" && url.pathname.startsWith("/rpc/")) {
      const handlerName = decodeURIComponent(url.pathname.slice("/rpc/".length));
      const handler = options.handlers[handlerName];
      if (!handler) {
        writeJson(response, 404, { success: false, error: `Unknown handler: ${handlerName}` });
        return;
      }

      try {
        const body = await readJsonBody(request);
        const args = Array.isArray(body?.args) ? body.args : [];
        const result = await handler(...args);
        writeJson(response, 200, { success: true, result });
      } catch (error) {
        writeJson(response, 500, {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    writeJson(response, 404, { success: false, error: "Not found" });
  });

  server.listen(port, "127.0.0.1");

  return {
    stop: () => {
      unsubscribeServerEvents();
      unsubscribeBrowserEvents();
      for (const response of serverEventClients) {
        response.end();
      }
      for (const response of browserEventClients) {
        response.end();
      }
      server.close();
    },
  };
}
