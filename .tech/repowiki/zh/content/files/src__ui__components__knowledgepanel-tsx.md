# src/ui/components/KnowledgePanel.tsx

> 模块：`knowledge-ui` · 语言：`tsx` · 行数：1384

## 文件职责

知识面板主组件，集成工作区管理、生成状态追踪、Git状态显示和Wiki文档树形浏览功能

## 关键符号

- `getRoutedProfiles@0 - 根据enabled标志筛选启用的API配置Profile，若无启用则回退到第一个`
- `getWorkspaceName@0 - 从cwd路径提取工作区显示名称`
- `normalizeWorkspaceKey@0 - 标准化工作区键名格式`
- `normalizeKnowledgeWorkspace@0 - 将API响应转换为KnowledgeWorkspace类型`
- `normalizeKnowledgeDocument@0 - 规范化知识文档数据结构`
- `readStoredWorkspacePaths@0 - 从localStorage读取已存储的工作区路径列表`
- `readStoredBooleanRecord@0 - 读取布尔类型存储记录（如隐藏状态）`
- `isGenerationStatus@0 - 类型守卫，验证GenerationStatus枚举值`
- `resolveHeadFromSnapshot@0 - 从快照数据解析Git HEAD信息`
- `applyGitBinding@0 - 应用Git绑定状态到生成进度`
- `Toggle@0 - 可复用开关组件`
- `ProgressBlock@0 - 生成进度展示区块`
- `SectionTree@0 - 文档树形导航组件`
- `WikiDocumentView@0 - Wiki文档内容查看组件`
- `KnowledgePanel@0 - 主入口组件，组合上述子组件实现完整功能`

## 依赖输入

- `react`
- `lucide-react`
- `../store/useAppStore`
- `../types`

## 对外暴露

- `KnowledgePanel`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  ChevronDown,
  FolderPlus,
  GitBranch,
  Lightbulb,
  MoreVertical,
  Network,
  PauseCircle,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import type { ApiConfigProfile, SettingsPageId } from "../types";

type KnowledgePanelProps = {
  onBack: () => void;
  onOpenSettings?: (pageId?: SettingsPageId) => void;
};

type GenerationStatus = "idle" | "generating" | "paused" | "completed";

type GenerationState = {
  status: GenerationStatus;
  completed: number;
  total: number;
  processing: number;
  failed: number;
  commitId?: string;
  commitShortHash?: string;
  branch?: string | null;
  updatedAt?: number;
};

type KnowledgeWorkspace = {
  key: string;
  cwd?: string;
  name: string;
  sessionCount: number;
  source: "session" | "manual";
  updatedAt: number;
};

type KnowledgeDocument = {
  id: string;
  workspaceKey: string;
  section: string;
  title: string;
  content: string;
  sortOrder: number;
  updatedAt: number;
};

type KnowledgeListResponse = {
  workspaces?: Array<{
    key?: string;
    cwd?: string;
    name?: string;
    source?: "session" | "manual";
    updatedAt?: number;
  }>;
  generations?: Record<string, GenerationState>;
};

type KnowledgeWorkspaceRecord = NonNullable<KnowledgeListResponse["workspaces"]>[number];

type KnowledgeDocumentsResponse = {
  documents?: KnowledgeDocument[];
};

type KnowledgeRunGenerationResponse = {
  success?: boolean;
  generation?: GenerationState;
  documents?: unknown[];
  report?: {
    success?: boolean;
    message?: string;
    error?: string;
    indexedDocuments?: number;
    indexedChunks?: number;
    generatedFiles?: string[];
  };
  error?: string;
};

type KnowledgeGitState = {
  loading: boolean;
  hasGit: boolean;
  branch: string | null;
  commitId: string;
  commitShortHash: string;
  changedCount: number;
  error?: string;
};

const KNOWLEDGE_WORKSPACES_STORAGE_KEY = "tech-cc-hub:knowledge-panel-workspaces";
const KNOWLEDGE_HIDDEN_WORKSPACES_STORAGE_KEY = "tech-cc-hub:knowledge-panel-hidden-workspaces";
const KNOWLEDGE_AUTO_UPDATE_STORAGE_KEY = "tech-cc-hub:knowledge-panel-auto-update";
const GIT_REFRESH_INTERVAL_MS = 30_000;
const GIT_SNAPSHOT_TIMEOUT_MS = 4_000;

function getRoutedProfiles(profiles: ApiConfigProfile[]): ApiConfigProfile[] {
  const enabled = profiles.filter((profile) => profile.enabled);
  return enabled.length > 0 ? enabled : profiles.slice(0, 1);
}

function getWorkspaceName(cwd?: string): string {
  if (!cwd) return "当前工作区";
  const parts = cwd.split(/[\\/]+/).filter(Boolean);
  return parts.at(-1) || cwd;
}

function getWorkspaceParentPath(cwd?: string): string {
  if (!cwd) return "";
  const parts = cwd.split(/[\\/]+/).filter(Boolean);
  if (parts.length <= 1) return cwd;
  return parts.slice(0, -1).join("/");
}

function normalizeWorkspaceKey(cwd?: string | null): string {
  return cwd?.trim() ?? "";
}

function normalizeKnowledgeWorkspace(input: KnowledgeWorkspaceRecord): KnowledgeWorkspace | undefined {
  const key = normalizeWorkspaceKey(input.key ?? input.cwd);
  if (!key) return undefined;
  return {
    key,
    cwd: input.cwd ?? key,
    name: input.name?.trim() || getWorkspaceName(input.cwd ?? key),
    sessionCount: 0,
    source: input.source === "session" ? "session" : "manual",
    updatedAt: Number.isFinite(input.updatedAt) ? Number(input.updatedAt) : 0,
  };
}

function normalizeKnowledgeDocument(input: unknown): KnowledgeDocument | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const raw = input as Partial<KnowledgeDocument>;
  const id = typeof raw.id === "string" ? raw.id : "";
  const workspaceKey = typeof raw.workspaceKey === "string" ? raw.workspaceKey : "";
  const section = typeof raw.section === "string" ? raw.section : "";
  const title = typeof raw.title === "string" ? raw.title : "";
  const content = typeof raw.content === "string" ? raw.content : "";
  if (!id || !workspaceKey || !title) return undefined;
  return {
    id,
    workspaceKey,
... (truncated)
```
