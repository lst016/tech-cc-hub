---
doc_id: "DOC-SPEC-SETTINGS-SKILLS"
title: "Settings / Skills 模块 Spec"
doc_type: "spec"
layer: "L4"
status: "active"
version: "1.0.0"
last_updated: "2026-05-01"
owners:
  - "tech-cc-hub Core"
audience:
  - "frontend"
  - "electron"
source_of_truth: true
supersedes: []
superseded_by: null
tags:
  - "tech-cc-hub"
  - "engineering"
  - "settings"
  - "skills"
  - "spec"
---

# Settings / Skills 模块 Spec

## Purpose

定义全局设置管理和 Skill 注册生命周期。这是用户配置 Agent 行为、API profile 和扩展能力的入口。

## Scope

- Settings UI：API profiles、Model routing、Agent rules、Skills management、System maintenance
- Skills 注册流程：git clone → symlink import → inventory → sync scheduler
- 配置持久化：`agent-runtime.json`、API profiles、skill inventory
- 不在本文档范围：PrmptInput 的 slash 命令（Chat/Composer）、IPC 通道（Electron/IPC）

## Active Entry Points

| 入口 | 文件 | 行数 |
|------|------|------|
| ApiProfilesSettingsPage | `src/ui/components/settings/ApiProfilesSettingsPage.tsx` | ~600 |
| SkillsManagementPage | `src/ui/components/settings/SkillsManagementPage.tsx` | ~600 |
| ModelRoutingSettingsPage | `src/ui/components/settings/ModelRoutingSettingsPage.tsx` | ~200 |
| SystemMaintenancePage | `src/ui/components/settings/SystemMaintenancePage.tsx` | ~300 |
| AgentRulesSettingsPage | `src/ui/components/settings/AgentRulesSettingsPage.tsx` | ~130 |
| OverviewSettingsPage | `src/ui/components/settings/OverviewSettingsPage.tsx` | ~100 |
| SettingsSheet | `src/ui/components/settings/SettingsSheet.tsx` | ~130 |
| Claude Settings (main) | `src/electron/libs/claude-settings.ts` | ~700 |
| Config Store | `src/electron/libs/config-store.ts` | ~600 |
| Skill Registry Sync | `src/electron/libs/skill-registry-sync.ts` | ~600 |
| Skill Hub | `src/electron/libs/skill-hub.ts` | — |

## Key Components

### Settings UI Layout

SettingsSheet 是设置的根容器，以右侧抽屉面板呈现。每个 SettingsPage 按标签页组织：

| 标签页 | 组件 | 功能 |
|--------|------|------|
| 概览 | OverviewSettingsPage | 版本信息、快速状态 |
| API 配置 | ApiProfilesSettingsPage | 多 profile 管理、API Key、Base URL、模型选择 |
| 模型路由 | ModelRoutingSettingsPage | 主模型/专家模型/图片模型/分析模型路由 |
| Agent 规则 | AgentRulesSettingsPage | 用户自定义 agent rule 文档编辑 |
| 技能管理 | SkillsManagementPage | Skill 导入/同步/删除/启停 |
| 系统维护 | SystemMaintenancePage | 缓存清理、数据库重置、日志导出 |
| 全局配置 | GlobalJsonSettingsPage | `agent-runtime.json` 原始编辑 |

### ApiProfilesSettingsPage

多 API profile 的 CRUD：

```typescript
type ApiConfig = {
  id: string;
  name: string;
  apiKey: string;
  baseURL: string;
  model: string;
  expertModel?: string;
  imageModel?: string;
  analysisModel?: string;
  models?: ApiModelConfig[];
  enabled: boolean;
  apiType?: "anthropic";
};
```

- 每个 profile 对应一个独立 API endpoint
- `enabled` 控制 profile 是否在会话中可用
- apiKey 以 masked 形式回显，不允许明文导出到渲染进程

### Skills 注册生命周期

```
外部 Skill 源 (git repo / 本地目录)
  → skill-registry-sync.ts: detectAndCountExternalSkills()
    → importSkillWithSymlink() — 在 ~/.claude/skills/ 下创建 symlink
      → saveSkillInventory() — 写入 inventory JSON
        → 定时 sync 调度 (DEFAULT_CHECK_INTERVAL_HOURS = 24h)
          → git pull + 增量更新
```

Skill 类型：

| 类型 | 说明 |
|------|------|
| `builtin` | 项目内置 skill（slash-command-catalog 注册） |
| `external:git` | 从 git repo 拉取的外部 skill |
| `external:manual` | 用户手动放置到 skills 目录 |

### 配置持久化

config-store.ts 统一管理所有持久化配置：

| 数据 | 文件 | 关键类型 |
|------|------|---------|
| API profiles | `{userData}/api-config.json` | ApiConfigSettings |
| 全局运行时 | `agent-runtime.json` | GlobalRuntimeConfig |
| Skill inventory | `{userData}/skill-inventory.json` | SkillInventory |
| Agent rules | `{userData}/agent-rules/` | 用户自定义 .md |

### Claude Settings Bridge

claude-settings.ts 封装 claude CLI 路径探测、配置解析和环境变量构建：

- 探测顺序：`CLAUDE_CODE_PATH` → `CLAUDE_PATH` → homebrew → `/usr/local/bin` → `~/.local/bin` → volta → `which claude`
- 构建 subprocess env：合并 API config、runtime config 的 env 字段
- getModelConfig 根据 model 名查找 contextWindow 和 compression 配置

## Data Flow

```
用户修改设置 (SettingsSheet)
  → window.electron.invoke("settings:save", patch)
    → main.ts IPC handler → config-store.ts 写文件
      → 渲染进程 re-render

用户导入 Skill (SkillsManagementPage)
  → window.electron.sendEvent({ type: "skill.import", payload: { url } })
    → ipc-handlers.ts → skill-registry-sync.ts
      → git clone → symlink → inventory 更新
        → ServerEvent 广播 skill inventory 变更
```

## Key Files

```
src/ui/components/settings/
├── SettingsSheet.tsx              # 设置抽屉根容器
├── OverviewSettingsPage.tsx       # 概览
├── ApiProfilesSettingsPage.tsx    # API 配置
├── ModelRoutingSettingsPage.tsx   # 模型路由
├── AgentRulesSettingsPage.tsx     # Agent 规则
├── SkillsManagementPage.tsx       # 技能管理
├── SystemMaintenancePage.tsx      # 系统维护
├── GlobalJsonSettingsPage.tsx     # agent-runtime.json 编辑
├── CodeEditor.tsx                 # Monaco 封装
└── settings-utils.ts              # 设置工具函数

src/electron/libs/
├── claude-settings.ts             # Claude CLI 路径/配置桥接
├── config-store.ts                # 配置持久化 (JSON 文件)
├── skill-registry-sync.ts         # Skill git sync 调度器
├── skill-hub.ts                   # Skill 目录/导入管理
└── agent-rule-docs.ts             # Agent rule 文档加载
```

## Compatibility

- 新增 API profile 字段只需扩展 ApiConfig 类型，前端自动透传
- 新增 Settings 标签页：在 SettingsSheet 注册 + 实现页面组件
- Skill 新增 source type：扩展 SkillSourceType 联合类型 + skill-registry-sync 处理分支

## Acceptance Criteria

- [ ] API profile CRUD 操作即时生效
- [ ] apiKey 不经 IPC 明文传递到渲染进程
- [ ] Skill git import 失败时有明确错误提示
- [ ] Skill sync scheduler 不阻塞主进程
- [ ] agent-runtime.json 编辑不破坏 JSON 结构
- [ ] 设置变更后运行中会话不丢失配置更新
