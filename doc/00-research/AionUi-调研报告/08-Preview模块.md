# AionUi Preview 模块全量调研报告

**调研时间**: 2026-05-01
**来源**: https://github.com/iOfficeAI/AionUi

---

## 一、模块概览

AionUi 的 Preview 模块是一个功能完善的**文件预览和编辑系统**，采用多 Tab 架构，支持同时打开多个文件。

```
Preview/
├── context/                           # React Context
│   ├── PreviewContext.tsx             # 核心上下文：Tab管理、内容更新、保存
│   └── PreviewToolbarExtrasContext.tsx # 工具栏扩展上下文
├── components/
│   ├── PreviewPanel/                  # 主面板组件
│   │   ├── PreviewPanel.tsx           # 主组件
│   │   ├── PreviewTabs.tsx            # Tab栏
│   │   ├── PreviewToolbar.tsx          # 工具栏
│   │   ├── PreviewContextMenu.tsx      # 右键菜单
│   │   ├── PreviewConfirmModals.tsx   # 确认对话框
│   │   └── PreviewHistoryDropdown.tsx # 历史版本下拉
│   ├── viewers/                       # 查看器
│   │   ├── MarkdownViewer.tsx          # Markdown渲染
│   │   ├── CodeViewer.tsx             # 代码高亮
│   │   ├── ImageViewer.tsx            # 图片查看
│   │   ├── DiffViewer.tsx             # Diff对比
│   │   ├── PDFViewer.tsx              # PDF查看
│   │   ├── ExcelViewer.tsx            # Excel查看
│   │   ├── OfficeDocViewer.tsx        # Word查看
│   │   ├── HTMLViewer.tsx             # HTML渲染
│   │   └── URLViewer.tsx              # URL网页查看
│   ├── editors/                       # 编辑器
│   │   ├── MarkdownEditor.tsx         # Markdown编辑器 (CodeMirror)
│   │   ├── TextEditor.tsx             # 文本编辑器 (Monaco)
│   │   └── HTMLEditor.tsx             # HTML编辑器
│   └── renderers/                     # 特殊渲染器
│       ├── HTMLRenderer.tsx           # HTML iframe渲染器
│       └── SelectionToolbar.tsx       # 选择工具栏
├── hooks/                             # 自定义Hooks
│   ├── usePreviewHistory.ts           # 版本历史管理
│   ├── usePreviewKeyboardShortcuts.ts # 快捷键处理
│   ├── useScrollSync.ts              # 滚动同步
│   └── useTabOverflow.ts             # Tab溢出处理
├── utils/
│   └── fileUtils.ts                   # 文件操作工具
├── types/
│   └── index.ts                       # 类型定义
└── constants.ts                       # 常量配置
```

---

## 二、核心功能详解

### 2.1 PreviewContext（核心）

**文件**: `context/PreviewContext.tsx`

**状态定义**:
```typescript
interface PreviewContextValue {
  isOpen: boolean;
  tabs: PreviewTab[];
  activeTabId: string | null;
  activeTab: PreviewTab | null;
  
  openPreview: (content: string, type: PreviewContentType, metadata?: PreviewMetadata) => void;
  closePreview: () => void;
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;
  updateContent: (content: string) => void;
  saveContent: (tabId?: string) => Promise<boolean>;
  
  findPreviewTab: (type: PreviewContentType, content?: string, metadata?: PreviewMetadata) => PreviewTab | null;
  closePreviewByIdentity: (type: PreviewContentType, content?: string, metadata?: PreviewMetadata) => void;
}
```

**关键实现 - 流式更新防抖**（500ms）:
```typescript
const unsubscribe = ipcBridge.fileStream.contentUpdate.on(({ filePath, content, operation }) => {
  if (operation === 'delete') {
    closeTab(tabToClose.id);
    return;
  }
  
  const existingTimer = debounceTimers.get(filePath);
  if (existingTimer) clearTimeout(existingTimer);
  
  const timer = setTimeout(() => {
    setTabs((prevTabs) => {
      return prevTabs.map((tab) => {
        if (tab.metadata?.filePath !== filePath) return tab;
        if (savingFilesRef.current.has(filePath) || tab.isDirty) return tab;
        return { ...tab, content, originalContent: content, isDirty: false };
      });
    });
  }, 500);
  
  debounceTimers.set(filePath, timer);
});
```

### 2.2 MarkdownViewer

**功能**:
- Markdown 实时渲染（支持流式打字动画）
- 原文/预览切换
- Mermaid 图表渲染
- LaTeX 数学公式支持（KaTeX）
- 语法高亮代码块
- 图片自动解析（本地路径 → Base64）
- 滚动同步

**技术依赖**:
- `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex`
- `streamdown` - 流式 Markdown 解析
- `react-syntax-highlighter` - 语法高亮
- `mermaid` - 图表渲染

### 2.3 CodeViewer

**功能**:
- 多语言语法高亮（支持 50+ 语言）
- 原文/预览切换
- 大文件优化（>30KB 禁用高亮）
- 主题自动跟随

### 2.4 ImageViewer

**功能**:
- 图片显示（支持 Base64 和文件路径）
- 放大预览
- 错误处理和重试机制

```typescript
const loadImage = async () => {
  if (content) { setImageSrc(content); return; }
  const base64 = await ipcBridge.fs.getImageBase64.invoke({ path: filePath });
  if (isMounted) setImageSrc(base64);
};
```

### 2.5 DiffViewer

**功能**:
- Diff 内容渲染（diff2html 库）
- 行级 vs 词级高亮
- Side-by-side 对比模式

### 2.6 PDFViewer / OfficeDocViewer

**注意**: 依赖 Electron Webview 和 `officecli` CLI 工具，移植需额外工作。

### 2.7 HTMLViewer

**功能**:
- iframe 实时渲染
- 元素选择器（类似 DevTools）
- 代码编辑（Monaco Editor）
- 双向定位：预览 ↔ 代码

### 2.8 MarkdownEditor

**技术**: CodeMirror + `@uiw/react-codemirror`

```typescript
<CodeMirror
  value={value}
  theme={theme === 'dark' ? 'dark' : 'light'}
  extensions={[markdown()]}
  onChange={onChange}
  basicSetup={{ lineNumbers: true, foldGutter: true }}
/>
```

### 2.9 MermaidBlock

**功能**: 在 Markdown 中渲染 Mermaid 图表

```typescript
const MermaidBlock: React.FC<MermaidBlockProps> = ({ code }) => {
  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme });
    const { svg } = await mermaid.render(blockId, source);
    setSvg(svg);
  }, [code, currentTheme]);
  
  return svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : <SyntaxHighlighter>{code}</SyntaxHighlighter>;
};
```

### 2.10 usePreviewHistory

**功能**:
- 基于 Git 的文件版本历史
- 快照保存和恢复

---

## 三、技术依赖总表

| 依赖 | 用途 | tech-cc-hub 现状 |
|------|------|------------------|
| `@uiw/react-codemirror` | Markdown/文本编辑 | 未使用 |
| `@monaco-editor/react` | HTML 编辑 | 未使用 |
| `react-syntax-highlighter` | 代码语法高亮 | 未使用 |
| `diff2html` | Diff 渲染 | 未使用 |
| `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex` | Markdown 渲染 | 未使用 |
| `streamdown` | 流式 Markdown 解析 | 未使用 |
| `mermaid` | 图表渲染 | 未使用 |
| `katex` | LaTeX 渲染 | 未使用 |

---

## 四、移植优先级建议

### Phase 1 - 基础查看器（高优先级，可移植）

| 功能 | 工作量 | 说明 |
|------|--------|------|
| **CodeViewer** | 1天 | 依赖少，直接移植 |
| **ImageViewer** | 1天 | Base64 加载逻辑 |
| **DiffViewer** | 2天 | 需集成 diff2html |

### Phase 2 - Markdown 体系（中优先级）

| 功能 | 工作量 | 说明 |
|------|--------|------|
| **MarkdownViewer** | 3天 | 核心功能，优先级高 |
| **MarkdownEditor** | 2天 | CodeMirror 集成 |
| **MermaidBlock** | 1天 | 依赖 mermaid |

### Phase 3 - PreviewContext 核心（中优先级）

| 功能 | 工作量 | 说明 |
|------|--------|------|
| **PreviewContext** | 3天 | 核心抽象，Tab管理 |
| **PreviewTabs** | 1天 | Tab 栏 UI |
| **useScrollSync** | 1天 | 滚动同步逻辑 |

### Phase 4 - Electron 专有（低优先级）

| 功能 | 工作量 | 说明 |
|------|--------|------|
| **PDFViewer** | 高 | 依赖 Webview |
| **OfficeDocViewer** | 高 | 依赖 officecli |
| **usePreviewHistory** | 中 | 依赖 Git IPC |

---

## 五、移植架构建议

tech-cc-hub 右侧 ActivityRail 已有执行轨迹展示能力，Preview 模块可作为**右侧面板的第二种视图模式**：

```
右侧面板
├── ActivityRail    (当前模式：执行轨迹)
└── PreviewPanel    (新模式：文件预览)
    ├── PreviewTabs
    ├── PreviewToolbar
    └── PreviewContent
        ├── CodeViewer
        ├── MarkdownViewer
        ├── ImageViewer
        └── DiffViewer
```

**关键决策点**:
1. PreviewContext 是否与现有 ActivityRail 共存？
2. PreviewPanel 是在现有 ActivityRail 内部还是作为独立 Panel？
3. Tab 管理是否复用现有会话 Tab？

---

## 六、预估工期

| Phase | 内容 | 工期 |
|-------|------|------|
| Phase 1 | 基础查看器 (Code/Image/Diff) | 4天 |
| Phase 2 | Markdown 体系 | 6天 |
| Phase 3 | PreviewContext + UI | 5天 |
| **合计** | **基础预览能力** | **15天** |

如需 Office/PDF 支持，另加 5-7 天。
