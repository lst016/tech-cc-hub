# v0.1.41 版本更新记录

## 与上一版 Release 的核心差异

上一版正式 Release 是 `v0.1.40`，发布时间为 2026-05-29。它主要聚焦运行时选择器 UI：把 Composer 里的模型和 reasoning 控件合并成一个白色菜单，并确保选项来自真实配置，而不是展示虚构的模型档位。

v0.1.41 的改动范围明显更大，已经从单一 UI 调整扩展为 Claude Code 兼容体系、后台运行可靠性、浏览器自动化、Provider 配置隔离、安全护栏、Cron/MCP 调度和发布门禁的综合升级。这个版本更接近一次能力面扩展和稳定性加固，而不是普通补丁。

## 主要新增与改进

### Claude Code 兼容体系

- 新增 Claude Code 变更同步、事实分类和兼容性登记能力，用于跟踪 Claude Code 版本变化对产品能力的影响。
- 增加 Windows/WSL Claude Code 兼容 QA 路径，覆盖平台差异、命令执行和运行时配置风险。
- 增加 release gate，避免 Claude Code 兼容信息漂移后仍然发布。
- 校验模型 reasoning effort 与 provider 能力是否匹配，减少配置可选项和真实运行能力不一致的问题。
- 在设置里体现插件默认值和依赖关系，让 Claude Code 相关运行环境更可解释。

### 后台任务与长会话可靠性

- 修复 SDK 返回空结果时任务被误判完成的问题；现在会继续推进，而不是留下“成功但没有内容”的假完成状态。
- 增加后台 agent 状态暴露能力，让长任务、并行任务和可恢复任务更容易追踪。
- 默认隔离并行 agent 工作区，降低多个任务同时运行时互相污染文件状态的风险。
- 恢复 Composer 控件，并隔离 agent transcript，避免不同运行轨迹混在同一个可见上下文里。

### BrowserWorkbench 与浏览器自动化

- 新增 BrowserWorkbench 自动化工作台，提供浏览器录制、回放和自动化执行基础能力。
- 在 Windows 上改为通过打包后的 Playwright CLI 路径启动 runner，减少本地环境差异导致的浏览器自动化失败。
- 合并到 `main` 时保留兼容分支里的新版 `browser-manager.ts`，使 BrowserWorkbench 和 Chrome 集成能力保持完整。

### Provider 配置与运行时隔离

- 修复 provider profile 污染问题，避免一个 provider 的模型、配置或运行状态影响另一个 provider。
- 桌面提醒改为只跟实际拥有该运行时状态的 provider 绑定，减少错误提醒和跨配置串扰。
- 移除会话 UI 里的 SDK 成本估算展示，避免把内部 token 估计误呈现为真实计费数据。

### 安全护栏

- 增加敏感信息脱敏能力，覆盖常见 API key、token、password、authorization 等字段和字符串形态。
- 增加可执行配置文件写入风险识别，例如 shell rc、PowerShell profile、包管理器配置、husky 和 devcontainer 配置。
- 增加危险命令分类，重点识别高风险 `rm -rf` 场景并要求更谨慎的确认路径。

### Cron 与 MCP 调度

- 完善 Cron/MCP job 覆盖，补齐显式 trigger source，降低任务触发来源丢失或误判的风险。
- 修复 cron 数据库测试里的 row 类型，保证 Electron test build 在集成后仍然可以稳定编译。

## 合并信息

- 已将 `origin/claude-code-compat-2161` 合并到 `main`。
- 合并提交：`df312a7`
- 目标分支提交：`e69ab9a`
- 远端 `origin/main` 已确认包含 `e69ab9a`。

## 合并冲突处理

- `src/electron/browser-manager.ts` 与 `main` 发生冲突。
- 处理方式：保留兼容分支版本，因为该版本包含 BrowserWorkbench、Chrome 集成和 Claude Code 兼容链路需要的新实现。
- 合并后补充 `test/electron/cron-db.test.ts` 类型修正，确保测试编译通过。

## 验证记录

- `npm run transpile:electron`
- `npm run build`
- `npm run test:electron:build`
- 变更范围 ESLint：`0 errors`，仅剩既有 warnings。

## 已知遗留

- 全量 `npm run lint` 仍包含历史遗留噪声，包括临时目录忽略提示和既有 lint warnings；本次变更范围内未引入新的 ESLint error。
