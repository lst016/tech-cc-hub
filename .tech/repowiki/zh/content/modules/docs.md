# docs

> 包含项目的技术规格说明和实现计划文档，用于指导 Figma MCP 插件等功能的开发

docs 模块存放项目的规划和设计文档，按照 superpowers 目录结构组织。plans 子目录包含具体的实现计划（implementation plans），specs 子目录包含设计规格说明（design specifications）。这些文档描述了待开发功能的目标、架构、技术栈、文件结构和具体任务步骤。

## 文件

### `docs/superpowers/plans/2026-05-10-figma-official-mcp-plugin.md`

Figma 官方 MCP 插件的详细实现计划，包含架构设计、文件结构、需要创建或修改的文件清单，以及具体的 Task 步骤

- `superpowers:subagent-driven-development` (concept) - 子代理驱动开发模式，用于分配任务给子代理
- `superpowers:executing-plans` (concept) - 执行计划模式，直接按步骤执行计划
- `Chunk 1: 外部 MCP 解析层` (section) - 计划的第一部分，定义外部 MCP 服务器的解析逻辑
- `external-mcp-servers.ts` (file) - 需要新建的运行时 helper，负责解析全局 mcpServers，支持 stdio 和 HTTP 两种 transport

### `docs/superpowers/specs/2026-05-10-figma-official-mcp-plugin-design.md`

Figma 官方 MCP 插件的设计规格说明，定义目标、范围、技术方案、架构和插件状态机

- `工作流 A` (concept) - Figma 链接/Frame -> 设计上下文 -> UI 实现的核心工作流
- `工作流 C` (concept) - 未来的扩展工作流，包含设计上下文读取、写入 Figma canvas、live UI 捕获等
- `Plugin State Machine` (concept) - 插件状态机：not-configured -> configured -> needs-auth -> auth-expired
- `stdio transport` (concept) - 标准输入输出模式的 MCP 服务器配置
- `http transport` (concept) - HTTP 传输模式的 MCP 服务器配置（Figma 使用此模式）
- `OAuth token` (concept) - Figma 官方 MCP 使用的认证机制，涉及 token 过期提醒

## 关键概念

- **MCP (Model Context Protocol)**: 模型上下文协议，用于扩展 AI agent 的工具能力。tech-cc-hub 支持 stdio 和 HTTP 两种 transport 模式的 MCP 服务器
- **外部 MCP 归一化**: 将不同类型的 MCP 配置（stdio/http, enabled/disabled）统一解析，供 runner、IPC 列表和测试共用同一套逻辑
- **插件级体验**: 将 Figma MCP 作为内置插件集成，在插件设置页展示专用卡片和状态，提供类似 Open Computer Use 的用户体验
- **Token 过期处理**: Figma 官方 MCP 使用 OAuth 认证，需要区分插件安装失败和 token 过期两种情况，避免误判
- **轻量抽象**: 不重写完整的插件系统，沿用现有的 SettingsModal 和 IPC 形态，只做必要的插件页扩展

## 内部关系

- `docs/superpowers/plans/2026-05-10-figma-official-mcp-plugin.md` → `docs/superpowers/specs/2026-05-10-figma-official-mcp-plugin-design.md`: 实现计划引用设计规格作为参考，设计规格定义目标，计划定义实现路径
- `docs/superpowers/specs/2026-05-10-figma-official-mcp-plugin-design.md` → `src/electron/libs/external-mcp-servers.ts`: 设计规格要求新建 external-mcp-servers.ts 来归一化解析外部 MCP 配置
