---
title: tech-cc-hub
version: 1.0.0
status: active
language: zh-CN
---

# tech-cc-hub

`tech-cc-hub` 是一个基于 `Electron + React + Claude Agent SDK` 的桌面端 Agent 协作客户端。  
当前方向不是重做底层 AgentOS，而是在 `Claude Code / Claude-compatible provider` 之上补齐：

- 聊天优先的桌面工作台
- 工作区内会话管理
- 执行链路观测与复盘
- 模型 / 思考强度的运行时切换
- 附件输入、slash 命令、继续会话与治理能力

这个仓库现在是在上游 `agent-cowork` 基础上持续改造，远端关系为：

- `origin`: [lst016/tech-cc-hub](https://github.com/lst016/tech-cc-hub)
- `upstream`: [DevAgentForge/agent-cowork](https://github.com/DevAgentForge/agent-cowork)

## 当前产品口径

当前客户端的默认设计原则：

- `chat-first`
  主界面优先是正常聊天，不要求手工建 task。
- `workspace-first sidebar`
  左侧按工作区组织会话，设置固定在底部。
- `execution observability`
  右侧默认展示执行指标，详细 prompt / 上下文 / 原子步骤按需展开。
- `Electron-first QA`
  验收以 Electron 真窗口为准，不以 `localhost` 页面替代客户端结论。
- `中文 UI`
  界面文案默认使用简体中文；品牌名、模型名、协议字段除外。

## 已实现能力

- 工作区分组与会话列表
- 已有工作区内一键新建会话
- 设置页多配置管理
- 模型列表动态切换
- 思考强度动态切换
- `Enter` 发送，`Shift + Enter` 换行
- 发送后输入框清空，并有短暂冷却
- 图片与文本文件附件
- slash 命令浏览与发送
- 执行中会话的右侧执行观测
- Token、时长、TTFT、费用、上下文快照、原子步骤轨迹
- Electron 客户端窗口级 QA 工具

## 近阶段更新（2026-04-26）

- 完成内置浏览器/工作台能力打通：
  - 支持内置浏览器状态、导航、截图、DOM 检索、日志读取及多工具接口
  - 标注支持左侧高亮选取、JSON 标注内容展示、与 Codex 风格一致的路径信息
  - 标注条与消息流定位优化（避免遮挡输入区）
  - 浏览器工作台集成为主界面右侧面板，并兼顾侧栏拖拽/宽度约束
- 会话与导航交互修正：
  - 新会话标题与首条内容联动，避免始终显示默认标题
  - 左右侧栏折叠/展开与按钮提示（tooltip）兼容主界面
  - 顶栏按钮与执行轨迹/会话列表布局统一化，兼容 macOS/Windows 场景
- 模型与图片处理链路升级：
  - API 模型列表由 Bridge 拉取并本地化处理，兼容 new-api 路径与控制台风格 Base URL
  - 图片输入降采样与压缩，加入图片处理中提示与失败闭环
  - 非视觉模型/不支持图片模型禁用图片预处理，失败不再继续伪造返回
- 右侧执行轨道（Activity Rail）与设置页体验补齐：
  - 细化执行细节抽屉/原始内容展示样式
  - 新增 Agent 规则设置页与浏览器工作台相关配置入口
  - 优化会话列表、设置与执行态交互的边界样式和可用性

## 技术栈

- `Electron`
- `React 19`
- `TypeScript`
- `Tailwind CSS v4`
- `Zustand`
- `better-sqlite3`
- `@anthropic-ai/claude-agent-sdk`

## 目录结构

```text
tech-cc-hub/
├── doc/                  # 产品、架构、PRD、开发规范
├── scripts/qa/           # Electron 窗口级 QA 脚本
├── src/
│   ├── electron/         # 主进程、IPC、运行时、会话存储
│   └── ui/               # React 客户端、侧栏、输入区、执行观测
├── patches/              # SDK 补丁
├── dist-electron/        # Electron 编译产物
└── dist-react/           # 前端构建产物
```

## 开发启动

先安装依赖：

```bash
npm install
```

启动桌面端开发：

```bash
npm run dev
```

常用构建命令：

```bash
npm run transpile:electron
npm run build
```

## QA 与调试

当前项目内置了 Electron 客户端级 QA 命令。

列出窗口：

```bash
npm run qa:window:list
```

抓取指定窗口截图：

```bash
npm run qa:window:capture -- <window_id> [output_path]
```

最小 smoke：

```bash
npm run qa:smoke
```

续聊回归：

```bash
npm run qa:continue
```

slash 回归：

```bash
npm run qa:slash
```

## 配置说明

当前运行配置由客户端设置页管理，支持：

- 多配置卡片
- 启用中的唯一配置
- base URL
- API Key
- 模型列表
- 默认模型

发送时会把当前选中的：

- `模型`
- `思考强度`

一起传到底层运行时。

## 文档

完整产品和开发文档在：

- [doc](/Users/lst01/Desktop/学习/tech-cc-hub/doc)

如果你从文档入口开始看，建议先看：

- [doc/README.md](/Users/lst01/Desktop/学习/tech-cc-hub/doc/README.md)
- [doc/00-overview/03-文档索引.md](/Users/lst01/Desktop/学习/tech-cc-hub/doc/00-overview/03-文档索引.md)
- [doc/40-product/40-产品开发文档索引.md](/Users/lst01/Desktop/学习/tech-cc-hub/doc/40-product/40-产品开发文档索引.md)

## 当前注意事项

- 客户端验收默认走 Electron 真窗口，不走浏览器页面。
- 右侧执行链路还会继续迭代，但当前已经具备基础观测口径。
- 仓库当前仍保留上游的一些工程结构和依赖命名，例如包名 `agent-cowork`，后续可再统一收口。

## License

MIT
