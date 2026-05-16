# src/ui/components/SettingsModal.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：579

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `getCloseSidebarOnBrowserOpen@171`
- `normalizeAgentRuleDocuments@175`
- `validateGlobalConfigText@179`
- `parseGlobalConfig@196`
- `SettingsModal@207`
- `trimmed@181`
- `parsed@187`
- `parseError@198`
- `setApiConfigSettings@213`
- `electronApi@227`
- `loadSettings@237`
- `normalizedGlobalSettings@248`
- `normalizedProfiles@253`
- `globalConfigText@261`
- `normalizedRuleDocuments@265`
- `handleDevBridgeReady@283`
- `refreshAgentRuleDocuments@291`
- `ruleDocuments@296`
- `normalizedRuleDocuments@299`
- `enabledProfile@309`
- `pages@311`
- `updateProfiles@338`
- `handleGlobalConfigChange@344`
- `parsed@348`
- `handleUserAgentMarkdownChange@354`
- `handleCloseSidebarOnBrowserOpenChange@359`
- `parseError@361`
- `parsed@366`
- `nextConfig@367`
- `nextText@371`
- `handleStartGuideSession@376`
- `handleFormatGlobalConfig@395`
- `parsed@398`
- `handleSave@406`
- `normalizedProfiles@408`
- `normalizedGlobalConfig@409`
- `globalError@410`
- `profileError@411`
- `nextProfiles@426`
- `content@476`

## 依赖输入

- `react`
- `sonner`
- `../dev-electron-shim`
- `../store/useAppStore`
- `../types`
- `./settings/ApiProfilesSettingsPage`
- `./settings/AgentRulesSettingsPage`
- `./settings/ChannelsSettingsPage`
- `./settings/GlobalJsonSettingsPage`
- `./settings/ModelRoutingSettingsPage`
- `./settings/SettingsSheet`
- `./settings/SkillsManagementPage`
- `./settings/PluginsSettingsPage`
- `./settings/McpSettingsPage`
- `./settings/AboutPage`
- `./settings/settings-utils`
- `../../shared/lark-runtime-defaults.js`

## 对外暴露

- `SettingsModal`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  DEV_BRIDGE_READY_EVENT,
  getDevElectronRuntimeSource,
  type DevElectronRuntimeSource,
} from "../dev-electron-shim";

import { useAppStore } from "../store/useAppStore";
import type {
  ApiConfigProfile,
  AgentRuleDocuments,
  SettingsPageId,
} from "../types";
import { ApiProfilesSettingsPage } from "./settings/ApiProfilesSettingsPage";
import { AgentRulesSettingsPage } from "./settings/AgentRulesSettingsPage";
import {
  ChannelsSettingsPage,
  getChannelSettingsSummary,
  type ChannelGuideSessionRequest,
} from "./settings/ChannelsSettingsPage";
import { GlobalJsonSettingsPage } from "./settings/GlobalJsonSettingsPage";
import { ModelRoutingSettingsPage } from "./settings/ModelRoutingSettingsPage";
import { SettingsSheet, type SettingsPageDefinition } from "./settings/SettingsSheet";
import { SkillsManagementPage } from "./settings/SkillsManagementPage";
import { PluginsSettingsPage } from "./settings/PluginsSettingsPage";
import { McpSettingsPage } from "./settings/McpSettingsPage";
import { AboutPage } from "./settings/AboutPage";
import {
  buildRoutingSummary,
  createProfile,
  getEnabledProfile,
  normalizeProfile,
  validateProfiles,
} from "./settings/settings-utils";
import { ensureLarkCliRuntimeDefaults } from "../../shared/lark-runtime-defaults.js";

interface SettingsModalProps {
  onClose: () => void;
  initialPageId?: SettingsPageId;
  onStartMaintenanceSession: (prompt: string, options?: SystemSessionLaunchOptions) => Promise<void>;
}

type GlobalRuntimeConfig = Record<string, unknown>;

type SystemSessionLaunchOptions = {
  titleHint?: string;
  agentId?: string;
  allowedTools?: string;
};

const DEFAULT_AGENT_RULE_DOCUMENTS: AgentRuleDocuments = {
  systemDefaultMarkdown: [
    "# tech-cc-hub 系统默认规则",
    "",
    "这部分由应用内置生成，只用于展示当前软件默认加载的系统级 Agent 规则，不会写入用户目录。",
    "",
    "## 内置浏览器默认规则",
    "",
    "默认要求：涉及网页查看、抓取、调试、标注、截图的场景，默认优先使用 Electron 内置浏览器工作台（BrowserView）。",
    "",
    "禁止默认走外部 browse skill。请优先用浏览器 MCP（browser_get_state / browser_extract_page / browser_capture_visible ...）。",
    "",
    "设计还原默认规则：只要用户提供截图、Figma 图、页面参考图，并要求生成或修改 UI/前端代码，请优先使用设计 MCP。单张参考图先用 design_inspect_image 生成结构化视觉摘要；已有页面后再用 design_capture_current_view / design_compare_current_view / design_compare_images 生成当前截图、三栏比照图、差异图和 JSON report，再根据 differenceRatio、diffBoundingBox、topDiffRegions 修 UI。动态区域用 ignoreRegions，验收阈值用 maxDifferenceRatio。后续轮次先用 design_list_artifacts 找回产物，再用 design_read_comparison_report 读取历史 report。",
    "",
    "## 自动优化沉淀默认规则",
    "",
    "自动优化或复盘后，稳定规则类内容必须进入 Rules，而不是 Memory。Rules 包括长期行为约束、默认策略、工具调用政策、项目约定、命名规范、验收口径和禁止项。",
    "",
    "Memory 只用于记录最近做了什么、当前状态、未完成事项、风险、接手线索和短期事实，不承载长期规则或方法论。",
    "",
    "如果优化建议可以沉淀成可复用流程、模板、脚本、触发条件或输入输出协议，优先建议新增或优化 Skills；Rules 只保留何时使用这些 Skills 的触发约束。",
    "",
    "当一条内容同时像 Rules 和 Memory 时，优先归入 Rules；同时像 Rules 和 Skills 时，把约束放 Rules，把执行细节放 Skills。",
    "",
    "## 工具调用优化默认规则",
    "",
    "已知多个具体文件需要查看时，优先并发读取，不要串行一个个 Read。",
    "",
    "目标文件不明确时，先用一次只读 Bash 搜索/筛选收敛范围，例如 rg/find/sed/awk，再读取少量命中文件。",
    "",
    "避免碎片链路：ls -> cat -> grep -> cat。能用一次 rg 或一次批量只读命令得到结论时，不要拆成多次工具调用。",
    "",
    "只读批量操作可以合并；写入、删除、移动、安装、提交等有副作用操作不要混进批量 Bash。",
    "",
    "复盘时如果发现同目录串行多次 Read、重复 Bash、ls/cat/grep 链路，应优先建议改成并发读取或先搜索收敛。",
    "",
    "## Karpathy Coding Guardrails 默认规则",
    "",
    "来源：https://github.com/forrestchang/andrej-karpathy-skills/blob/main/CLAUDE.md",
    "",
    "编码前先澄清假设、歧义和取舍；不确定时要显式说明，不要假装已经理解。",
    "",
    "优先选择能解决问题的最小实现；不要增加用户没有要求的功能、抽象、配置项或防御性复杂度。",
    "",
    "修改必须外科手术式收敛；只触碰完成本次请求必需的代码，匹配现有风格，不顺手重构无关区域。",
    "",
    "多步骤任务需要先定义可验证的成功标准；修 bug 和重构应优先有复现/验收路径，再进入实现闭环。",
  ].join("\n"),
  userClaudeRoot: "~/.claude",
  userAgentsPath: "~/.claude/CLAUDE.md",
  userAgentsMarkdown: "",
};

const SETTINGS_PAGES: SettingsPageDefinition[] = [
  {
    id: "profiles",
    label: "AI接口",
    eyebrow: "API",
    title: "AI接口",
    description: "维护 API 网关、密钥、模型池，并定义默认主模型和角色模型的分工方式。",
    summary: "网关、密钥、模型池",
  },
  {
    id: "channels",
    label: "渠道连接",
    eyebrow: "CHANNELS",
    title: "渠道连接",
    description: "配置 Telegram、飞书/Lark 和其他远程聊天入口。",
... (truncated)
```
