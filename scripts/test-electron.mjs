// Electron-as-test-runner：让 electron 进程跑 node:test，绕过 electron 顶层 import 在纯 Node 24 下炸的问题。
//
// 用法：
//   electron scripts/test-electron.mjs "dist-test/test/electron/cron-*.test.js"
//   electron scripts/test-electron.mjs dist-test/test/electron/cron-service.test.js
//
// 退出码：0 全部通过；1 有失败。
//
// 为什么需要这个：
//   cron-service.ts 静态 import { app } from "electron"；纯 Node 24 加载时
//   electron npm 包只导出 path 字符串 → SyntaxError。Electron 主进程模式下
//   `app` 来自内置 C++ binding，可正常使用。
//   同时 better-sqlite3 也是按 Electron 的 NODE_MODULE_VERSION 编译的。

import { app } from "electron";
import { run } from "node:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";

// Electron 主进程模式下 argv 顺序：argv[0]=electron, argv[1]=消耗掉的 flag (--no-sandbox),
// argv[2]=main 脚本, argv[3+]=用户参数。直接用 env var 传测试文件最稳。
const envArg = process.env.CRON_TEST_FILES;
// 也支持从 argv 取（排除 flag 和脚本本身）
const argvArgs = process.argv.slice(2).filter(
  (a) => !a.startsWith("-") && !a.endsWith("test-electron.mjs"),
);
const arg = envArg || argvArgs[0];
if (!arg) {
  console.error(
    "[test-electron] 用法: CRON_TEST_FILES=<glob> electron --no-sandbox scripts/test-electron.mjs",
  );
  app.exit(1);
}

// 简易 glob：扫目录匹配通配符
let testFiles = [];
if (arg.includes("*")) {
  const lastSlash = arg.lastIndexOf("/");
  const dir = lastSlash >= 0 ? arg.substring(0, lastSlash) : ".";
  const pattern = lastSlash >= 0 ? arg.substring(lastSlash + 1) : arg;
  // 把 glob 模式转 regex（仅支持 * 通配符；够用）
  const regex = new RegExp(
    "^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$",
  );
  try {
    for (const f of readdirSync(dir)) {
      if (regex.test(f)) testFiles.push(join(dir, f));
    }
  } catch (e) {
    console.error(`[test-electron] 扫描目录失败: ${dir} (${e.message})`);
    app.exit(1);
  }
} else {
  testFiles = [arg];
}

if (testFiles.length === 0) {
  console.error(`[test-electron] 未找到测试文件: ${arg}`);
  app.exit(1);
}

console.log(`[test-electron] 准备跑 ${testFiles.length} 个测试文件:`);
for (const f of testFiles) console.log(`  - ${f}`);

app.whenReady().then(() => {
  const stream = run({ files: testFiles });
  let passes = 0;
  let failures = 0;

  stream.on("test:pass", () => {
    passes++;
  });
  stream.on("test:fail", (evt) => {
    failures++;
    const t = evt?.data;
    const name = t?.name ?? "(anonymous)";
    console.error(`  ✗ FAIL: ${name}`);
    if (t?.details?.error) {
      console.error(`    ${t.details.error.message ?? t.details.error}`);
    }
  });

  stream.on("end", () => {
    console.log(`\n[test-electron] 通过 ${passes} / 失败 ${failures}`);
    app.exit(failures > 0 ? 1 : 0);
  });
});
