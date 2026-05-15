# doc

> Centralized documentation system providing project navigation, architecture decision records, standards, and templates for tech-cc-hub

The doc module is the single source of truth for project documentation. It organizes documents by layer (L0-L9), enforces a standardized YAML front matter format, provides ADR tracking, and includes validation tooling. The module serves contributors, frontend developers, and Electron implementers by offering structured entry points to architecture, contracts, engineering, quality, and operations documentation.

## 文件

### `doc/adr/README.md`

Entry point for Architecture Decision Records, listing all finalized ADRs with links

- `ADR-001` (adr) - Unified capability model strategy
- `ADR-002` (adr) - Hybrid dual-core runtime
- `ADR-003` (adr) - Recursive task graph budget and stop strategy
- `ADR-004` (adr) - RuntimeAsset source of truth
- `ADR-005` (adr) - SpecAsset version governance strategy

### `doc/README.md`

Main documentation entry point v2, providing layered navigation table for all project docs

- `layer_index` (table) - Maps doc types to directories: Architecture (10-), Contracts (20-), Engineering (40-), Quality (50-), Operations (80-)
- `module_map` (table) - Active modules with spec paths and entry code files

### `doc/_standards/Markdown-Frontmatter-规范.md`

Defines required YAML front matter fields for all managed documents

- `required_fields` (const) - doc_id, title, doc_type, layer, status, version, last_updated, owners, tags
- `layer_values` (const) - L0, L1, L2, L3, PM, meta, root, adr
- `doc_type_values` (const) - overview, diagram, contract, operations, index, readme, template, standard, prd, requirement, epic, delivery, matrix, component, controller

### `doc/_standards/文档贡献规范.md`

Legacy contribution guide for document maintenance (superseded by v2 standard)

- `semantic_directories` (const) - Directory usage rules: 00-overview/, 10-architecture/, 20-specs/, 30-operations/, adr/, _templates/, _standards/, _tools/
- `when_to_write_adr` (rule) - Must write ADR when changing AgentOS unified capability model, event model, SpecAsset/RuntimeAsset governance, storage truth source, or recursive task graph budget

### `doc/_standards/软件工程文档体系规范.md`

V2 documentation governance standard defining layers, types, lifecycle, and ownership rules

- `layer_definitions` (table) - L0 (overview) through L9 (archive), meta, template, tool
- `doc_type_definitions` (table) - 14 document types with purpose and required questions
- `lifecycle_states` (const) - active, draft, proposed, accepted, deprecated, archived
- `numbered_range_rules` (const) - 00-09 (overview), 10-19 (architecture), 20-29 (contracts), 30-39 (operations)

### `doc/_templates/ADR-000-模板.md`

Template for Architecture Decision Records with Context/Decision/Consequences structure

### `doc/_templates/AI-Spec-模板.md`

Template for engineering specifications including Purpose, Scope, Actors, Inputs/Outputs, Core Concepts, Behavior/Flow, Interfaces/Types, Failure Modes, Observability, Open Questions

### `doc/_templates/工作流Markdown模板-标准版.md`

Template for workflow definitions with YAML header and step-by-step execution flow

- `workflow_yaml_fields` (const) - workflow_id, name, version, scope, mode, entry, owner, auto_advance, tags
- `step_yaml_fields` (const) - id, title, executor, intent, user_actions, done_when

### `doc/_templates/聊天工作流模板.md`

Simplified workflow template for single-thread chat-based execution

### `doc/_tools/audit_frontmatter.py`

Audits all markdown files for front matter completeness, required fields, and title consistency

- `required_fields` (const) - List of mandatory front matter fields
- `audit_issues` (output) - Reports: NO_FRONTMATTER, BAD_FRONTMATTER, YAML_ERROR, NOT_DICT, MISSING_FIELDS, TITLE_MISMATCH

### `doc/_tools/check_doc_links.py`

Validates markdown links, detects orphan documents, and flags legacy numbering

- `LEGACY_DIRS` (const) - 20-specs, 30-operations - pre-migration directories
- `AIONUI_MIRROR` (const) - 00-research/AionUi - source mirror to skip
- `check_link` (function) - Validates individual markdown link target exists
- `find_orphans` (function) - Detects markdown files not referenced by any INDEX.md or README.md
- `check_legacy_numbering` (function) - Flags files matching 73+ sequential number pattern

### `doc/_tools/validate_frontmatter.py`

Validates front matter compliance with CLAW 1.0.0 standards including field presence, type checking, and layer consistency

- `MANAGED_ROOTS` (const) - Directories requiring front matter: 00-overview, 10-architecture, 20-specs, 30-operations, 40-product, _templates, _standards, adr
- `expected_layer` (function) - Maps directory path to expected layer value
- `parse_frontmatter` (function) - Parses YAML front matter from markdown content
- `validate` (function) - Main validation function checking required fields, version, and title match

### `doc/00-overview/00-产品定义.md`

Defines CLAW product positioning, boundaries, target users, and core value proposition

- `CLAW` (concept) - Semi-managed control layer built on AgentOS like Claude Code/Codex
- `SpecAsset` (concept) - Versionable assets: workflows, skills, prompts, policies, task templates
- `RuntimeAsset` (concept) - Runtime artifacts: sessions, tasks, events, snapshots, timelines, replays
- `Control Plane` (concept) - User control, task orchestration, permission decisions, collaboration views
- `Execution Plane` (concept) - AgentOS session bridge, worker scheduling, event ingestion, result writing

### `doc/00-overview/01-设计原则与非目标.md`

Establishes architecture red lines and explicit non-goals to prevent scope creep

- `上层软件层原则` (rule) - CLAW does not接管 LLM inference or底层工具系统
- `本地优先原则` (rule) - Local filesystem is v1 truth source
- `双中心原则` (rule) - SpecAsset and RuntimeAsset are equal first-class assets
- `统一优先原则` (rule) - Abstract Claude Code and Codex common capabilities first

### `doc/00-overview/02-术语表.md`

Unified glossary of key terms with English type names and owner spec references

- `AgentOS` (type) - External agent system providing底层 execution
- `AgentAdapter` (type) - CLAW's unified integration interface for AgentOS
- `AgentCapability` (type) - Standardized capability set AgentOS can declare
- `Session` (type) - User-level execution context and lifecycle container
- `TaskNode` (type) - Smallest schedulable unit in task graph
- `EventEnvelope` (type) - Unified carrier format for all runtime events

### `doc/00-overview/03-文档索引.md`

唯一入口文档，提供阅读顺序、波次关系和文档分层索引

- `recommended_reading_paths` (table) - Four reading paths: new member onboarding, runtime implementation, frontend/tuning implementation, versioned product docs
- `L0_L3_layers` (const) - L0 (overview), L1 (architecture), L2 (contracts), L3 (operations)

## 关键概念

- **front matter**：YAML block at markdown file start containing metadata (doc_id, title, doc_type, layer, status, version, last_updated, owners, tags). Required for all managed documents to enable tooling, indexing, and state tracking.
- **layer**：Document classification (L0-L9, meta, template, tool) indicating which engineering level the doc belongs to. L0 is overview, L1 is architecture, L2 is contracts, L3 is operations, L9 is archive.
- **doc_type**：Document purpose classification (overview, prd, spec, architecture, adr, etc.) distinguishing document intent from directory names.
- **ADR (Architecture Decision Record)**：Formal record of significant architectural decisions with Context, Decision, and Consequences sections. Stored in doc/adr/ with sequential numbering.
- **SpecAsset**：Versionable artifacts (workflows, skills, prompts, policies, task templates) that define what the agent should do. Stored separately from runtime artifacts.
- **RuntimeAsset**：Runtime artifacts (sessions, tasks, events, snapshots, timelines, replays) capturing what actually happened during execution.
- **source of truth**：Principle that one concept has exactly one primary spec owner; other documents should reference, not rewrite.

## 内部关系

- `doc/_tools/audit_frontmatter.py` -> `doc/_standards/Markdown-Frontmatter-规范.md`：Script implements validation rules defined in the standard document
- `doc/_tools/validate_frontmatter.py` -> `doc/_standards/Markdown-Frontmatter-规范.md`：Script validates front matter compliance against the standard
- `doc/_tools/check_doc_links.py` -> `doc/_standards/软件工程文档体系规范.md`：Script checks for legacy numbering patterns defined in the v2 standard
- `doc/README.md` -> `doc/00-overview/03-文档索引.md`：Main README references L0 index as primary navigation entry
- `doc/adr/README.md` -> `doc/_templates/ADR-000-模板.md`：ADR README references the template for creating new decisions
- `doc/00-overview/03-文档索引.md` -> `doc/00-overview/00-产品定义.md`：Index references product definition as first read
- `doc/00-overview/03-文档索引.md` -> `doc/00-overview/01-设计原则与非目标.md`：Index references design principles as second read
- `doc/00-overview/02-术语表.md` -> `doc/_standards/软件工程文档体系规范.md`：Glossary terms reference their owner specs defined in the v2 standard
