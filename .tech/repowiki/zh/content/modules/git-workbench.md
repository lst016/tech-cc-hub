# git-workbench

> Electron主进程Git工作台模块，为渲染进程提供安全的Git操作入口（status、diff、commit、branch、stash等）

右侧Git工作台的Electron主进程模块。Renderer进程只能通过IPC调用，不直接执行git命令。模块封装了simple-git库，实现统一的错误归一化、快照生成、提交信息AI生成、轻量级分支图渲染和高影响操作日志记录。第一版允许的操作为status/diff、stage/unstage、commit、普通push、创建/切换分支、stash save/apply/drop、历史和轻量图。禁止reset、rebase、cherry-pick、force push、amend、squash、interactive rebase等高风险操作。

## Agent 可用信息

- 理解renderer必须通过IPC调用此模块，不能直接import GitWorkbenchService
- 15个IPC channel对应的payload结构（如git:stage需要{cwd, paths}数组）
- GitResult<T>包装类型的使用方式，需要检查success字段
- service.ts中git()方法自动解析repoRoot，所有命令相对仓库根目录执行
- 禁止操作列表（reset/rebase/force push等）在第一版不可用，无需实现
- commit信息生成依赖claude-settings.js获取API配置

## 优先入口

- `src/electron/libs/git/index.ts`：模块统一出口，展示导出的三个核心符号
- `src/electron/libs/git/service.ts`：501行核心逻辑，实现所有Git操作的具体实现

## 文件

### `src/electron/libs/git/README.md`

模块文档，说明边界、允许/禁止的操作列表

### `src/electron/libs/git/index.ts`

模块统一出口，导出GitWorkbenchService和IPC注册函数

- `GitWorkbenchService` (class) - 核心Git服务类，所有Git操作入口
- `registerGitWorkbenchIpcHandlers` (function) - 注册所有IPC handler到ipcMain
- `handleGitWorkbenchInvoke` (function) - 分发IPC请求到service方法

### `src/electron/libs/git/ipc.ts`

Electron IPC handler注册，将15个channel映射到service方法

- `GitWorkbenchIpcChannel` (type) - 15个IPC channel联合类型
- `CHANNELS` (const) - 所有channel数组，用于循环注册
- `registerGitWorkbenchIpcHandlers` (function) - 一次性注册所有handler，防止重复注册（registered标志）
- `handleGitWorkbenchInvoke` (function) - switch分发函数，每个case调用service方法并捕获错误
- `readObject/readRequiredString/readOptionalString/readStringArray` (function) - payload参数读取工具函数，readRequiredString会抛出错误

### `src/electron/libs/git/types.ts`

定义所有领域类型和IPC payload/result类型

- `GitWorkbenchErrorCode` (type) - 14种错误码：git_not_found、not_a_repo、auth_required、dirty_worktree、conflict、nothing_to_commit、branch_exists、branch_not_found、stash_not_found等
- `GitResult<T>` (type) - 统一返回格式：{success:true, data:T} | {success:false, error:GitWorkbenchError}
- `GitWorkbenchSnapshot` (type) - getSnapshot返回的完整快照，包含status、files、branches、stashes、history、operationLog
- `GitCommitNode` (type) - 提交节点，含hash、parents、authorName、message、graphLane
- `GitOperationLogEntry` (type) - 操作日志条目，记录pull/push/checkout/stash/commit操作

### `src/electron/libs/git/commit-message.ts`

AI生成commit信息或降级到规则生成

- `generateCommitMessageSuggestion` (function) - 调用claude-agent-sdk生成commit信息，超时6秒降级fallback
- `generateFallbackCommitMessageSuggestion` (function) - 规则生成commit信息，不依赖AI
- `buildPrompt` (function) - 构建AI prompt，要求Conventional Commits格式、中文输出、JSON格式
- `normalizeAiSuggestion` (function) - 解析AI返回的JSON，截断到72字符

### `src/electron/libs/git/history.ts`

解析git log输出为GitCommitNode数组

- `GIT_LOG_FORMAT` (const) - git log格式化字符串，使用US（单元分隔符）分隔字段：hash、shortHash、parents、authorName、authorEmail、committedAt、refs、message
- `parseGitLog` (function) - 解析原始log输出，调用assignGraphLanes生成图lane

### `src/electron/libs/git/errors.ts`

Git命令错误归一化为用户友好的GitWorkbenchError

- `normalizeGitError` (function) - 核心函数，根据正则模式匹配将git错误转为标准错误码和中文消息
- `PATTERNS` (const) - 12个[错误码, 正则, 用户消息]三元组数组

### `src/electron/libs/git/graph.ts`

为提交历史生成轻量级分支图lane编号

- `assignGraphLanes` (function) - 遍历提交列表，为每个commit分配graphLane（用于渲染分支线）

### `src/electron/libs/git/operation-log.ts`

内存中记录高影响Git操作（push/pull/checkout/commit/stash）

- `GitOperationLog` (class) - 操作日志类，最多保留500条，每个仓库保留最近50条
- `record()` (method) - 记录操作，返回带id和createdAt的条目

### `src/electron/libs/git/service.ts`

核心业务逻辑，封装所有Git操作（snapshot、diff、commit、branch、stash等），501行代码

- `GitWorkbenchService` (class) - 主服务类，包含getSnapshot、getDiff、getCommitDetail、stageFiles、unstageFiles、commit、pull、push、createBranch、checkoutBranch、stashSave、stashApply、stashDrop方法
- `git()` (method) - 创建simple-git实例，cwd为仓库根目录
- `mapChangedFiles()` (method) - 将StatusResult映射为GitChangedFile数组
- `listBranches()` (method) - 获取分支列表，包含remote分支
- `decorateHistoryBranches()` (method) - 为历史节点标记所属分支

## 数据与接口契约

- **git:snapshot**：channel: git:snapshot, payload: {cwd:string}, result: GitResult<GitWorkbenchSnapshot>。获取完整仓库快照，包含status、files、branches、stashes、history、operationLog。定义在service.ts getSnapshot方法和types.ts GitWorkbenchSnapshot类型
- **git:diff**：channel: git:diff, payload: {cwd, path, staged?:boolean}, result: GitResult<GitDiffResult>。获取文件diff，staged=true取暂存区diff。定义在service.ts getDiff方法
- **git:stage**：channel: git:stage, payload: {cwd, paths:string[]}, result: GitResult<GitChangedFile[]>。暂存文件列表，paths为空数组暂存全部。定义在service.ts stageFiles方法
- **git:commit**：channel: git:commit, payload: {cwd, message:string, body?:string}, result: GitResult<GitCommitNode>。创建提交，message必填。定义在service.ts commit方法
- **git:push**：channel: git:push, payload: {cwd}, result: GitResult<void>。普通push，失败返回auth_required/no_upstream/no_remote等错误码。定义在service.ts push方法
- **git:generateCommitMessage**：channel: git:generateCommitMessage, payload: {cwd, language?:string}, result: GitResult<GitCommitMessageSuggestion>。AI生成建议，language默认zh-CN。定义在commit-message.ts generateCommitMessageSuggestion
- **GitWorkbenchError**：错误类型：{code:GitWorkbenchErrorCode, message:string, detail?:string}。14种错误码定义在types.ts。错误归一化逻辑在errors.ts PATTERNS数组

## 关键概念

- **主进程/渲染进程分离**：所有git命令在主进程执行，renderer通过IPC调用，不直接操作git
- **GitWorkbenchSnapshot**：getSnapshot返回完整仓库快照，包含状态、文件、分支、stash、历史和操作日志，避免多次API调用
- **GitResult<T>统一返回**：所有service方法返回GitResult包装类型，区分success和error路径
- **错误归一化**：normalizeGitError将git命令的原始错误信息通过正则匹配转为用户友好的中文错误码
- **AI生成降级策略**：生成commit信息时优先调用AI，超时6秒或失败时降级到规则生成
- **高影响操作日志**：push/pull/checkout/commit/stash操作记录到GitOperationLog，用于UI显示操作历史

## 内部关系

- `ipc.ts` -> `service.ts`：ipc.ts创建service单例，通过handleGitWorkbenchInvoke分发请求到service的各个方法
- `service.ts` -> `simple-git`：service.ts依赖simple-git库执行所有git命令
- `service.ts` -> `errors.ts`：service.ts调用normalizeGitError将git异常归一化
- `service.ts` -> `commit-message.ts`：service.ts调用generateCommitMessageSuggestion生成AI提交信息
- `service.ts` -> `history.ts`：service.ts调用parseGitLog解析git log输出
- `service.ts` -> `operation-log.ts`：service.ts使用GitOperationLog记录高影响操作
- `history.ts` -> `graph.ts`：history.ts调用assignGraphLanes为提交分配图lane
- `commit-message.ts` -> `claude-settings.js`：commit-message.ts获取API配置和模型选项

## 运行注意事项

- 注册时用registered标志防止重复注册registerGitWorkbenchIpcHandlers
- ipcMain.handle统一catch异常，包装为invalidResult返回，renderer不会收到抛出的错误
- readRequiredString在参数缺失时抛出TypeError，被catch转为generic error
- service.ts中git()方法每次调用创建新的simple-git实例，不保持长连接
- getSnapshot一次性获取status/stash/log/branches，减少IPC往返次数
- GitOperationLog仅内存存储，最多500条全局记录，每仓库50条历史，重启后丢失
- commit-message.ts调用getClaudeCodePath()获取claude-code可执行文件路径

## 修改风险

- 修改CHANNELS数组必须同步更新ipc.ts的switch语句，否则新channel无法分发
- GitWorkbenchErrorCode增加新错误码需要同步更新errors.ts的PATTERNS数组
- service.ts中所有git方法依赖simple-git的API，升级库版本需回归测试
- getSnapshot聚合多个git命令，任意子命令失败导致整个快照失败
- commit-message.ts依赖claude-settings.js的API配置结构，配置变更需同步
- IPC payload结构变化需要同步更新renderer端的调用代码

## 验证

- git-workbench模块无需单元测试验证，集成测试在GitUI组件中手动测试：打开含git仓库的工作区，验证snapshot显示正确、stage/diff/commit/push功能正常
- AI commit生成：切换到有改动的工作区，触发generateCommitMessage，检查是否返回Conventional Commits格式的JSON
- 错误归一化：在无git环境执行操作，检查返回git_not_found错误码；在非仓库目录操作，检查返回not_a_repo
- 运行命令：cd src/electron && npx tsc --noEmit 验证类型正确性
