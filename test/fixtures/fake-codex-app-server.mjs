import { mkdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";

const codexHome = process.env.CODEX_HOME;
const lines = createInterface({ input: process.stdin });

lines.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    send({ id: message.id, result: { userAgent: "fake", codexHome, platformFamily: "windows", platformOs: "windows" } });
    return;
  }
  if (message.method === "initialized") return;
  if (message.method === "account/login/cancel") {
    send({ id: message.id, result: { status: "canceled" } });
    return;
  }
  if (message.method !== "account/login/start") return;

  if (message.params?.type === "chatgpt"
    && (Object.keys(message.params).length !== 1 || !("type" in message.params))) {
    send({
      id: message.id,
      error: {
        message: "browser login must use the app-server localhost callback",
      },
    });
    return;
  }

  const loginId = "fake-login-id";
  if (message.params?.type === "chatgptDeviceCode") {
    send({
      id: message.id,
      result: {
        type: "chatgptDeviceCode",
        loginId,
        verificationUrl: "https://example.test/device",
        userCode: "ABCD-1234",
      },
    });
  } else {
    send({
      id: message.id,
      result: {
        type: "chatgpt",
        loginId,
        authUrl: "https://example.test/oauth?state=fake-secret-state",
      },
    });
  }

  setTimeout(() => {
    const accessToken = buildJwt({
      exp: Math.floor(Date.now() / 1000) + 3_600,
      "https://api.openai.com/auth": { chatgpt_account_id: "account-from-runtime" },
      "https://api.openai.com/profile": { email: "runtime@example.com" },
    });
    mkdirSync(codexHome, { recursive: true });
    writeFileSync(join(codexHome, "auth.json"), JSON.stringify({
      tokens: {
        access_token: accessToken,
        refresh_token: "fake-refresh-token",
      },
      last_refresh: new Date().toISOString(),
    }));
    send({
      method: "account/login/completed",
      params: { loginId, success: true, error: null },
    });
  }, 80);
});

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function buildJwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode(payload)}.`;
}
