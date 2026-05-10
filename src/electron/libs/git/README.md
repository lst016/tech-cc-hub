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
