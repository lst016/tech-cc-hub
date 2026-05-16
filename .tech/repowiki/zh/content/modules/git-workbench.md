# git-workbench

> Electron主进程的Git工作台模块，为Renderer提供安全的Git操作接口，支持status、diff、stage/unstage、commit、push、branch、stash和轻量提交历史图可视化

git-workbench是tech-cc-hub桌面应用的Git集成模块，运行在Electron主进程中。模块通过IPC向Renderer暴露结构化Git数据，执行实际的git命令操作。设计遵循安全边界原则，第一版禁止高风险操作如reset、rebase、force push等。模块依赖simple-git库作为Git命令的Node包装层。

## 文件

### `src/electron/libs/git/index.ts`

模块对外统一出口，导出service、IPC处理器和类型

- `GitWorkbenchService` (class) - 从service.js导出的主服务类
- `handleGitWorkbenchInvoke` (function) - 处理单个Git IPC调用的入口函数
- `registerGitWorkbenchIpcHandlers` (function) - 注册所有git:* IPC处理器到ipcMain

### `src/electron/libs/git/service.ts`

核心服务类，封装所有Git操作逻辑，是唯一的Git操作入口

- `GitWorkbenchService` (class) - 主服务类，封装repo检测、snapshot、diff、stage、commit、push、branch、stash等操作
- `getSnapshot` (method) - 获取仓库快照，包含status、files、branches、stashes、history和operationLog
- `getDiff` (method) - 获取指定文件的diff内容，区分staged和unstaged
- `stageFiles` (method) - 暂存指定文件
- `unstageFiles` (method) - 取消暂存指定文件
- `commit` (method) - 提交暂存的文件改动
- `push` (method) - 普通push，会检查工作区是否干净
- `getCommitDetail` (method) - 获取某个commit的详细信息，包括body、files和diff
- `listBranches` (method) - 列出本地和远程分支
- `createBranch` (method) - 创建新分支
- `checkoutBranch` (method) - 切换到指定分支
- `stashSave` (method) - 保存当前工作区到stash
- `stashApply` (method) - 应用指定stash
- `stashDrop` (method) - 删除指定stash

### `src/electron/libs/git/types.ts`

定义Git工作台领域的所有TypeScript类型和接口

- `GitWorkbenchErrorCode` (type) - 错误码联合类型，包含git_not_found、not_a_repo、auth_required、dirty_worktree等
- `GitWorkbenchError` (type) - 标准化错误对象结构
- `GitResult` (type) - Git操作结果包装类型，success为true返回data，否则返回error
- `GitChangedFile` (type) - 单个变更文件，包含path、status、staged、additions/deletions
- `GitRepoStatus` (type) - 仓库状态信息
- `GitCommitNode` (type) - 提交图节点，包含hash、parents、author、message、graphLane等
- `GitWorkbenchSnapshot` (type) - 仓库完整快照，聚合所有状态数据
- `GitDiffRequest/GitDiffResult` (type) - diff操作请求和响应类型
- `GitCommitMessageSuggestion` (type) - AI生成的commit message建议

### `src/electron/libs/git/ipc.ts`

注册Electron IPC处理器，将service方法映射到git:* channel

- `GitWorkbenchIpcChannel` (type) - 所有Git IPC channel的联合类型
- `CHANNELS` (constant) - 所有注册的channel数组
- `registerGitWorkbenchIpcHandlers` (function) - 遍历CHANNELS为每个channel注册ipcMain.handle处理器
- `handleGitWorkbenchInvoke` (function) - 解析payload参数，根据channel调用对应service方法

### `src/electron/libs/git/errors.ts`

将git stderr和simple-git错误归一化为结构化GitWorkbenchError

- `PATTERNS` (constant) - 错误码到错误消息的映射数组，用于模式匹配
- `normalizeGitError` (function) - 主函数，将任意错误转换为标准GitWorkbenchError
- `isGitWorkbenchError` (function) - 类型守卫函数，判断错误是否已是标准化格式

### `src/electron/libs/git/history.ts`

解析git log输出为GitCommitNode数组

- `GIT_LOG_FORMAT` (constant) - git log格式化字符串，使用\x1f和\x1e作为字段和记录分隔符
- `parseGitLog` (function) - 将原始git log输出解析为GitCommitNode数组，调用assignGraphLanes计算图lane

### `src/electron/libs/git/graph.ts`

为提交历史计算轻量级图形的lane索引，用于可视化分支图

- `assignGraphLanes` (function) - 遍历commits数组，为每个commit分配graphLane值，用于前端绘制分支线

### `src/electron/libs/git/commit-message.ts`

AI驱动的commit message生成，包含调用Claude Code的能力和fallback逻辑

- `generateCommitMessageSuggestion` (function) - 主函数，尝试用AI生成commit message，超时或失败时返回fallback
- `runSinglePromptQuery` (function) - 调用@anthropic-ai/claude-agent-sdk执行单次prompt查询
- `buildFallbackCommitSuggestion` (function) - 当AI不可用时，基于文件状态生成简化的commit message
- `normalizeAiSuggestion` (function) - 规范化AI返回的commit message格式

### `src/electron/libs/git/operation-log.ts`

记录高影响Git操作的本地日志，用于审计和undo支持

- `GitOperationLog` (class) - 内存中的操作日志类，最多保留500条记录
- `list` (method) - 获取指定仓库的最新50条操作记录
- `record` (method) - 记录一条操作，生成唯一id和timestamp

### `src/electron/libs/git/README.md`

模块边界文档，说明允许和禁止的操作范围

### `test/electron/git-service.test.ts`

GitWorkbenchService的集成测试，测试status、diff、stage、commit、push等核心功能

- `git` (function) - 测试辅助函数，封装execFileSync调用git命令
- `createRepo` (function) - 创建临时测试仓库
- `addBareRemote` (function) - 为测试仓库添加bare remote用于push测试

### `test/electron/git-graph.test.ts`

测试assignGraphLanes函数的lane分配逻辑

- `assignGraphLanes` (function) - 测试线性历史返回稳定lane [0,0,0]

### `test/electron/git-errors.test.ts`

测试normalizeGitError错误归一化功能

- `normalizeGitError` (function) - 测试各种git错误消息能正确映射到对应error code

### `test/electron/git-workbench-ui-source.test.ts`

测试UI源码中Git功能的正确接入方式，验证IPC隔离和组件绑定

- `tabsSource` (test) - 验证Git作为activity workspace tab被正确注册
- `preloadSource` (test) - 验证preload暴露了正确的Git IPC方法，不暴露敏感API
- `boxSource` (test) - 验证commit box中AI生成message和refine逻辑
- `pushButton` (test) - 验证暂存文件时push按钮变为commit-and-push模式

## 关键概念

- **IPC隔离架构**: 所有Git操作必须在主进程执行，Renderer通过preload暴露的typed API调用ipcMain。service.ts是唯一的Git操作入口，不允许Renderer直接导入simple-git或执行child_process
- **GitResult包装类型**: 所有service方法返回GitResult<T>类型，success为true时包含data，false时包含error和errorCode。避免抛出异常，使用统一的结果结构便于UI处理
- **快照模式**: getSnapshot一次性获取仓库完整状态，避免N+1问题。返回包含status、files、branches、stashes、history和operationLog的聚合对象
- **错误归一化**: normalizeGitError通过正则模式匹配将各类git错误(认证失败、无remote、dirty worktree等)映射到预定义的GitWorkbenchErrorCode和中文友好消息
- **安全边界**: 第一版禁止reset、rebase、cherry-pick、force push等历史改写操作。pro-workflow/git-blast-radius.js提供额外的命令级别安全检查
- **AI commit message生成**: 使用@anthropic-ai/claude-agent-sdk调用Claude Code生成语义化commit message，6秒超时后自动降级到基于文件状态的fallback生成
- **轻量图可视化**: assignGraphLanes算法为提交历史分配lane值，前端使用这些lane值绘制分支线。算法基于commit父子关系追踪当前lane或分配新lane
- **操作日志**: GitOperationLog内存记录push、checkout、stash等操作的审计轨迹，最多保留500条。用于UI展示操作历史和支持undo场景

## 内部关系

- `service.ts` → `types.ts`: service使用types定义的类型作为方法签名和返回值的类型约束
- `service.ts` → `errors.ts`: service的catch块调用normalizeGitError将异常转换为标准错误格式
- `service.ts` → `history.ts`: service.getSnapshot调用parseGitLog解析提交历史
- `service.ts` → `commit-message.ts`: service.generateCommitMessage委托给commit-message模块的AI生成逻辑
- `service.ts` → `operation-log.ts`: service使用GitOperationLog记录push、checkout、stash等高影响操作
- `history.ts` → `graph.ts`: parseGitLog调用assignGraphLanes为提交分配可视化lane
- `ipc.ts` → `service.ts`: ipc.ts是service的IPC封装层，将方法调用路由到service对应方法
- `ipc.ts` → `types.ts`: ipc.ts导入types用于类型断言和channel定义
- `index.ts` → `service.ts`: index作为统一出口导出service类
- `index.ts` → `ipc.ts`: index导出IPC注册和处理函数
- `index.ts` → `types.ts`: index导出所有类型供外部使用
- `commit-message.ts` → `types.ts`: 导入GitChangedFile和GitCommitMessageSuggestion类型
