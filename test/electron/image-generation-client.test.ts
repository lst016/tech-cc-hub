// 生图 Client 单元测试：mock HTTP server 验证 generations / edits 两条路径。
// 依赖 electron.app.getPath（落盘到 userData/generated-images），所以必须在 Electron 主进程跑。
// 通过 scripts/test-electron.mjs + CRON_TEST_FILES 触发。
import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  generateImages,
  __test__,
} from "../../src/electron/libs/image/image-generation-client.js";
import type { ImageGenerationRouteConfig } from "../../src/shared/models/image-generation-routing.js";

const { resolveMode, validateRequest, classifyUpstreamError, extractUpstreamErrorMessage } = __test__;

function startMockServer(handler: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer(handler);
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        resolve({ server, port: address.port });
      } else {
        reject(new Error("failed to listen"));
      }
    });
  });
}

function stopServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

const SAMPLE_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

test("resolveMode picks generate when no reference images", () => {
  assert.equal(resolveMode({ prompt: "x", action: "auto" }), "generate");
  assert.equal(resolveMode({ prompt: "x", action: "generate" }), "generate");
});

test("resolveMode picks edit when reference images present and action is auto", () => {
  assert.equal(resolveMode({ prompt: "x", action: "auto", referenceImagePaths: ["C:\\ref.png"] }), "edit");
  assert.equal(resolveMode({ prompt: "x", action: "edit" }), "edit");
});

test("validateRequest rejects invalid count but preserves provider-defined image sizes", () => {
  assert.equal(validateRequest({ prompt: "", }).ok, false);
  assert.equal(validateRequest({ prompt: "x", count: 5 }).ok, false);
  assert.equal(validateRequest({ prompt: "x", count: 0 }).ok, false);
  assert.equal(validateRequest({ prompt: "x", size: "9999x9999" as unknown as `${number}x${number}` }).ok, true);
  assert.equal(validateRequest({ prompt: "x", size: "2k" as unknown as `${number}x${number}` }).ok, true);
  assert.equal(validateRequest({ prompt: "x", quality: "ultra" as unknown as "auto" }).ok, false);
  assert.equal(validateRequest({ prompt: "x", referenceImagePaths: ["a", "b", "c", "d", "e"] }).ok, false);
  assert.equal(validateRequest({ prompt: "x" }).ok, true);
});

test("classifyUpstreamError detects moderation and unsupported option errors", () => {
  assert.equal(classifyUpstreamError(400, "content policy violation"), "MODERATION_BLOCKED");
  assert.equal(classifyUpstreamError(400, "unknown parameter foo"), "UNSUPPORTED_OPTION");
  assert.equal(classifyUpstreamError(500, "internal error"), "UPSTREAM_ERROR");
});

test("extractUpstreamErrorMessage reads nested error.message", () => {
  assert.equal(extractUpstreamErrorMessage({ error: { message: "bad model" } }), "bad model");
  assert.equal(extractUpstreamErrorMessage({ error: "string error" }), "string error");
  assert.equal(extractUpstreamErrorMessage({ message: "top-level" }), "top-level");
  assert.equal(extractUpstreamErrorMessage({}), undefined);
});

test("generateImages returns NOT_CONFIGURED when no slot is set", async () => {
  const selected: ImageGenerationRouteConfig = {
    id: "selected",
    provider: "custom",
    baseURL: "https://api.example.com/v1",
    apiKey: "sk-test",
    models: [{ name: "gpt-5.5" }],
  };

  const result = await generateImages({
    sessionId: "test-session",
    request: { prompt: "draw a cat" },
    context: { selectedConfig: selected, enabledConfigs: [selected] },
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "NOT_CONFIGURED");
  }
});

test("generateImages returns UNSUPPORTED_PROVIDER for codex OAuth config", async () => {
  const codex: ImageGenerationRouteConfig = {
    id: "codex",
    provider: "codex",
    baseURL: "https://chatgpt.com",
    apiKey: "oauth-token",
    imageGenerationModel: "gpt-image-2",
    models: [{ name: "gpt-image-2" }],
  };

  const result = await generateImages({
    sessionId: "test-session",
    request: { prompt: "draw a cat" },
    context: { selectedConfig: codex, enabledConfigs: [codex] },
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "UNSUPPORTED_PROVIDER");
  }
});

test("generateImages posts JSON to /images/generations and persists b64_json artifact", async () => {
  const mock = await startMockServer((req, res) => {
    assert.equal(req.url, "/v1/images/generations");
    assert.equal(req.method, "POST");
    res.writeHead(200, { "content-type": "application/json", "x-request-id": "req-123" });
    res.end(JSON.stringify({
      data: [{ b64_json: SAMPLE_PNG_BASE64, revised_prompt: "a cat" }],
    }));
  });

  try {
    const selected: ImageGenerationRouteConfig = {
      id: "selected",
      provider: "custom",
      baseURL: `http://127.0.0.1:${mock.port}`,
      apiKey: "sk-test",
      imageGenerationModel: "gpt-image-2",
      models: [{ name: "gpt-image-2" }],
    };

    const result = await generateImages({
      sessionId: "img-gen-test",
      request: { prompt: "draw a cat" },
      context: { selectedConfig: selected, enabledConfigs: [selected] },
    });

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.mode, "generate");
      assert.equal(result.model, "gpt-image-2");
      assert.equal(result.artifacts.length, 1);
      assert.match(result.artifacts[0]?.path ?? "", /img-gen-test/);
      assert.equal(result.artifacts[0]?.mimeType, "image/png");
      assert.ok((result.artifacts[0]?.sizeBytes ?? 0) > 0);
    }
  } finally {
    await stopServer(mock.server);
  }
});

test("generateImages fans out count as concurrent single-image requests", async () => {
  const requestBodies: Array<Record<string, unknown>> = [];
  let activeRequests = 0;
  let maxActiveRequests = 0;
  const mock = await startMockServer((req, res) => {
    activeRequests += 1;
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
    let rawBody = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      rawBody += chunk;
    });
    req.on("end", () => {
      requestBodies.push(JSON.parse(rawBody) as Record<string, unknown>);
      setTimeout(() => {
        activeRequests -= 1;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          data: [{ b64_json: SAMPLE_PNG_BASE64 }],
        }));
      }, 40);
    });
  });

  try {
    const selected: ImageGenerationRouteConfig = {
      id: "parallel-images",
      provider: "custom",
      baseURL: `http://127.0.0.1:${mock.port}`,
      apiKey: "sk-test",
      imageGenerationModel: "doubao-seedream-5-0-260128",
      models: [{ name: "doubao-seedream-5-0-260128" }],
    };

    const result = await generateImages({
      sessionId: "parallel-images",
      request: { prompt: "draw three cats", count: 3 },
      context: { selectedConfig: selected, enabledConfigs: [selected] },
    });

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.artifacts.length, 3);
    }
    assert.equal(requestBodies.length, 3);
    assert.ok(maxActiveRequests > 1, "count requests should overlap instead of running sequentially");
    assert.deepEqual(requestBodies.map((body) => body.n), [1, 1, 1]);
  } finally {
    await stopServer(mock.server);
  }
});

test("generateImages keeps successful artifacts when one concurrent request fails", async () => {
  let calls = 0;
  const mock = await startMockServer((_req, res) => {
    calls += 1;
    if (calls === 2) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "temporary upstream failure" } }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ data: [{ b64_json: SAMPLE_PNG_BASE64 }] }));
  });

  try {
    const selected: ImageGenerationRouteConfig = {
      id: "partial-images",
      provider: "custom",
      baseURL: `http://127.0.0.1:${mock.port}`,
      apiKey: "sk-test",
      imageGenerationModel: "gpt-image-2",
      models: [{ name: "gpt-image-2" }],
    };

    const result = await generateImages({
      sessionId: "partial-images",
      request: { prompt: "draw three cats", count: 3 },
      context: { selectedConfig: selected, enabledConfigs: [selected] },
    });

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.artifacts.length, 2);
      assert.equal(result.outputHint, "已生成 2/3 张。");
    }
    assert.equal(calls, 3);
  } finally {
    await stopServer(mock.server);
  }
});

test("generateImages disables the default watermark for Doubao Seedream models", async () => {
  let requestBody: Record<string, unknown> | undefined;
  const mock = await startMockServer((req, res) => {
    let rawBody = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      rawBody += chunk;
    });
    req.on("end", () => {
      requestBody = JSON.parse(rawBody) as Record<string, unknown>;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        data: [{ b64_json: SAMPLE_PNG_BASE64 }],
      }));
    });
  });

  try {
    const selected: ImageGenerationRouteConfig = {
      id: "doubao-seedream",
      provider: "custom",
      baseURL: `http://127.0.0.1:${mock.port}`,
      apiKey: "sk-test",
      imageGenerationModel: "doubao-seedream-5-0-260128",
      models: [{ name: "doubao-seedream-5-0-260128" }],
    };

    const result = await generateImages({
      sessionId: "doubao-seedream-no-watermark",
      request: { prompt: "draw a rabbit" },
      context: { selectedConfig: selected, enabledConfigs: [selected] },
    });

    assert.equal(result.success, true);
    assert.equal(requestBody?.watermark, false);
  } finally {
    await stopServer(mock.server);
  }
});

test("generateImages downloads remote URL artifact and persists locally", async () => {
  const pngBytes = Buffer.from(SAMPLE_PNG_BASE64, "base64");
  const mock = await startMockServer((req, res) => {
    if (req.url === "/v1/images/generations") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        data: [{ url: `http://127.0.0.1:${mock.port}/remote.png` }],
      }));
    } else if (req.url === "/remote.png") {
      res.writeHead(200, { "content-type": "image/png" });
      res.end(pngBytes);
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  try {
    const selected: ImageGenerationRouteConfig = {
      id: "selected",
      provider: "custom",
      baseURL: `http://127.0.0.1:${mock.port}`,
      apiKey: "sk-test",
      imageGenerationModel: "gpt-image-2",
      models: [{ name: "gpt-image-2" }],
    };

    const result = await generateImages({
      sessionId: "img-gen-remote",
      request: { prompt: "draw a cat" },
      context: { selectedConfig: selected, enabledConfigs: [selected] },
    });

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.artifacts.length, 1);
      assert.equal(result.artifacts[0]?.mimeType, "image/png");
    }
  } finally {
    await stopServer(mock.server);
  }
});

test("generateImages maps 401 to AUTHENTICATION_FAILED", async () => {
  const mock = await startMockServer((_req, res) => {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: "invalid api key" } }));
  });

  try {
    const selected: ImageGenerationRouteConfig = {
      id: "selected",
      provider: "custom",
      baseURL: `http://127.0.0.1:${mock.port}`,
      apiKey: "sk-bad",
      imageGenerationModel: "gpt-image-2",
      models: [{ name: "gpt-image-2" }],
    };

    const result = await generateImages({
      sessionId: "img-gen-401",
      request: { prompt: "draw a cat" },
      context: { selectedConfig: selected, enabledConfigs: [selected] },
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.code, "AUTHENTICATION_FAILED");
      assert.equal(result.status, 401);
    }
  } finally {
    await stopServer(mock.server);
  }
});

test("generateImages maps 429 to RATE_LIMITED and does not retry", async () => {
  let calls = 0;
  const mock = await startMockServer((_req, res) => {
    calls++;
    res.writeHead(429, { "content-type": "application/json", "x-request-id": "rl-1" });
    res.end(JSON.stringify({ error: { message: "rate limited" } }));
  });

  try {
    const selected: ImageGenerationRouteConfig = {
      id: "selected",
      provider: "custom",
      baseURL: `http://127.0.0.1:${mock.port}`,
      apiKey: "sk-test",
      imageGenerationModel: "gpt-image-2",
      models: [{ name: "gpt-image-2" }],
    };

    const result = await generateImages({
      sessionId: "img-gen-429",
      request: { prompt: "draw a cat" },
      context: { selectedConfig: selected, enabledConfigs: [selected] },
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.code, "RATE_LIMITED");
      assert.equal(result.status, 429);
      assert.equal(result.requestId, "rl-1");
    }
    assert.equal(calls, 1, "429 must not be retried");
  } finally {
    await stopServer(mock.server);
  }
});

test("generateImages edits route validates reference image path and rejects out-of-scope files", async () => {
  // 故意用一个不存在路径，触发 INVALID_REFERENCE
  const selected: ImageGenerationRouteConfig = {
    id: "selected",
    provider: "custom",
    baseURL: "http://127.0.0.1:65535",
    apiKey: "sk-test",
    imageGenerationModel: "gpt-image-2",
    models: [{ name: "gpt-image-2" }],
  };

  const result = await generateImages({
    sessionId: "img-gen-edit-bad",
    request: {
      prompt: "remove background",
      action: "edit",
      referenceImagePaths: ["Z:\\nonexistent\\ref.png"],
    },
    context: { selectedConfig: selected, enabledConfigs: [selected] },
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "INVALID_REFERENCE");
  }
});

test("generateImages edits route posts multipart and persists artifact", async () => {
  // 准备一张合法参考图：放在 generated-images/<sessionId>/ 下，属于允许根目录
  const selected: ImageGenerationRouteConfig = {
    id: "selected",
    provider: "custom",
    baseURL: "",
    apiKey: "sk-test",
    imageGenerationModel: "gpt-image-2",
    models: [{ name: "gpt-image-2" }],
  };

  // 用临时目录伪造 userData 的 generated-images 根
  // 注意：artifacts 用 app.getPath('userData')，Electron 主进程下会返回真实路径。
  // 这里我们只验证 multipart 请求被发出 + b64 响应落盘成功。
  let requestBody = "";
  const mock = await startMockServer((req, res) => {
    assert.equal(req.url, "/v1/images/edits");
    assert.equal(req.method, "POST");
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      requestBody += chunk;
    });
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        data: [{ b64_json: SAMPLE_PNG_BASE64 }],
      }));
    });
  });

  try {
    // 动态设置 baseURL 到 mock
    const configWithUrl: ImageGenerationRouteConfig = {
      ...selected,
      baseURL: `http://127.0.0.1:${mock.port}`,
      imageGenerationModel: "doubao-seedream-5-0-260128",
      models: [{ name: "doubao-seedream-5-0-260128" }],
    };

    // 生成一张真实参考图放在 generated-images 目录下
    // 通过 artifacts 的 getGeneratedImagesDirForSession 间接构造路径
    const { getGeneratedImagesDirForSession } = await import("../../src/electron/libs/image/image-generation-artifacts.js");
    const refDir = getGeneratedImagesDirForSession("img-edit-ok");
    mkdirSync(refDir, { recursive: true });
    const refPath = join(refDir, "ref.png");
    writeFileSync(refPath, Buffer.from(SAMPLE_PNG_BASE64, "base64"));

    const result = await generateImages({
      sessionId: "img-edit-ok",
      cwd: refDir,
      request: {
        prompt: "remove background",
        action: "edit",
        referenceImagePaths: [refPath],
      },
      context: { selectedConfig: configWithUrl, enabledConfigs: [configWithUrl] },
    });

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.mode, "edit");
      assert.equal(result.artifacts.length, 1);
    }
    assert.match(requestBody, /name="watermark"\r\n\r\nfalse\r\n/);

    rmSync(refDir, { recursive: true, force: true });
  } finally {
    await stopServer(mock.server);
  }
});

test("generateImages edits count with independent concurrent multipart requests", async () => {
  const requestBodies: string[] = [];
  let activeRequests = 0;
  let maxActiveRequests = 0;
  const mock = await startMockServer((req, res) => {
    activeRequests += 1;
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
    let requestBody = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      requestBody += chunk;
    });
    req.on("end", () => {
      requestBodies.push(requestBody);
      setTimeout(() => {
        activeRequests -= 1;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ data: [{ b64_json: SAMPLE_PNG_BASE64 }] }));
      }, 40);
    });
  });
  const sessionId = "img-edit-parallel";

  try {
    const selected: ImageGenerationRouteConfig = {
      id: "edit-parallel",
      provider: "custom",
      baseURL: `http://127.0.0.1:${mock.port}`,
      apiKey: "sk-test",
      imageGenerationModel: "doubao-seedream-5-0-260128",
      models: [{ name: "doubao-seedream-5-0-260128" }],
    };
    const { getGeneratedImagesDirForSession } = await import("../../src/electron/libs/image/image-generation-artifacts.js");
    const refDir = getGeneratedImagesDirForSession(sessionId);
    mkdirSync(refDir, { recursive: true });
    const refPath = join(refDir, "ref.png");
    writeFileSync(refPath, Buffer.from(SAMPLE_PNG_BASE64, "base64"));

    const result = await generateImages({
      sessionId,
      cwd: refDir,
      request: {
        prompt: "make two variants",
        action: "edit",
        referenceImagePaths: [refPath],
        count: 2,
      },
      context: { selectedConfig: selected, enabledConfigs: [selected] },
    });

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.artifacts.length, 2);
    }
    assert.equal(requestBodies.length, 2);
    assert.ok(maxActiveRequests > 1, "edit requests should overlap instead of running sequentially");
    for (const body of requestBodies) {
      assert.match(body, /name="n"\r\n\r\n1\r\n/);
      assert.match(body, /name="image\[\]"/);
    }
    rmSync(refDir, { recursive: true, force: true });
  } finally {
    await stopServer(mock.server);
  }
});

// 防止未使用变量告警
void pathToFileURL;
void mkdtempSync;
