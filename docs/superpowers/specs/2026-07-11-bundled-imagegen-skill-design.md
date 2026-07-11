# 内置 Imagegen 系统 Skill 设计

## 目标

tech-cc-hub 随应用提供 Codex 官方 `imagegen` 系统 skill，使新安装的软件不依赖用户机器上 `%USERPROFILE%\.codex\skills\.system\imagegen` 的现有副本。内置副本保留官方目录、正文、脚本、参考资料、资源和许可证，仅把 `SKILL.md` frontmatter 中的 `description` 改为中文。

## 方案

1. 将官方 `imagegen` 目录完整收录为项目内置资源，并由 Electron Builder 复制到应用资源目录。
2. 开发环境和打包环境通过同一个解析函数定位内置 skill 根目录。
3. slash command 发现链路优先扫描内置根目录，使 `/imagegen` 稳定展示中文 description，并加载内置 `SKILL.md`。
4. 自然语言生图请求在启用 `tech-cc-hub-image` MCP 时自动注入内置 skill 指令，不要求用户显式输入 `/imagegen`。
5. 运行时追加一段 tech-cc-hub 适配说明：官方文档中的 `image_gen` 对应现有 `image_generate` MCP 工具；skill 内的相对资源和脚本以实际内置目录为基准。适配说明位于软件层，不修改官方 skill 正文。
6. 保留现有 `image_generate` 工具名和结果契约，避免破坏已上线的生图卡片、配置路由和历史会话。

## 错误处理

- 内置资源缺失或不可读时不阻断普通对话；slash catalog 忽略缺失目录，runner 不追加 skill 内容。
- 生图工具仍按现有结构返回未配置、鉴权、限流和参考图错误。
- 用户本地同名 skill 不覆盖应用内置版本；应用内置版本作为 tech-cc-hub 的确定性执行基线。

## 验证

- 测试先证明当前代码不能发现打包内置 `imagegen`、不能显示中文 description、不能对自然语言生图请求注入 skill。
- 实现后运行 slash command、runtime efficiency、runner prompt、MCP registry 和打包资源定向测试。
- 运行 Electron TypeScript 编译和项目 build，确认普通任务不加载 imagegen 指令。

## 非目标

- 不修改官方 `SKILL.md` 正文、references、scripts 或 assets。
- 不向用户的 `.codex` 目录写入或覆盖文件。
- 不更改现有生图模型选择、API 路由或图片结果展示协议。
