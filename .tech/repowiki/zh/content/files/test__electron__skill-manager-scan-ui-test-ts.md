# test/electron/skill-manager-scan-ui.test.ts

> 模块：`test` · 语言：`typescript` · 行数：48

## 文件职责

测试技能管理器UI扫描行为，验证轻量级扫描（不哈希每个目录）、跳过node_modules等重量级目录、技能市场卡片不依赖远程GitHub头像、git导入IPC处理程序连接

## 关键符号

- `scannerSource@6`
- `scannerSource@13`
- `installViewSource@21`
- `installViewSource@29`
- `ipcHandlersSource@30`
- `mainSource@31`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `node:fs`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("skill discovery scan stays lightweight for UI by not hashing every discovered skill directory", () => {
  const scannerSource = readFileSync("src/electron/libs/skill-manager/scanner.ts", "utf8");

  assert.doesNotMatch(scannerSource, /hashDirectory/);
  assert.match(scannerSource, /fingerprint:\s*null/);
});

test("recursive skill scan skips common heavyweight dependency and build folders", () => {
  const scannerSource = readFileSync("src/electron/libs/skill-manager/scanner.ts", "utf8");

  for (const skipped of ["node_modules", ".venv", "dist", "build", "target", "vendor"]) {
    assert.match(scannerSource, new RegExp(`"${skipped.replace(".", "\\.")}"`));
  }
});

test("skill marketplace cards do not depend on remote GitHub avatar images", () => {
  const installViewSource = readFileSync("src/ui/components/settings/InstallSkillsView.tsx", "utf8");

  assert.doesNotMatch(installViewSource, /github\.com\/\$\{owner\}\.png/);
  assert.doesNotMatch(installViewSource, /<img\s/);
  assert.match(installViewSource, /getMarketSourceAvatarLabel/);
});

test("git skill import is wired through preview and confirm ipc handlers", () => {
  const installViewSource = readFileSync("src/ui/components/settings/InstallSkillsView.tsx", "utf8");
  const ipcHandlersSource = readFileSync("src/electron/libs/skill-manager/ipc-handlers.ts", "utf8");
  const mainSource = readFileSync("src/electron/main.ts", "utf8");

  assert.match(installViewSource, /skills:previewGitInstall/);
  assert.match(installViewSource, /skills:confirmGitInstall/);
  assert.match(installViewSource, /skills:cleanupGitPreview/);
  assert.doesNotMatch(installViewSource, /Git 导入功能开发中/);

  assert.match(mainSource, /handleSkillManagerInvoke/);
  assert.match(mainSource, /channel\.startsWith\("skills:"\)/);

  assert.match(ipcHandlersSource, /handleSkillManagerInvoke/);
  assert.match(ipcHandlersSource, /skills:previewGitInstall/);
  assert.match(ipcHandlersSource, /skills:confirmGitInstall/);
  assert.match(ipcHandlersSource, /execFileSync\("git", \["clone"/);
  assert.match(ipcHandlersSource, /discoverGitSkillDirs/);
  assert.match(ipcHandlersSource, /isSafeGitPreviewTempDir/);
});

```
