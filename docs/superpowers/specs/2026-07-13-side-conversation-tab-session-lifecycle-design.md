# 侧聊 Tab 临时多轮会话生命周期设计

## 背景

当前侧聊虽然在 UI 中以线程 Tab 展示，但每次发送都会终止现有 Runner，并用主会话快照和侧聊历史启动新的 stateless Runner。这让同一 Tab 的连续追问在运行层面仍是多个新会话，也增加了上下文重建、状态漂移和主任务状态串入侧聊的风险。

目标语义是：一个侧聊 Tab 对应一个独立、临时、可多轮的逻辑会话。只有点击“+”才创建新的临时会话；关闭 Tab 才销毁该会话。

## 已确认行为

- 首次打开侧聊 Tab 时创建一个空的临时会话。
- 该会话只在内存中存在，不写入普通会话数据库，也不出现在左侧会话列表。
- 首轮发送时，以 Tab 创建时固定的主会话上下文快照启动专属 Runner。
- 模型、推理等级和权限模式未变化时，后续轮次复用同一个 Runner，通过 `appendPrompt` 继续对话。
- 模型、推理等级或权限模式变化时，终止旧 Runner，并用固定主快照加该 Tab 的私有历史重建 Runner。
- Runner 重建不改变 Tab ID、标题、消息、草稿或轮次；它只是替换底层执行器。
- 用户停止当前执行后，再次发送时按重建路径恢复同一个逻辑会话。
- 关闭单个 Tab 后立即终止 Runner 并清除该 Tab 的全部临时状态。
- 关闭整个侧聊页签或退出应用时，清除相应范围内的所有临时会话。
- 主会话在 Tab 创建后的新增内容不得进入该 Tab；侧聊内容也不得写回主会话。

## 方案比较

### 方案 A：Tab 级持久 Runner，配置变化时重建（采用）

同一运行配置下复用 Runner，配置变化、停止后继续或 Runner 已关闭时才进行 stateless 重建。它同时满足真实多轮、运行配置可切换和临时会话隔离。

### 方案 B：每轮使用远程 Session Resume

每轮创建新 Runner，但传入供应商会话 ID。该方案依赖不同供应商和模型的 resume 兼容性，切换模型时行为不稳定，也可能把远端会话生命周期泄漏到临时 Tab 之外，因此不采用。

### 方案 C：每轮 stateless 重建

这是当前行为。实现简单，但每轮都是新的底层会话，不符合已确认语义，因此不采用。

## 主进程状态模型

每个 `BtwRuntime` 保存：

- `threadId` 和 `parentSessionId`；
- 创建时固定的主会话消息快照；
- 仅属于该 Tab 的私有消息历史；
- 清除了父任务执行计划和工作流控制状态的临时 `Session`；
- 当前 `RunnerHandle`；
- 当前 Runner 的运行配置签名；
- generation、创建时间和更新时间。

运行配置签名至少覆盖模型、推理等级和权限模式。只有签名一致且 Runner 未关闭时才允许 `appendPrompt`。

## 发送流程

### 首轮或需要重建

1. 确认线程存在且未在运行。
2. 以固定主快照和已有私有历史构造 stateless continuation；当前新问题单独作为本轮 prompt。
3. 更新临时 Session 的模型、推理等级和权限模式。
4. 记录用户可见消息并发出 `btw.stream.user_prompt`。
5. 启动新 Runner，保存 handle 和配置签名。
6. Runner 事件继续通过 thread ID 和 generation 隔离路由。

### 同配置后续轮次

1. 确认现有 handle 未关闭，且配置签名一致。
2. 记录用户可见消息并把线程状态切换为 running。
3. 调用该 handle 的 `appendPrompt`，传入当前附件和 workspace context。
4. 不重新构造主快照，不创建新 Runner，也不改变 thread ID。

## 状态与错误处理

- running 状态下重复发送仍被拒绝。
- `appendPrompt` 失败时标记当前线程为 error，并清理不可继续使用的 handle；下一次发送走重建路径。
- Runner 返回 error 或 handle 已关闭时，下一次发送走重建路径。
- stop 会增加 generation、终止并清空 handle；消息历史保留，方便下一次重建。
- close 会增加 generation、终止 handle、清理权限请求，并删除整个 runtime。
- 配置变化重建时先增加 generation，再终止旧 handle，确保旧 Runner 的迟到事件被丢弃。
- 找不到 thread ID 时必须返回明确的 `btw.runner.error`，不能静默丢弃发送。

## 附件

首轮、重建轮和 append 轮都应复用普通会话的附件准备流程：

- Renderer 使用 display attachments 渲染；
- Runner 使用 agent attachments；
- 图片落盘、base64 清理和摘要生成规则与主会话一致。

附件只属于对应侧聊轮次，不写入主会话。

## 测试策略

新增或调整回归测试，至少覆盖：

1. 首轮发送只创建一个 Runner。
2. 同配置第二轮只调用同一 handle 的 `appendPrompt`，Runner 创建次数保持为一。
3. 同一 Tab 的用户与助手消息按轮次保留。
4. 模型变化时旧 handle 被终止，新 Runner 使用固定主快照加私有历史重建。
5. 推理等级或权限模式变化时同样重建。
6. stop 后下一轮重建，但保留 Tab 历史。
7. append 失败后线程进入 error，下一轮可重建。
8. 不同 Tab 的 Runner、历史、配置和迟到事件完全隔离。
9. 父会话未完成的 `planSnapshot` 不进入临时 Session。
10. 附件在首次运行、append 和重建路径中均完成统一预处理。
11. 关闭 Tab 后 handle 被终止，迟到事件被丢弃。

## 非目标

- 不持久化侧聊到 `sessions.db`。
- 不在应用重启后恢复侧聊。
- 不把侧聊消息合并回主会话。
- 不允许主会话创建后的新消息自动同步到既有侧聊。
- 不保证不同侧聊对同一工作区并发修改时自动合并文件冲突。
