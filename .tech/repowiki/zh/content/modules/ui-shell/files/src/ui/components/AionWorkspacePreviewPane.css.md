# src/ui/components/AionWorkspacePreviewPane.css

> 模块：`ui-shell` · 语言：`css` · 行数：895

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```css
.aion-workbench {
  --aion-paper: #ffffff;
  --aion-sidebar: #f3f3f3;
  --aion-line: #d8dee4;
  --aion-line-soft: #eaeef2;
  --aion-ink: #24292f;
  --aion-muted: #6e7781;
  --aion-accent: #0969da;
  --aion-accent-soft: #ddf4ff;
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  color: var(--aion-ink);
  background: #ffffff;
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.quick-open {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 46px;
  background: rgba(246, 248, 250, 0.34);
}

.quick-open__panel {
  width: min(680px, calc(100% - 48px));
  max-height: min(520px, calc(100% - 80px));
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #c8d1dc;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 18px 48px rgba(31, 35, 40, 0.22);
}

.quick-open__input-wrap {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #d8dee4;
  padding: 0 12px;
  color: var(--aion-accent);
}

.quick-open__input-wrap input {
  min-width: 0;
  flex: 1;
  border: 0;
  background: transparent;
  color: #1f2328;
  font-size: 14px;
  outline: none;
}

.quick-open__input-wrap input::placeholder {
  color: #8c959f;
}

.quick-open__input-wrap kbd {
  min-width: 48px;
  border: 1px solid #d8dee4;
  border-radius: 4px;
  background: #f6f8fa;
  color: #57606a;
  font-size: 10px;
  font-weight: 700;
  line-height: 20px;
  text-align: center;
}

.quick-open__meta {
  min-height: 28px;
  padding: 6px 12px;
  border-bottom: 1px solid #eaeef2;
  color: #6e7781;
  font-size: 11px;
}

.quick-open__list {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 4px;
}

.quick-open__empty {
  padding: 18px 12px;
  color: #6e7781;
  font-size: 12px;
  text-align: center;
}

.quick-open__item {
  display: grid;
  width: 100%;
  min-height: 42px;
  grid-template-columns: minmax(120px, 0.42fr) minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #24292f;
  cursor: pointer;
  padding: 0 10px;
  text-align: left;
}

.quick-open__item:hover,
.quick-open__item--selected {
  background: #0969da;
  color: #ffffff;
}

.quick-open__item-name,
.quick-open__item-path {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-open__item-name {
  font-size: 13px;
  font-weight: 700;
}

.quick-open__item-path {
  color: #6e7781;
  font-size: 12px;
}

.quick-open__item:hover .quick-open__item-path,
.quick-open__item--selected .quick-open__item-path {
  color: rgba(255, 255, 255, 0.78);
}

.aion-workbench--empty {
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  text-align: center;
}

.aion-workbench__body {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: minmax(220px, 0.32fr) minmax(0, 1fr);
  gap: 0;
  background: #ffffff;
}

.aion-workbench__empty-title {
  font-size: 14px;
  font-weight: 700;
}

.aion-workbench__empty-copy {
  max-width: 330px;
  color: var(--aion-muted);
  font-size: 12px;
  line-height: 1.7;
}

.aion-workbench__empty-button {
  height: 32px;
  border: 1px solid var(--aion-line);
  border-radius: 6px;
  background: #ffffff;
  color: var(--aion-ink);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  padding: 0 12px;
}

.native-explorer {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--aion-line);
  background: var(--aion-sidebar);
}

.native-explorer__toolbar {
  display: flex;
  min-height: 35px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px;
  border-bottom: 1px solid var(--aion-line);
  background: #f3f3f3;
}

.native-explorer__title {
  color: #1f2328;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.native-explorer__actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.native-explorer__actions button {
  display: inline-flex;
  height:
... (truncated)
```
