# MCP 工具目录

这个目录集中存放暴露给 Agent 的内置 MCP 工具，避免 `libs` 根目录随着工具增多变得难审。

- `browser.ts`：右侧 BrowserView 工作台能力，包括导航、截图摘要、DOM 查询、样式检查和标注模式。
- `design.ts`：截图语义分析、截图比照和设计还原能力，包括单张参考图视觉摘要、当前 BrowserView 截图落盘、两张截图对比、diff 图和三栏 comparison 图生成。
- `admin.ts`：受控管理能力，目前用于写入 `agent-runtime.json` 的 `env`、`skillCredentials` 等全局运行参数。

审阅重点：

- 每个工具都应有明确的 host 边界，不直接操作 React UI。
- 工具返回给模型的内容要尽量是摘要、路径和结构化 JSON，避免塞入大图或密钥明文。
- 涉及写入磁盘或配置的工具必须有字段 allowlist 和体积上限。

设计工具默认触发：

- 用户给出截图、Figma 图、页面参考图，并要求生成或修改 UI/前端代码。
- 用户反馈页面和参考图不一致，需要按截图修 UI。
- 单张用户截图先走 `design_inspect_image` 做语义摘要；已有页面候选图后再走截图比照，避免把同一张图自己和自己比较。
