---
doc_id: "DOC-SPEC-CONFIG"
title: "全局配置模型 Spec"
doc_type: "spec"
layer: "L2"
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
  - "contracts"
  - "config"
  - "spec"
---

# 全局配置模型 Spec

## Purpose

定义 tech-cc-hub 的四类持久化配置：API 供应商配置、全局运行时配置、Skill 目录清单、Skill Lock 索引。前端和 Electron 主进程对配置的读写必须遵守本文档。

## Scope

- `api-config.json`：API 供应商 profile 管理（密钥、模型、端点）
- `agent-runtime.json`：全局运行时参数（env、skillCredentials、UI 偏好）
- `skill-inventory.json`：已安装 Skill 的清单文件和同步状态
- `.skill-lock.json`：外部 Skill 注册锁文件（跨会话 keep-in-sync）
- 不在本文档范围：Skill 的 SKILL.md 内容规范、IPC 消息中的 RuntimeOverrides 结构

## Interfaces / Types

### ApiConfigSettings

定义位置：`src/electron/libs/config-store.ts:37-39`

```typescript
type ApiConfigSettings = {
  profiles: ApiConfig[];
};
```

### ApiConfig（单个 API Profile）

```typescript
type ApiConfig = {
  id: string;           // UUID
  name: string;         // 显示名称
  apiKey: string;       // API Key（仅主进程可读）
  baseURL: string;      // API 端点，自动补全 /v1
  model: string;        // 默认模型
  expertModel?: string; // 专家模型（回退到 model）
  imageModel?: string;  // 图片模型（可选）
  analysisModel?: string; // 分析模型（回退到 model）
  models?: ApiModelConfig[]; // 可用模型列表
  enabled: boolean;     // 是否启用（首个 profile 自动启用）
  apiType?: ApiType;    // "anthropic"（当前唯一值）
};
```

### ApiModelConfig

```typescript
type ApiModelConfig = {
  name: string;
  contextWindow?: number;               // 默认 200,000
  compressionThresholdPercent?: number;  // 默认 70
};
```

### GlobalRuntimeConfig

定义位置：`src/electron/libs/config-store.ts:112`

```typescript
type GlobalRuntimeConfig = Record<string, unknown>;
```

实际字段（由 `agent-runtime.json` 的 MCP admin tool schema 约束）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `env` | `Record<string, string \| number \| boolean>` | 注入到 Agent 执行环境的变量（如 `HF_TOKEN`） |
| `skillCredentials` | `Record<string, string \| string[] \| { env: string[] }>` | Skill 到凭证变量名的映射 |
| `closeSidebarOnBrowserOpen` | `boolean` | 打开浏览器时是否自动收起侧边栏 |

### SkillInventory

```typescript
type SkillInventory = {
  rootPath: string;          // Skill 根目录（默认 ~/.claude/skills）
  skills: InstalledSkillRecord[];
};
```

### InstalledSkillRecord

```typescript
type InstalledSkillRecord = {
  id: string;
  name: string;
  kind: SkillKind;           // "single" | "bundle"
  path: string;              // 文件系统路径
  sourceType: SkillSourceType; // "manual" | "git"
  installedAt?: number;
  syncEnabled?: boolean;
  remoteUrl?: string;        // git 来源的远程 URL
  remoteSubpath?: string;    // 仓库内子路径
  branch?: string;
  lastPulledAt?: number;
  lastCheckedAt?: number;
  checkEveryHours?: number;
  lastKnownCommit?: string;
  lastError?: string;
};
```

### SkillLockIndex（内存结构，不持久化为此格式）

```typescript
type SkillLockEntry = {
  sourceUrl?: string;
  skillPath?: string;
  installedAt?: string;
  updatedAt?: string;
};
```

来源文件：`~/.agents/.skill-lock.json` 和 `~/.skill-global/.skill-lock.json`（`{ skills: Record<string, SkillLockEntry> }` 格式）。

## State / Lifecycle

### 配置文件路径

| 文件 | 路径 | 持久化时机 |
|------|------|-----------|
| `api-config.json` | `{userData}/api-config.json` | `saveApiConfigSettings()` 调用时全量写入 |
| `agent-runtime.json` | `{userData}/agent-runtime.json` | `saveGlobalRuntimeConfig()` 或 admin MCP tool 调用时 |
| `skill-inventory.json` | `{userData}/skill-inventory.json` | `saveSkillInventory()` 调用时全量写入 |
| `.skill-lock.json` | `~/.agents/.skill-lock.json`、`~/.skill-global/.skill-lock.json` | 只读（由外部工具管理） |

### API Profile 约束

- `profiles` 数组至少保留一个有效 profile
- 保存时自动归一化：去重模型列表、补全 `/v1` 路径、确保至少一个 `enabled: true`
- 删除 API config 只删除文件，不影响运行时内存

### Skill Inventory 生命周期

```
启动 → loadSkillInventory()
  ├─ skill-inventory.json 存在 → 读取 + reconcileSkillInventory()
  ├─ skill-registry.json 存在（旧格式）→ migrateLegacySkillRegistry() → reconcileSkillInventory()
  └─ 都不存在 → createDefaultSkillInventory() → reconcileSkillInventory()

reconcileSkillInventory():
  1. 扫描 rootPath 目录发现已安装 Skill（discoverInstalledSkills）
  2. 加载 .skill-lock.json 索引
  3. 合并：以文件系统为准，lock 文件补充 git 来源元数据
  4. 按名称排序输出

保存 → saveSkillInventory() → 全量写入 skill-inventory.json
```

### 全局运行时配置生命周期

```
启动 → loadGlobalRuntimeConfig() → 读 agent-runtime.json → 返回对象
MCP admin tool → set_global_runtime_config → merge(patch, remove) → save → 返回 summary
```

## Data Flow

```
用户操作 (Settings UI / MCP tool)
  → config-store.ts save*()
    → JSON.stringify → writeFileSync → {userData}/*.json

应用启动
  → config-store.ts load*()
    → readFileSync → JSON.parse → normalize*() → 返回 typed object
```

Skill 发现是双向的：
- 文件系统 → `discoverInstalledSkills()` 扫描目录 → SkillInventory
- Lock 文件 → `loadSkillLockIndex()` 读取 git 元数据 → 合并到 SkillInventory

## Error Handling

| 场景 | 处理 |
|------|------|
| API config 文件不存在 | 返回 `createDefaultSettings()`（含一个空 key 的默认 profile） |
| API config JSON 解析失败 | 返回默认配置 + console.error |
| API config 保存时 profiles 为空 | 抛出 `"Invalid config: at least one valid profile is required"` |
| agent-runtime.json 格式非对象 | 返回 `{}` + console.error |
| Skill inventory 文件不存在 | 返回空 inventory（`{ rootPath, skills: [] }`） |
| Skill lock 文件解析失败 | 静默跳过该 lock 文件 + console.warn |
| Skill 目录不存在 | 返回空 skills 数组 |
| Git sync 失败 | 记录 `lastError` 到 skill record，不影响其他 skill |

## Security / Permission Boundary

- `api-config.json` 中的 `apiKey` 字段仅存在于主进程文件系统，不出现在任何 IPC 事件 payload 中
- `agent-runtime.json` 中的 `env` 字段可能包含 token（如 `HF_TOKEN`），由 admin MCP tool 注入，不通过 IPC 广播
- Skill lock 文件由外部工具（Claude Code CLI）管理，tech-cc-hub 只读不写
- 前端 Settings UI 可通过 IPC 触发配置读写，但密钥值不会回显到 UI

## Compatibility

- `api-config.json` schema 变更：`ApiConfig` 字段只能新增可选字段
- `agent-runtime.json`：free-form object，新增 key 无需 migration
- `skill-inventory.json`：`InstalledSkillRecord` 新增字段必须可选
- `skill-registry.json`（旧格式）→ `skill-inventory.json`：自动迁移，旧文件保留不删
- Skill lock 文件格式变更：向后兼容读取，未知字段忽略

## Acceptance Criteria

- [ ] API config 至少有一个 enabled profile 时应用可正常启动
- [ ] API config 为空时自动创建默认 profile（空 key，需用户填写）
- [ ] 旧 skill-registry.json 格式自动迁移到 skill-inventory.json
- [ ] agent-runtime.json 不存在时不报错，返回空对象
- [ ] admin MCP tool 的 patch/remove 合并逻辑幂等
- [ ] apiKey 不泄露到渲染进程或日志
