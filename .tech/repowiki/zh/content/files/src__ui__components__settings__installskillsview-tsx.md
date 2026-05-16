# src/ui/components/settings/InstallSkillsView.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：1100

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `getMarketSourceAvatarLabel@56`
- `InstallSkillsView@68`
- `MARKET_PAGE_SIZE@14`
- `MARKET_SEARCH_STEP@16`
- `MARKET_SEARCH_DEBOUNCE_MS@17`
- `owner@58`
- `parts@60`
- `marketListRef@85`
- `marketSkillsLengthRef@86`
- `electronApi@100`
- `invoke@104`
- `installedSourceRefs@112`
- `set@113`
- `deferredQuery@123`
- `timer@125`
- `query@134`
- `loadingMore@136`
- `stale@143`
- `request@145`
- `message@157`
- `runScan@171`
- `result@175`
- `message@178`
- `installLocalSource@193`
- `name@194`
- `toastId@195`
- `handleLocalFolderInstall@208`
- `paths@211`
- `handleLocalFileInstall@218`
- `paths@221`
- `handleBatchImportFolder@231`
- `paths@234`
- `toastId@236`
- `result@238`
- `preview@241`
- `remaining@242`
- `detail@243`
- `handleImportDiscovered@257`
- `next@269`
- `handleImportAllDiscovered@275`

## 依赖输入

- `react`
- `lucide-react`
- `sonner`
- `../../types`
- `./skill-utils`

## 对外暴露

- `InstallSkillsView`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
// Source: CV from skills-manager views/InstallSkills.tsx
// Adapted: Tauri API → Electron IPC, react-router → props, i18n → Chinese
// Omitted: SkillsMP AI search, source overflow measurement, event-based progress, external URL opener
// Git import is wired through Electron IPC preview/confirm handlers.
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  DownloadCloud, UploadCloud, Box, Star, TrendingUp, Clock,
  FolderUp, Loader2, RefreshCw, FolderSearch, FolderInput,
  Search, ExternalLink, ChevronLeft, ChevronRight, GitBranch,
} from "lucide-react";
import { toast } from "sonner";
import type { ManagedSkill, ToolInfo, ScanResult, BatchImportResult } from "../../types";
import { cn } from "./skill-utils";

const MARKET_PAGE_SIZE = 24;
const MARKET_SEARCH_STEP = 60;
const MARKET_SEARCH_DEBOUNCE_MS = 450;

// Upstream SkillsShSkill shape (from skills.sh marketplace)
interface SkillsShSkill {
  id: string;
  skill_id: string;
  name: string;
  source: string;
  description?: string;
  installs: number;
}

type GitPreviewResult = {
  temp_dir: string;
  skills: Array<{ dir_name: string; name: string; description: string | null }>;
};

type GitInstallSelection = {
  dir_name: string;
  name: string;
  description: string | null;
  selected: boolean;
};

type GitInstallResult = {
  installed: number;
  updated: number;
  skipped: number;
  errors: string[];
};

interface Props {
  skills: ManagedSkill[];
  tools: ToolInfo[];
  scanResult: ScanResult | null;
  onRefresh: () => void;
  onScanResult: (result: ScanResult | null) => void;
  onNavigate: (tab: "my-skills") => void;
}

function getMarketSourceAvatarLabel(source: string): string {
  const owner = source.split("/")[0]?.replace(/^@/, "").trim();
  if (!owner) return "S";

  const parts = owner.split(/[-_\s]+/).filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  }

  return owner.slice(0, 2).toUpperCase();
}

export function InstallSkillsView({ skills, tools: _tools, scanResult, onRefresh, onScanResult, onNavigate }: Props) {
  const [activeTab, setActiveTab] = useState<"market" | "local" | "git">("local");

  // Market state
  const [marketTab, setMarketTab] = useState<"hot" | "trending" | "alltime">("alltime");
  const [marketQuery, setMarketQuery] = useState("");
  const [marketSourceFilter, setMarketSourceFilter] = useState("all");
  const [marketSkills, setMarketSkills] = useState<SkillsShSkill[]>([]);
  const [marketPage, setMarketPage] = useState(1);
  const [marketSearchLimit, setMarketSearchLimit] = useState(MARKET_SEARCH_STEP);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketLoadingMore, setMarketLoadingMore] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [installingMarketRefs, setInstallingMarketRefs] = useState<Set<string>>(new Set());
  const [marketReloadKey, setMarketReloadKey] = useState(0);
  const [debouncedMarketQuery, setDebouncedMarketQuery] = useState("");
  const marketListRef = useRef<HTMLDivElement | null>(null);
  const marketSkillsLengthRef = useRef(0);

  // Local state
  const [scanLoading, setScanLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [importingPaths, setImportingPaths] = useState<Set<string>>(new Set());
  const [importingAll, setImportingAll] = useState(false);

  // Git state
  const [gitUrl, setGitUrl] = useState("");
  const [gitLoading, setGitLoading] = useState(false);
  const [gitInstalling, setGitInstalling] = useState(false);
  const [gitPreview, setGitPreview] = useState<GitPreviewResult | null>(null);
  const [gitSelections, setGitSelections] = useState<GitInstallSelection[]>([]);

  const electronApi = window.electron as typeof window.electron & {
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  };

  const invoke = useCallback(
    <T,>(channel: string, ...args: unknown[]): Promise<T> =>
      electronApi.invoke(channel, ...args) as Promise<T>,
    [electronApi],
  );

  // Installed source refs for market "already installed" check
  const installedSourceRefs
... (truncated)
```
