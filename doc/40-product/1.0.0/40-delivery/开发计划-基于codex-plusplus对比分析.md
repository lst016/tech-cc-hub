# tech-cc-hub 迭代开发计划
**基于 codex-plusplus 对比分析 — 2026-05-01**

---

## 一、优先级分类

| 优先级 | 特征 | 对应本文章节 |
|--------|------|-------------|
| P0 | 不做会卡死其他功能 | 二 |
| P1 | 明显提升产品竞争力 | 三 |
| P2 | 长期有价值，但不紧急 | 四 |

---

## 二、P0 — 阻断项（立即开始）

### P0-1：Phase 3 结构化输出替换正则解析

**来源：** 迭代计划文档（`doc/40-product/1.0.0/40-delivery/68-迭代计划-SDK能力进化与右栏深化.md`）
**状态：** 未开始
**依赖：** Phase 1 + Phase 2 已完成

```
Task 3.1：在 src/electron/libs/runner.ts 按场景启用 outputFormat
Task 3.2：替换 ActivityRail model 中的正则解析为结构化数据
预计工期：1-2 天
```

### P0-2：Git Push 待处理

**来源：** AGENTS.md 当前接力上下文
**状态：** commit `46cfae5` 未推送到远端

```bash
# 立即执行
cd /Users/lst01/Desktop/学习/tech-cc-hub
git push origin main
```

---

## 三、P1 — 提升产品竞争力

### P1-1：技能系统插件化改造

**目标：** 借鉴 codex-plusplus 的 tweak manifest 规范，让 skill 系统支持热插拔

**具体任务：**

| Task | 内容 | 工期 |
|------|------|------|
| P1-1.1 | 设计 skill manifest schema（参考 tweak manifest）：`id`, `version`, `githubRepo`, `author`, `permissions`, `scope` | 0.5天 |
| P1-1.2 | 重构 `skill-registry-sync.ts`，支持从本地 `<userData>/skills/` 目录扫描发现 | 1天 |
| P1-1.3 | 实现 `skill lifecycle`：添加 `start(skillApi)` / `stop()` 生命周期钩子 | 1天 |
| P1-1.4 | 实现 `reloadSkills()` 热重载（参考 tweak-lifecycle.ts `reloadTweaks()`） | 0.5天 |
| P1-1.5 | Skill 设置 UI：展示已安装 skill 列表，支持启用/禁用/配置 | 1天 |

**参考代码：** `codex-plusplus/packages/runtime/src/tweak-lifecycle.ts`

### P1-2：GitHub Release 更新检测

**目标：** skill 支持从 GitHub Releases 自动检测版本更新

**具体任务：**

| Task | 内容 | 工期 |
|------|------|------|
| P1-2.1 | 在 `skill-registry-sync.ts` 添加 `checkSkillUpdates()` 方法，调用 GitHub Releases API | 0.5天 |
| P1-2.2 | 在 Skill UI 显示"更新可用"标记，链接到 GitHub release diff | 0.5天 |
| P1-2.3 | Cron 调度改为每日检查一次（避免 GitHub rate limit） | 0.5天 |

**参考代码：** `codex-plusplus/packages/runtime/src/mcp-sync.ts`（GitHub Release 检查逻辑）

### P1-3：BrowserView Remote Debugging 支持

**目标：** 给内置浏览器加一个可选的 remote debugging port，方便外接 Playwright/Selenium 做自动化测试

| Task | 内容 | 工期 |
|------|------|------|
| P1-3.1 | 在 `browser-manager.ts` 添加 `--remote-debugging-port` Chromium flag | 0.5天 |
| P1-3.2 | 在 Settings 加一个"开发者选项"面板，可开关 remote debugging | 0.5天 |
| P1-3.3 | 写一个 demo：用 Playwright 连接 BrowserView 做截图 | 0.5天 |

**参考代码：** `codex-plusplus/packages/runtime/src/main.ts`（`CODEXPP_REMOTE_DEBUG` 逻辑）

### P1-4：ActivityRail 体验打磨（Phase 4）

**目标：** Phase 3 完成后，开始 Phase 4 的 3 个体验打磨 task

| Task | 内容 | 工期 |
|------|------|------|
| P1-4.1 | Task 4.1：ActivityRail 节点动画优化 | 1天 |
| P1-4.2 | Task 4.2：EventCard 详情展开交互 | 1天 |
| P1-4.3 | Task 4.3：执行耗时 heatmap 可视化 | 1天 |

**来源：** 迭代计划文档 Phase 4

---

## 四、P2 — 长期价值建设

### P2-1：CLI 安装器

**目标：** 支持 `curl | bash` 一键安装，借鉴 codex-plusplus 的 install.sh/install.ps1

| Task | 内容 | 工期 |
|------|------|------|
| P2-1.1 | 写 `install.sh`（macOS/Linux）：检测 Electron/Node 版本，下载 release 包 | 1天 |
| P2-1.2 | 写 `install.ps1`（Windows） | 1天 |
| P2-1.3 | 写 `update.sh` / `update.ps1`：增量更新 | 0.5天 |
| P2-1.4 | 写 uninstall 脚本（清理 app + 用户数据） | 0.5天 |

**参考代码：** `codex-plusplus/install.sh` + `install.ps1`

### P2-2：MCP Server 导出能力

**目标：** 把 tech-cc-hub 内置的 browser/design/admin MCP tools 暴露给其他 Agent runtime

| Task | 内容 | 工期 |
|------|------|------|
| P2-2.1 | 设计 `mcp-exporter.ts`：把 skill 的 MCP server 声明导出为标准 JSON | 1天 |
| P2-2.2 | 在 Settings 加"MCP 导出"页：显示可导出的 tools，复制配置 | 0.5天 |
| P2-2.3 | 支持导入外部 MCP server 到 tech-cc-hub | 1天 |

**参考代码：** `codex-plusplus/packages/runtime/src/mcp-sync.ts`

### P2-3：Session 分析增强

**目标：** 借鉴 SessionAnalysisPage 的数据模型，添加更多分析维度

| Task | 内容 | 工期 |
|------|------|------|
| P2-3.1 | Token 消耗趋势图（按天/周/月） | 1天 |
| P2-3.2 | Top tools 使用排行榜 | 0.5天 |
| P2-3.3 | 导出分析报告为 Markdown/PDF | 1天 |

### P2-4：寄生模式预研（长期）

**目标：** 如果未来要支持"在别的 app 里运行 tech-cc-hub 技能"，参考 codex-plusplus 的 ASAR patching 方案

| Task | 内容 | 工期 |
|------|------|------|
| P2-4.1 | 研究 Electron ASAR patching 机制（asar.ts + codesign.ts） | 2天 |
| P2-4.2 | 原型验证：能否在 VS Code / JetBrains 里嵌入 tech-cc-hub runtime | 5天 |
| P2-4.3 | 设计"寄生模式"插件 API（参考 TweakApi） | 3天 |

**参考代码：** `codex-plusplus/packages/installer/src/asar.ts` + `codesign.ts`

---

## 五、立即执行清单

```bash
# 1. Push 待发代码
cd /Users/lst01/Desktop/学习/tech-cc-hub && git push origin main

# 2. 开始 Phase 3（需先读迭代计划文档）
# doc/40-product/1.0.0/40-delivery/68-迭代计划-SDK能力进化与右栏深化.md

# 3. 本地验证 Phase 2 bug fix
npm run test:activity-rail-model
```

---

## 六、文件索引

| 文件 | 说明 |
|------|------|
| `/Users/lst01/Desktop/agent/workspace/codex-plusplus/VS-tech-cc-hub-对比分析.md` | 完整对比分析文档 |
| `doc/40-product/1.0.0/40-delivery/68-迭代计划-SDK能力进化与右栏深化.md` | SDK 迭代计划 |
| `AGENTS.md` | 当前接力上下文 |
