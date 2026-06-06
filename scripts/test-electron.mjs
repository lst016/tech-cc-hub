// Electron-as-test-runner：动态 import 测试文件，让 node:test 在 Electron 主进程里直接跑。
//
// 为什么不用 run()：
//   `node:test` 的 run({ files }) API 在 Electron 主进程下事件不触发，stream 不 end。
//   但 `test()` 调用本身在 Electron 里工作正常，文件 import 即触发并 TAP 输出到 stdout。
//
// 用法：
//   CRON_TEST_FILES="dist-test/test/electron/cron-*.test.js" electron --no-sandbox scripts/test-electron.mjs
//
// 退出码：当前实现固定 0（test 失败由 TAP 输出可见；后续可加计数）。

import { app } from "electron";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { readdirSync } from "node:fs";

// Electron 主进程 argv 顺序：argv[0]=electron, argv[1]=消耗掉的 flag,
// argv[2]=main 脚本, argv[3+]=用户参数。env var 传参最稳。
const envArg = process.env.CRON_TEST_FILES;
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
  const regex = new RegExp(
    "^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$",
  );
  try {
    for (const f of readdirSync(dir)) {
      if (regex.test(f)) testFiles.push(resolve(dir, f));
    }
  } catch (e) {
    console.error(`[test-electron] 扫描目录失败: ${dir} (${e.message})`);
    app.exit(1);
  }
} else {
  testFiles = [resolve(arg)];
}

if (testFiles.length === 0) {
  console.error(`[test-electron] 未找到测试文件: ${arg}`);
  app.exit(1);
}

console.log(`[test-electron] 准备跑 ${testFiles.length} 个测试文件:`);
for (const f of testFiles) console.log(`  - ${f}`);

app.whenReady().then(async () => {
  // 拦截 stdout 计数 TAP 结果（不修改输出，只数 ok / not ok 行）
  let passes = 0;
  let failures = 0;
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, ...args) => {
    const text = typeof chunk === "string" ? chunk : chunk.toString();
    const okMatches = text.match(/^ok \d+/gm);
    if (okMatches) passes += okMatches.length;
    const notOkMatches = text.match(/^not ok \d+/gm);
    if (notOkMatches) failures += notOkMatches.length;
    return origWrite(chunk, ...args);
  };

  for (const f of testFiles) {
    console.log(`\n========== ${f} ==========`);
    try {
      await import(pathToFileURL(f).href);
    } catch (e) {
      console.error(`[test-electron] import ${f} 失败: ${e?.message ?? e}`);
      failures++;
    }
    // 给异步测试一个微任务周期
    await new Promise((r) => setTimeout(r, 300));
  }
  // 兜底：再等 1.5s 收集剩余 async
  await new Promise((r) => setTimeout(r, 1500));

  console.log(`\n[test-electron] 通过 ${passes} / 失败 ${failures}`);
  app.exit(failures > 0 ? 1 : 0);
});
