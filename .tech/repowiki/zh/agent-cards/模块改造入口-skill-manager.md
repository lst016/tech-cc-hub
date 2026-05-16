# 模块改造入口：skill-manager

<agent_card id="module-skill-manager" kind="module">

## 什么时候用
当任务落在 skill-manager 时，优先读取这些高价值文件来确定入口、状态边界、接口契约和验证路径。

## 修改入口
- `src/electron/libs/skill-manager/ipc-handlers.ts`: 定义或调用跨进程接口
- `src/electron/libs/skill-manager/db.ts`: 包含 SQLite/FTS/vector schema 或索引写入
- `src/electron/libs/skill-manager/index.ts`: 入口文件，适合从这里跟踪启动链路
- `src/electron/libs/skill-manager/scenarios.ts`: 被依赖较多或包含关键导出
- `src/electron/libs/skill-manager/sync-engine.ts`: 被依赖较多或包含关键导出
- `src/electron/libs/skill-manager/tool-adapters.ts`: 被依赖较多或包含关键导出

## 相关文件
- `src/electron/libs/skill-manager/ipc-handlers.ts`
- `src/electron/libs/skill-manager/db.ts`
- `src/electron/libs/skill-manager/index.ts`
- `src/electron/libs/skill-manager/scenarios.ts`
- `src/electron/libs/skill-manager/sync-engine.ts`
- `src/electron/libs/skill-manager/tool-adapters.ts`
- `src/electron/libs/skill-manager/types.ts`

## 改代码指南
- 先确认需求是否真的属于 skill-manager，再从 entryFiles 里包含入口/IPC/schema/store 的文件开始。
- 修改共享契约时同步检查调用方、测试、QA smoke 和 system prompt/overview 影响。
- 如果文件带有 database、ipc、mcp_tool 或 store 信号，优先做真实运行验证。

## 验证方式
- npm run build
- npm run qa:knowledge

## 风险点
- Electron 主进程、renderer bridge 和浏览器预览数据源可能不一致。
- MCP 注册、工厂映射和 tool handler 任一缺失都会导致 Agent 调用失败。

## 检索关键词
skill-manager, ipc-handlers.ts, ipc:skills:getManagedSkills, ipc:skills:getSkillsForScenario, ipc:skills:getSkillDocument, ipc:skills:deleteManagedSkill, ipc:skills:deleteManagedSkills, ipc:skills:installLocal, ipc:skills:batchImportFolder, ipc:skills:getAllTags, db.ts, database:skills, database:scenarios, database:scenario_skills, database:scenario_skill_tools, database:skill_targets, database:skill_tags, database:settings, database:idx_scenario_skills_skill, index.ts, entrypoint:src/electron/libs/skill-manager/index.ts, scenarios.ts, sync-engine.ts, tool-adapters.ts

## 代码信号
- ipc:skills:getManagedSkills
- ipc:skills:getSkillsForScenario
- ipc:skills:getSkillDocument
- ipc:skills:deleteManagedSkill
- ipc:skills:deleteManagedSkills
- ipc:skills:installLocal
- ipc:skills:batchImportFolder
- ipc:skills:getAllTags
- database:skills
- database:scenarios
- database:scenario_skills
- database:scenario_skill_tools
- database:skill_targets
- database:skill_tags
- database:settings
- database:idx_scenario_skills_skill
- entrypoint:src/electron/libs/skill-manager/index.ts

</agent_card>
