# 阅读指南

这是一个 Electron 桌面代理工作台项目，集成了会话管理、任务执行、浏览器预览、模型路由、Wiki知识管理和LLM多提供商编排。按以下顺序阅读可帮助你从宏观到微观理解系统架构。

## 第 1 步：项目概览与架构蓝图 (~10 min)

**文件:** `README.md`, `doc/README.md`, `pro-workflow/README.md`

先通读项目根目录README了解整体定位，再看doc/README.md理解文档体系，最后细读pro-workflow/README.md深入了解Desktop Agent的核心功能组合。关注：项目目标、核心模块划分、工作流程。

## 第 2 步：构建与类型系统配置 (~8 min)

**文件:** `package.json`, `tsconfig.json`, `vite.config.ts`, `pro-workflow/tsconfig.json`

了解项目依赖、构建脚本和TypeScript配置。package.json中的scripts定义运行入口，tsconfig.json确定类型检查策略，vite.config.ts揭示前端构建方式。重点关注monorepo组织结构和模块间引用关系。

## 第 3 步：Pro-workflow入口脚本 (~10 min)

**文件:** `pro-workflow/scripts/commit-validate.js`, `pro-workflow/scripts/config-watcher.js`, `pro-workflow/scripts/cwd-changed.js`, `pro-workflow/config.json`

这三个入口脚本是pro-workflow的核心机制：commit-validate处理提交验证、config-watcher监控配置变更、cwd-changed处理目录切换。结合config.json理解工作流配置驱动的设计理念。

## 第 4 步：Electron运行时核心 (~8 min)

**文件:** `src/electron/libs/git/README.md`, `src/electron/libs/mcp-tools/README.md`, `src/electron/libs/task/README.md`

通过README了解Electron主进程提供的三大核心库：git操作、mcp工具集成、任务执行引擎。这构成桌面代理的基础能力层，是理解系统如何与外部世界交互的关键。

## 第 5 步：任务引擎模块(task-engine) (~15 min)

**文件:** `task-engine模块的28个高价值文件`

task-engine是项目最核心的模块之一，包含28个高价值文件。理解任务定义、执行引擎、状态管理、错误处理等核心机制。这是整个系统的执行中枢。

## 第 6 步：会话生命周期(session-engine) (~10 min)

**文件:** `session-engine模块文件`

管理Session创建、消息持久化、浏览器隔离上下文和工作流钩子。理解如何在一个长生命周期中维护用户状态和上下文连续性。

## 第 7 步：知识与工具生态 (~12 min)

**文件:** `knowledge-engine模块文件`, `mcp-tools模块文件`, `git-workbench模块文件`

knowledge-engine提供知识管理能力，mcp-tools是MCP协议工具集成，git-workbench处理Git操作。理解这些模块如何为Agent提供外部能力扩展。

## 第 8 步：UI组件层(ui-shell) (~10 min)

**文件:** `ui-shell模块文件`, `package/README.md`

ui-shell整合聊天会话、任务执行、浏览器预览、模型路由等功能。package模块封装了Claude Agent SDK。理解前端视图层如何与后端引擎通信。

## 第 9 步：共享与公共模块 (~8 min)

**文件:** `shared模块文件`, `common模块文件`

shared提供数据类型定义、业务逻辑工具函数和工作流解析；common提供通用工具、类型定义、IPC通信适配器和配置管理。这些是贯穿全系统的公共能力。

## 第 10 步：技能与自动化(skills) (~6 min)

**文件:** `skills模块文件`

skills模块提供可复用的自动化工作流技能，包括Git操作、GitHub API调用和Release管理。这是项目将核心能力落地到实际工程实践的最后一环。

## 提示

- 这是一个monorepo结构，模块间存在依赖关系，阅读时应注意箭头指向
- doc/adr目录下有架构决策记录(ADR)，对于理解关键设计选择非常有价值
- 测试目录test/electron包含核心功能验证，是理解系统行为的绝佳入口
- pro-workflow是系统的用户面向层，而electron-runtime是真正的运行时核心
- 如果时间有限，优先完成步骤1、2、5、6，这四步覆盖了从入口到核心的全链路
