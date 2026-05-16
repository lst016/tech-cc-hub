# src/electron/libs/git/README.md

> 模块：`git-workbench` · 语言：`markdown` · 行数：35

## 文件职责

模块边界文档，说明允许和禁止的操作范围

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Git Module

右侧 Git 工作台的主进程模块，Renderer 只能通过 IPC 调用这里，不直接执行 git。

## 边界

- `types.ts`: Git 工作台领域类型和 IPC payload/result。
- `errors.ts`: Git 错误归一化。
- `service.ts`: 唯一 Git 操作入口。
- `history.ts`: commit history parser。
- `graph.ts`: lightweight graph lane 生成。
- `operation-log.ts`: 本地高影响操作日志。
- `ipc.ts`: Electron IPC handler 注册。
- `index.ts`: 对外统一出口。

## 第一版允许

- status / diff
- stage / unstage
- commit
- ordinary push
- create / checkout branch
- stash save / apply / drop
- recent history / lightweight graph

## 第一版禁止

- reset
- rebase
- cherry-pick
- force push
- amend
- squash
- interactive rebase

```
