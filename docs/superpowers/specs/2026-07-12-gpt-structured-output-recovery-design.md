# GPT 结构化输出中断修复设计

## 问题与证据

会话 `621910ed-c1d5-4fe6-912d-644eb6997230` 在普通续聊中反复进入 `StructuredOutput`。首轮历史包含 `structured_output_retry_exhausted` 后，`resolveOutputFormat` 对完整续跑 prompt 使用 `structured.*output` 宽泛匹配；`stateless-continuation` 又会保留历史工具名，因此后续轮次持续自触发 JSON Schema 输出。GPT 兼容网关在该模式下最终返回 success 但 0 token，本地 runner 重试两次后将会话标为 error。

另一个可见性缺口是：结构化输出的正文存放在终态 `result.result` 时，聊天区没有对应 assistant 文本。用户只能看到前置进度，误以为模型中途断开。

## 方案选择

采用最小根因修复：

1. 结构化输出只接受显式 `runtime.outputFormat`，或从当前用户可见输入中的明确请求推断。
2. 不扫描 system prompt、stateless continuation 历史或工具输出。
3. 使用带空白边界的严格短语匹配，确保 `StructuredOutput`、`structured_output_retry_exhausted` 和历史 changelog 不会触发。
4. 当终态 result 带正文、但最近一次工具调用后没有 assistant 文本时，合成可见 assistant 消息后再发送 result。
5. 保留既有 empty-success 两次重试、stateless continuation 压缩及 session 状态契约。

不采用的方案：

- 按模型名永久关闭 GPT 的结构化输出：会破坏用户明确要求 JSON 的合法场景。
- 只提高 empty-success 重试次数：重复同一错误协议，不能消除误触发。
- 本次同步升级 Claude Agent SDK：扩大变量范围，无法证明误触发由升级修复。

## 组件边界

- `src/shared/structured-output.ts`：纯函数解析结构化输出意图，可直接单测。
- `src/electron/libs/runner/runner.ts`：使用当前 `displayPrompt` 调用解析器；跟踪工具调用后的可见文本；必要时合成 result 正文。
- `test/electron/structured-output.test.ts`：覆盖显式开关、当前输入短语和历史污染词。
- `test/electron/runner-empty-success.test.ts`：锁定 result 正文可见化接线及既有空结果行为。

## 验收条件

- 当前输入只是普通中文续聊时，历史中的 `StructuredOutput` 或 `structured_output_retry_exhausted` 不会启用 JSON Schema。
- 当前输入明确要求 JSON/JSON Schema/structured output 时仍启用。
- `runtime.outputFormat: none` 始终禁用，`json` 始终启用。
- 工具执行后只有 `result.result` 正文时，用户能看到正文。
- 真正的 0 token 空 success 仍会重试并最终显示明确错误，不再静默完成。
- Electron 专项测试、TypeScript 编译、目标 lint 和 diff check 通过。
