# 模块改造入口：settings-ui

<agent_card id="module-settings-ui" kind="module">

## 什么时候用
当任务落在 settings-ui 时，优先读取这些高价值文件来确定入口、状态边界、接口契约和验证路径。

## 修改入口
- `src/ui/components/settings/InstallSkillsView.tsx`: 定义或调用跨进程接口
- `src/ui/components/settings/PluginsSettingsPage.tsx`: 定义或调用跨进程接口
- `src/ui/components/settings/MySkillsView.tsx`: 定义或调用跨进程接口
- `src/ui/components/settings/settings-utils.ts`: 被依赖较多或包含关键导出
- `src/ui/components/settings/skill-utils.ts`: 被依赖较多或包含关键导出
- `src/ui/components/settings/ChannelsSettingsPage.tsx`: 被依赖较多或包含关键导出

## 相关文件
- `src/ui/components/settings/InstallSkillsView.tsx`
- `src/ui/components/settings/PluginsSettingsPage.tsx`
- `src/ui/components/settings/MySkillsView.tsx`
- `src/ui/components/settings/settings-utils.ts`
- `src/ui/components/settings/skill-utils.ts`
- `src/ui/components/settings/ChannelsSettingsPage.tsx`
- `src/ui/components/settings/CodeEditor.tsx`
- `src/ui/components/settings/McpSettingsPage.tsx`
- `src/ui/components/settings/ApiProfilesSettingsPage.tsx`
- `src/ui/components/settings/SkillsManagementPage.tsx`

## 改代码指南
- 先确认需求是否真的属于 settings-ui，再从 entryFiles 里包含入口/IPC/schema/store 的文件开始。
- 修改共享契约时同步检查调用方、测试、QA smoke 和 system prompt/overview 影响。
- 如果文件带有 database、ipc、mcp_tool 或 store 信号，优先做真实运行验证。

## 验证方式
- npm run build
- npm run qa:knowledge-ui
- npm run qa:knowledge

## 风险点
- UI 状态不能只存在前端内存，刷新后必须能从后端恢复。
- MCP 注册、工厂映射和 tool handler 任一缺失都会导致 Agent 调用失败。

## 检索关键词
settings-ui, InstallSkillsView.tsx, ui_ipc:skills:searchSkillssh, ui_ipc:skills:fetchLeaderboard, ui_ipc:skills:scanLocalSkills, ui_ipc:skills:installLocal, ui_ipc:preview-open-dialog, ui_ipc:skills:batchImportFolder, ui_ipc:skills:installSkillssh, ui_ipc:skills:previewGitInstall, PluginsSettingsPage.tsx, ui_ipc:plugins:getOpenComputerUseStatus, ui_ipc:plugins:checkOpenComputerUseUpdate, ui_ipc:plugins:getFigmaOfficialStatus, ui_ipc:plugins:installOpenComputerUse, ui_ipc:plugins:connectFigmaDesktopOfficial, ui_ipc:plugins:connectFigmaPatOfficial, ui_ipc:plugins:updateOpenComputerUse, MySkillsView.tsx, ui_ipc:skills:getAllTags, ui_ipc:skills:deleteManagedSkill, ui_ipc:skills:deleteManagedSkills, ui_ipc:skills:removeSkillFromScenario, ui_ipc:skills:addSkillToScenario

## 代码信号
- ui_ipc:skills:searchSkillssh
- ui_ipc:skills:fetchLeaderboard
- ui_ipc:skills:scanLocalSkills
- ui_ipc:skills:installLocal
- ui_ipc:preview-open-dialog
- ui_ipc:skills:batchImportFolder
- ui_ipc:skills:installSkillssh
- ui_ipc:skills:previewGitInstall
- ui_ipc:plugins:getOpenComputerUseStatus
- ui_ipc:plugins:checkOpenComputerUseUpdate
- ui_ipc:plugins:getFigmaOfficialStatus
- ui_ipc:plugins:installOpenComputerUse
- ui_ipc:plugins:connectFigmaDesktopOfficial
- ui_ipc:plugins:connectFigmaPatOfficial
- ui_ipc:plugins:updateOpenComputerUse
- ui_ipc:skills:getAllTags
- ui_ipc:skills:deleteManagedSkill
- ui_ipc:skills:deleteManagedSkills
- ui_ipc:skills:removeSkillFromScenario
- ui_ipc:skills:addSkillToScenario
- ui_ipc:skills:batchUpdateSkills
- event:mcp.list
- ui_ipc:skills:getManagedSkills
- ui_ipc:skills:getScenarios
- ui_ipc:skills:getTools
- ui_ipc:skills:scanLocalSkills

</agent_card>
