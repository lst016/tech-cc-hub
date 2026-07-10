import assert from "node:assert/strict";
import { createServer } from "node:http";

import { sendImageToBoundChat } from "../src/codex-chat.mjs";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

const previous = {
  url: process.env.TECH_CC_HUB_BRIDGE_URL,
  token: process.env.TECH_CC_HUB_BRIDGE_TOKEN,
  sessionId: process.env.TECH_CC_HUB_SESSION_ID,
};
let requestBody = null;
const server = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  requestBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  assert.equal(request.method, "POST");
  assert.equal(request.url, "/v1/session/send");
  assert.equal(request.headers.authorization, "Bearer canvas-test-token");
  response.writeHead(202, { "content-type": "application/json" });
  response.end(JSON.stringify({ status: "accepted" }));
});

try {
  process.env.TECH_CC_HUB_BRIDGE_URL = await listen(server);
  process.env.TECH_CC_HUB_BRIDGE_TOKEN = "canvas-test-token";
  process.env.TECH_CC_HUB_SESSION_ID = "session-canvas-test";

  const result = await sendImageToBoundChat({
    projectDir: process.cwd(),
    threadId: "session-canvas-test",
    imagePath: "C:/workspace/canvas/selected-image.png",
    prompt: "Retouch the selected subject.",
  });

  assert.deepEqual(requestBody, {
    sessionId: "session-canvas-test",
    imagePath: "C:/workspace/canvas/selected-image.png",
    prompt: "Retouch the selected subject.",
    source: { pluginId: "codex-canvas", action: "send-to-chat" },
  });
  assert.equal(result.status, "submitted");
  assert.equal(result.threadId, "session-canvas-test");
  process.stdout.write("tech-cc-hub transport smoke passed\n");
} finally {
  await close(server);
  for (const [key, value] of Object.entries(previous)) {
    const envKey = key === "url"
      ? "TECH_CC_HUB_BRIDGE_URL"
      : key === "token"
        ? "TECH_CC_HUB_BRIDGE_TOKEN"
        : "TECH_CC_HUB_SESSION_ID";
    if (value === undefined) delete process.env[envKey];
    else process.env[envKey] = value;
  }
}
