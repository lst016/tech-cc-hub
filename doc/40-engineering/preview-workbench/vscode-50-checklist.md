# Workspace Preview 50% VSCode 体验验收清单

更新时间：2026-05-30

目标定义：满足下列 10 项核心能力中的至少 6 项达到“可稳定使用”状态，且通过自动化与真机链路验证。

## 验收项

| # | 能力 | 状态 | 证据 |
|---|---|---|---|
| 1 | 文件树可浏览与展开记忆 | 已完成 | `workspace-preview-expanded-state.test` 通过 |
| 2 | Quick Open（`Cmd/Ctrl+P`）可检索与回车打开 | 已完成 | `preview-quick-open*.test` 通过 |
| 3 | Quick Open 支持最近/当前文件排序加权 | 已完成 | `preview-quick-open.test` 通过 |
| 4 | 标签页切换（`Cmd/Ctrl+Tab`、`Cmd/Ctrl+Shift+Tab`） | 已完成 | `preview-quick-open-ux.test` 通过 |
| 5 | 脏文件标记与关闭保护（Unsaved Confirm） | 已完成 | `preview-tab-state.test`、`preview-unsaved-guard.test` 通过 |
| 6 | 编辑保存（`Cmd/Ctrl+S`）与保存后状态回收 | 已完成 | `preview-unsaved-guard.test` + 交互冒烟覆盖 |
| 7 | 代码引用插入 Composer（不泄漏 XML 块） | 已完成 | `npm run qa:preview` = `PREVIEW_QA_OK` |
| 8 | 文件变更后已打开 tab 自动刷新（不污染 MRU） | 已完成 | `preview-file-refresh.test` + source-contract |
| 9 | 真机 computer-use 端到端（打开预览→打开文件→操作验证） | 阻塞中 | 当前环境 `get_app_state` 返回 `cgWindowNotFound/timeout` |
| 10 | 冒烟脚本稳定（非固定文件名、过滤 CSP 噪声） | 已完成 | `preview-qa-smoke-script.test` 通过 |

## 当前结论

- 已完成项：9/10（功能与自动化层面）。
- 当前唯一阻塞：computer-use 真机链路（工具层窗口获取失败，不是预览功能逻辑失败）。
- 达成“50% VSCode 体验”功能门槛：已达成。
- 达成“computer-use 自测闭环”门槛：未达成（待工具层恢复）。

## 下一步

1. 继续保留 `qa:preview` 作为每轮改动后的快速回归门禁。
2. 一旦 computer-use 可稳定获取窗口状态，执行端到端链路并补充截图/步骤证据。
3. 若后续继续拉升体验，优先补“多选批量操作、面包屑导航、符号跳转/outline”三个能力。
