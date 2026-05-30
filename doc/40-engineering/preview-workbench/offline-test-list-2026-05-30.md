# Workspace Preview 离线测试名单

更新时间：2026-05-30

用途：你离开 6 天期间，先以自动化测试作为主验收；回来后按“人工补测名单”逐项确认体感。当前 `computer-use` 链路因工具环境阻塞，不能作为本轮强制门禁。

## 自动化先跑

| 优先级 | 命令 | 通过标准 |
|---|---|---|
| P0 | `node --test test/electron/preview-quick-open-ux.test.ts` | Quick Open 快捷键、MRU、本地状态契约通过 |
| P0 | `node --test test/electron/preview-qa-smoke-script.test.ts` | QA 脚本契约通过，不依赖固定文件名 |
| P0 | `npm run transpile:electron` | Electron/共享 TS 编译通过 |
| P0 | `npx tsc --project test/electron/tsconfig.json` | Electron 测试 TS 编译通过 |
| P0 | `node --test dist-test/test/electron/preview-directory-listing.test.js dist-test/test/electron/preview-external-file.test.js dist-test/test/electron/preview-file-locator.test.js dist-test/test/electron/preview-file-refresh.test.js dist-test/test/electron/preview-git-gutter.test.js dist-test/test/electron/preview-language.test.js dist-test/test/electron/preview-open-routing.test.js dist-test/test/electron/preview-qa-smoke-script.test.js dist-test/test/electron/preview-quick-open.test.js dist-test/test/electron/preview-quick-open-ux.test.js dist-test/test/electron/preview-tab-state.test.js dist-test/test/electron/preview-unsaved-guard.test.js dist-test/test/electron/workspace-preview-expanded-state.test.js` | 预览相关 dist 测试全部通过 |
| P0 | `npm run qa:preview` | 输出 `PREVIEW_QA_OK` |

## 人工补测名单

| 优先级 | 场景 | 操作 | 通过标准 |
|---|---|---|---|
| P0 | 文件树浏览 | 打开 Workspace Preview，展开/折叠目录，打开一个普通文本文件 | 文件内容正确显示，目录展开状态稳定 |
| P0 | Quick Open | 按 `Cmd+P`，输入文件名片段，回车打开 | 命中列表可用，回车打开正确文件 |
| P0 | Quick Open 最近文件 | 依次打开 2-3 个文件，再按 `Cmd+P` 清空输入 | 最近打开/当前文件排在前面 |
| P0 | 标签切换 | 打开多个文件，按 `Cmd+Tab` 与 `Cmd+Shift+Tab` | 标签按顺序前后切换 |
| P0 | 脏文件保护 | 修改当前文件后点击关闭 tab | 出现未保存确认，不会静默丢内容 |
| P0 | 保存状态 | 修改文件后按 `Cmd+S` | 脏标记消失，重新打开仍是保存后的内容 |
| P0 | 代码引用 | 选中文件中的几行代码并插入 Composer | Composer 显示代码引用 chip，不泄漏 `<code_references>` 原始块 |
| P1 | 文件刷新 | 外部修改已打开文件，再回到 Preview | 未编辑的 tab 能刷新；已编辑的脏 tab 不被覆盖 |
| P1 | 错误恢复 | 打开不存在/不可读文件 | UI 给出可理解的错误，不造成白屏 |
| P1 | 长文件体验 | 打开较长源码文件并滚动 | 滚动、选择、复制保持可用 |

## 当前已知限制

- `computer-use` 端到端自测未完成：当前环境 `get_app_state` 对 Chrome/AionUi 只返回菜单栏或超时，不能稳定拿到页面内容节点。
- 本轮主验收以 Playwright/Electron/Node 测试和 `npm run qa:preview` 为准；`computer-use` 恢复后再补一轮真实桌面链路。
- 继续提升到更接近 VSCode 的下一批能力：多选批量操作、面包屑导航、符号跳转/outline。
