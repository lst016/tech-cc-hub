# 阅读指南

这是一个基于Electron的桌面Agent工作台项目，核心功能包括多模型路由、任务编排、内置浏览器和skills系统。建议从入口文件和类型定义开始，然后深入状态管理和核心逻辑层，最后查看工具函数和UI组件。

## Step 1: 理解项目结构和入口点 (15分钟)

**文件：** `pro-workflow/src/db/index.ts`, `src/ui/App.tsx`, `src/ui/types.ts`

pro-workflow/src/db/index.ts是pro-workflow模块的入口，App.tsx是UI主入口。types.ts定义了所有核心类型(Types、Interfaces、Enums)，理解这些类型是理解整个应用的基础。重点关注Task、Session、Agent、Skill等核心实体的数据结构。

## Step 2: 掌握状态管理架构 (20分钟)

**文件：** `src/ui/store/useAppStore.ts`, `src/ui/store/taskStore.ts`, `pro-workflow/src/db/store.ts`

useAppStore.ts是Zustand状态管理的核心文件，1100多行代码管理整个应用状态。taskStore.ts管理任务状态。store.ts管理pro-workflow的持久化数据。关注状态的分片方式、actions的命名规范、以及状态如何驱动UI更新。

## Step 3: 理解事件系统和通信机制 (10分钟)

**文件：** `src/ui/events.ts`, `src/ui/dev-electron-shim.ts`

events.ts是事件总线，负责组件间通信和外部事件处理。dev-electron-shim.ts提供Electron API的桥接适配。理解事件驱动架构如何连接UI层和数据层。

## Step 4: 探索shared层共享工具 (10分钟)

**文件：** `src/shared/slash-commands.ts`, `src/ui/utils/clipboard.ts`, `src/ui/utils/workbench-url.ts`

shared目录存放跨模块复用的工具。slash-commands.ts处理斜杠命令解析，是Agent交互的核心入口。utils目录包含clipboard和URL处理等小工具。先看小文件建立对shared层的感觉。

## Step 5: 深入settings系统 (20分钟)

**文件：** `src/ui/components/settings/settings-utils.ts`, `src/ui/components/settings/skill-utils.ts`, `src/ui/components/settings/InstallSkillsView.tsx`, `src/ui/components/settings/MySkillsView.tsx`

settings系统是项目的重要功能模块。settings-utils.ts(363行)提供配置管理核心逻辑，skill-utils.ts处理skill相关工具。InstallSkillsView和MySkillsView展示skill安装和管理的UI模式。注意配置持久化、验证和UI组件的分离方式。

## Step 6: 分析UI组件架构 (15分钟)

**文件：** `src/ui/components/DecisionPanel.tsx`, `src/ui/components/ModelSelect.tsx`, `src/ui/components/ActivityWorkspaceTabs.tsx`

这些是核心UI组件。DecisionPanel负责决策交互，ModelSelect处理多模型选择，ActivityWorkspaceTabs管理工作区标签。重点理解组件如何从store订阅状态、如何处理用户交互、以及组件间的通信方式。

## Step 7: 查看渲染和Markdown处理 (10分钟)

**文件：** `src/ui/render/markdown.tsx`

markdown.tsx处理内容渲染，是UI层的重要组成部分。理解渲染管道的设计，以及如何处理不同类型的内容展示。

## Step 8: 探索skills和git相关工具 (10分钟)

**文件：** `src/ui/components/git/git-ui-utils.ts`, `src/ui/components/settings/skill-icons.tsx`, `src/ui/components/settings/SkillDashboard.tsx`

git-ui-utils.ts处理Git相关UI逻辑。skill-icons.tsx和SkillDashboard.tsx展示skills系统的视觉呈现。了解插件化skill系统的实现模式。

## Tips

- App.tsx有1879行，是最大的文件，建议最后再深入阅读或使用IDE的大纲视图导航
- pro-workflow模块是独立的工作流系统，理解它与主应用的边界很重要
- 状态管理使用Zustand，如果熟悉React状态管理可以快速上手
- Electron主进程代码在electron目录下，建议单独阅读
- 遇到复杂组件时，先看props类型定义，理解接口再读实现
