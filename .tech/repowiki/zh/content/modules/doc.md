# doc

> 项目文档体系根目录，为 tech-cc-hub 提供唯一事实来源，涵盖产品定义、架构视图、工程契约、模块规格和治理规范。

doc 模块是 tech-cc-hub 项目的文档体系根目录，采用分层架构（L0-L3）组织文档。L0 层定义产品边界与术语；L1 层描述系统架构与容器图；L2 层约束工程契约（IPC、事件、状态机、配置）；L3 层覆盖前端信息架构、工作流规范和回放报告。模块内含工具脚本用于坏链检查和 frontmatter 校验，确保文档质量与一致性。doc/README.md 是唯一入口，指向 CLAUDE.md 和 AGENTS.md 等开发规范文件。

## 文件

### `doc/README.md`

文档体系 v2 的唯一入口索引，定义 00-90 分层结构，关联所有活跃模块的 Spec 入口代码路径

### `doc/adr/README.md`

Architecture Decision Records (ADR) 目录入口，记录已落地的架构决策（ADR-001~005）

### `doc/_tools/check_doc_links.py`

坏链检查与孤儿文档检测脚本，验证 Markdown 链接完整性、旧编号体系残留和文档引用关系

- `should_skip_file` (function) - 判断文件是否应跳过收集（跳过 _tools、AionUi 源码镜像）
- `is_legacy_dir` (function) - 判断文件是否属于旧 CLAW 目录（20-specs、30-operations）
- `collect_md_files` (function) - 收集 doc/ 下所有 .md 文件，排除跳过项
- `extract_markdown_links` (function) - 提取文件中所有 Markdown 链接 [text](target)，返回 (行号, 链接文本, 目标)
- `check_broken_links` (function) - 检查跨文档链接断裂
- `check_orphans` (function) - 检查孤儿文档（未被任何 INDEX.md 或 README.md 引用）
- `check_legacy_numbering` (function) - 检查旧编号体系残留（73+ 流水号模式）
- `main` (function) - 命令行入口，支持 --links、--orphans、--legacy、--skip-legacy-dirs 参数

### `doc/_tools/validate_frontmatter.py`

Markdown frontmatter 校验脚本，验证 YAML 元数据字段完整性、layer 目录约定匹配、H1 标题一致性

- `parse_frontmatter` (function) - 解析 YAML frontmatter，返回 (data dict, body string)
- `extract_h1` (function) - 从 body 提取第一个 H1 标题
- `validate_file` (function) - 校验单个文件的 frontmatter 完整性、required fields、layer 匹配、title 与 H1 一致性
- `main` (function) - 命令行入口，扫描 doc/ 下 managed roots 并输出校验结果

### `doc/00-overview/00-产品定义.md`

定义 CLAW 产品定位、边界和 North Star，约束后续所有规范

### `doc/00-overview/01-设计原则与非目标.md`

固定架构红线，明确非目标（不做新推理 runtime、不做多租户、不做超长混写文档）

### `doc/00-overview/02-术语表.md`

建立统一术语（AgentOS、AgentAdapter、TaskNode、EventEnvelope、SpecAsset、RuntimeAsset 等）

### `doc/00-overview/03-文档索引.md`

文档体系唯一入口，定义阅读顺序、波次关系和文档分层

### `doc/00-overview/04-问题定义与成功指标.md`

定义问题空间、目标用户分层、JTBD 和 3/6/12 个月成功指标

### `doc/10-architecture/10-系统上下文图.md`

定义 CLAW 与用户、AgentOS、本地存储的边界（C1）

### `doc/10-architecture/11-系统容器图.md`

定义一级容器（Desktop GUI、Backend Runtime、Agent Integration Runtime、Storage、Replay Engine）

### `doc/10-architecture/12-控制平面组件图.md`

拆解控制平面组件（Chat Workspace、Agent Picker、Task Graph、Session Service、Permission Gateway）

### `doc/10-architecture/13-执行平面组件图.md`

拆解执行平面组件（Hub Orchestrator、Worker Manager、Adapter Registry、Merge Engine）

### `doc/10-architecture/14-数据与智能平面组件图.md`

拆解数据平面组件（Event Store、Session State Store、Replay Builder、Metrics Engine）

### `doc/10-architecture/15-核心流程图.md`

描述四条主流程（聊天代理选择、任务图拆分、上下文同步、事件到回放生成）

### `doc/10-architecture/16-用量与上下文采集架构.md`

描述执行用量采集（SDKResultMessage）和上下文构成采集（Prompt buckets/segments）的完整链路

### `doc/20-contracts/INDEX.md`

工程契约层索引，定义跨模块稳定契约的来源（IPC、事件、状态机、数据模型、配置模型）

### `doc/20-contracts/ipc/spec.md`

定义 Electron 主进程与渲染进程之间的 IPC 通道、ServerEvent/ClientEvent 类型枚举、消息格式及错误处理约定

### `doc/20-contracts/events/spec.md`

定义应用层生命周期事件（SessionStatus）和 Agent 执行轨迹事件（NodeKind、NodeStatus、ActivityExecutionMetrics）

### `doc/20-contracts/session-lifecycle/spec.md`

定义会话/消息/事件状态机（已引用但文件内容截断）

### `doc/20-contracts/config/spec.md`

定义四类持久化配置模型（ApiConfigProfiles、GlobalRuntimeConfig、SkillInventory、.skill-lock.json）

### `doc/20-specs/20-AgentOS集成规范.md`

定义 AgentOS 接入边界、AgentAdapter 接口、能力发现和事件归一

### `doc/20-specs/21-统一能力模型.md`

统一核心对象抽象（Session、TaskNode、ContextSnapshot、EventEnvelope、SpecAsset、RuntimeAsset）

## 关键概念

- **L0-L3 分层架构**: 文档按分层组织：L0 产品定义、L1 系统架构、L2 工程契约、L3 运行规范
- **SpecAsset vs RuntimeAsset**: SpecAsset 是 workflow/skills/prompts/policies 等可版本化资产；RuntimeAsset 是 session/task/event/snapshot 等运行资产。两者必须分层管理、单独建模。
- **AgentAdapter 统一适配接口**: CLAW 对 AgentOS（Claude Code/Codex）的深适配接口，声明标准能力矩阵并负责事件归一化。
- **Primary Interactive Agent**: 聊天界面当前主交互 Agent，取值仅为 Claude Code 或 Codex，默认 Claude Code，同一时刻只能绑定一个。
- **EventEnvelope**: 所有运行时事件的统一承载格式，用于事件重建、时间线生成和回放闭环。
- **ServerEvent/ClientEvent**: Electron IPC 层双向事件类型，ServerEvent 从主进程到渲染进程，ClientEvent 从渲染进程到主进程。
- **NodeKind 枚举**: ActivityRail 中 Agent 执行轨迹节点的类型分类（context/plan/assistant_output/tool_input/file_read/terminal/browser/error/lifecycle 等）。
- **Frontmatter 规范**: 每个 Markdown 文件以 YAML frontmatter 开头，包含 doc_id/title/doc_type/layer/status/version/owners/tags 等元数据字段。
- **坏链检查与孤儿文档**: _tools/check_doc_links.py 验证 Markdown 链接完整性、旧编号体系残留和文档引用覆盖率。
- **ADR (Architecture Decision Record)**: 架构决策记录，存于 doc/adr/ 目录，已落地 ADR-001~005（统一能力模型、混合双核运行时、递归任务图预算、RuntimeAsset 真相来源、SpecAsset 版本治理）。

## 内部关系

- `doc/README.md` → `doc/00-overview/`: 文档体系入口索引引用 L0 层所有概览文档
- `doc/README.md` → `doc/10-architecture/`: 入口索引引用 L1 层架构图文档
- `doc/README.md` → `doc/20-contracts/`: 入口索引引用 L2 层工程契约索引
- `doc/_tools/check_doc_links.py` → `doc/_tools/validate_frontmatter.py`: 同级工具脚本，共同保障文档质量
- `doc/20-contracts/INDEX.md` → `doc/20-contracts/ipc/spec.md`: 契约索引引用 IPC 规范
- `doc/20-contracts/INDEX.md` → `doc/20-contracts/events/spec.md`: 契约索引引用事件规范
- `doc/20-contracts/INDEX.md` → `doc/20-contracts/session-lifecycle/spec.md`: 契约索引引用会话生命周期规范
- `doc/20-contracts/INDEX.md` → `doc/20-contracts/config/spec.md`: 契约索引引用配置规范
- `doc/00-overview/03-文档索引.md` → `doc/20-specs/`: 阅读路径引用 L2 层规格文档
- `doc/20-specs/20-AgentOS集成规范.md` → `doc/20-specs/21-统一能力模型.md`: 集成规范依赖统一能力模型定义的核心类型
