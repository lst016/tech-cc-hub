# skills

> 封装可复用的 agent skill，包含脚本、配置和文档，供桌面 agent 工作台在特定场景下调用

skills 模块是 Electron 工作台的可插拔技能单元。每个 skill 包含脚本逻辑（.mjs）、接口配置（agents/openai.yaml）和使用文档（SKILL.md）。当前唯一 skill 是 tech-cc-hub-release-deploy，用于处理 tech-cc-hub 仓库的提交、推送、tag 和 GitHub Release 发布，支持普通 git push 失败时回退到 GitHub API 直接推送。

## 文件

### `tech-cc-hub-release-deploy/scripts/publish-release.mjs`

核心发布脚本，处理 git push 及其 API fallback、tag 创建/移动、GitHub Release 管理

- `git()` (function) - 封装 execFileSync 同步执行 git 命令，默认 utf8 编码，maxBuffer 128MB
- `gitBuffer()` (function) - 执行 git 并以 buffer 返回，用于 blob 等二进制数据读取
- `runGit()` (function) - 封装 spawnSync 执行 git，返回 {ok, status, stdout, stderr} 结构
- `getCredentialToken()` (function) - 从 GH_TOKEN / GITHUB_TOKEN 环境变量或 git credential fill 获取 GitHub token
- `request()` (function) - Promise 封装 https.request，发起 GitHub API 请求
- `log()` (function) - 输出带前缀 [tech-cc-hub-release] 的日志到 stdout
- `fail()` (function) - 输出错误到 stderr 并 exit(1)
- `isGitDiscoveryFailure()` (function) - 判断 git result 是否为 'not a git repository' 错误
- `pushViaApi()` (function) - 当普通 push 失败时，通过 GitHub Git Data API 逐个 commit 推送
- `createRelease()` (function) - 通过 GitHub REST API 创建/更新 GitHub Release
- `deleteRelease()` (function) - 通过 GitHub REST API 删除同名 release
- `pollWorkflow()` (function) - 轮询 GitHub Actions workflow run 状态

### `tech-cc-hub-release-deploy/agents/openai.yaml`

定义 skill 在 agent 系统中的展示名称和简短描述，供模型路由识别

- `interface.display_name` (field) - skill 的显示名称：tech-cc-hub 发布部署
- `interface.short_description` (field) - 简短描述：提交、推送、移动 tag、打包并更新 GitHub Release

### `tech-cc-hub-release-deploy/SKILL.md`

skill 的使用指南文档，定义默认工作流程、常用命令、已知错误处理和发布说明格式规范

- `默认流程` (section) - 定义 8 步标准发布流程：确认范围 → 判断提交范围 → eslint/build 验证 → commit → push（优先脚本） → 轮询 workflow → 确认 release → 补发布说明
- `常用命令` (section) - 列出 --tag/--retag/--delete-release、--notes-only 等典型调用方式
- `API fallback 行为` (section) - 说明普通 push 失败后如何通过 Git Data API 逐 commit 推送，包括 blob/tree/commit 创建和 tree SHA 校验
- `发布说明格式` (section) - 要求中文优先、中英双语，使用 Lore trailer 风格的 ## 更新内容 + 无序列表

## 关键概念

- **API Fallback Push**：当普通 git push 在 Windows 上失败（如 '.git' 错误）时，脚本回退到直接调用 GitHub Git Data API（create blob/tree/commit + update ref），按本地 commit 顺序逐个推送，确保远端 SHA 与本地一致。
- **Tag Retag**：--retag 标志强制将已有 tag 移动到新 commit；--delete-release 先删除同名 GitHub Release 再重建，用于修复错误的 release。
- **Credential Token 优先级**：获取 GitHub token 的顺序：环境变量 GH_TOKEN > GITHUB_TOKEN > git credential fill，后者会从系统密钥管理器读取已保存的 GitHub 凭据。
- **Lore Trailer Commit Style**：SKILL.md 要求 commit message 按 AGENTS.md 中的 Lore trailer 风格写，保持提交信息的一致性和可读性。

## 内部关系

- `SKILL.md` -> `scripts/publish-release.mjs`：SKILL.md 引用脚本路径（node skills/...）并描述脚本行为，脚本是执行单元
- `agents/openai.yaml` -> `SKILL.md`：openai.yaml 定义 skill 接口元数据，SKILL.md 定义具体操作步骤
- `SKILL.md` -> `agents/openai.yaml`：SKILL.md 首行 name 字段应与目录名保持一致，yaml 中的 display_name 与 md 中的标题对应
