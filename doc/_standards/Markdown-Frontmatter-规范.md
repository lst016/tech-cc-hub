---
doc_id: "FRONTMATTER-STANDARD"
title: "Markdown Front Matter 规范"
doc_type: "standard"
layer: "meta"
status: "active"
version: "1.0.0"
last_updated: "2026-04-19"
owners:
  - "CLAW Core"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "meta"
  - "standard"
---

# Markdown Front Matter 规范

## Purpose
定义 CLAW 1.0.0 文档体系中所有 Markdown 文件的统一 YAML front matter 规范，保证文档可索引、可筛选、可追踪、可被工具自动处理。

## Scope
本规范适用于 `doc` 下的架构文档、契约文档、运行文档、模板和 README。
本规范不约束 `doc/` 下历史草稿的格式。

## Actors / Owners
- Owner: CLAW Core
- Readers: 所有文档编写者、维护者、未来的自动化工具实现者

## Inputs / Outputs
- Inputs: 文档路径、文档标题、文档类型、维护状态
- Outputs: 统一 YAML front matter

## Core Concepts
- `front matter`: 位于 Markdown 文件开头，由 `---` 包裹的 YAML 块。
- `required fields`: 所有 1.0.0 正式文档必须具备的字段。
- `optional fields`: 仅在需要时填写的字段。

## Behavior / Flow
所有受管理的 `doc` 文档都应遵守以下规则：

1. 文件必须以 YAML front matter 开头。
2. front matter 与正文之间保留一个空行。
3. `title` 必须与文档主标题一致。
4. `doc_id` 应尽量稳定，不随标题调整频繁变化。
5. `layer` 应与目录层级一致。
6. `doc_type` 应表达文档用途，而不是目录名复述。
7. `version` 在当前文档体系中统一为 `1.0.0`。

## Interfaces / Types
### Required Fields

| Field | Type | Meaning |
|---|---|---|
| `doc_id` | string | 文档稳定标识 |
| `title` | string | 文档标题 |
| `doc_type` | string | 文档类型 |
| `layer` | string | 所属层级 |
| `status` | string | 文档状态 |
| `version` | string | 文档体系版本 |
| `last_updated` | date | 最后更新时间 |
| `owners` | list[string] | 文档维护责任方 |
| `tags` | list[string] | 检索和自动化标签 |

### Recommended Values

#### `layer`
- `L0`
- `L1`
- `L2`
- `L3`
- `PM`
- `meta`
- `root`
- `adr`

#### `doc_type`
- `overview`
- `diagram`
- `contract`
- `operations`
- `index`
- `readme`
- `template`
- `standard`
- `prd`
- `requirement`
- `epic`
- `delivery`
- `matrix`
- `component`
- `controller`

#### `status`
- `active`
- `draft`
- `template`
- `reference`

### Example

```yaml
---
doc_id: "24"
title: "事件模型与可观测规范"
doc_type: "contract"
layer: "L2"
status: "active"
version: "1.0.0"
last_updated: "2026-04-19"
owners:
  - "CLAW Core"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "L2"
  - "observability"
---
```

## Failure Modes
- 若没有统一 front matter，后续很难自动生成目录、看板、索引或文档状态视图。
- 若 `title` 与正文标题不一致，会导致 Obsidian 或自动化工具出现双重标题语义冲突。
- 若 `doc_id` 不稳定，后续链接和引用会变得脆弱。

## Observability
- 后续可以据此自动校验：
  - 哪些文档缺 front matter
  - 哪些文档缺必填字段
  - 哪些文档 `layer` 与路径不一致

## Open Questions / ADR Links
- 如未来引入文档站点生成器，可在不改正文结构的情况下直接消费本规范。
- 校验脚本见 [../_tools/validate_frontmatter.py](../_tools/validate_frontmatter.py)
- 贡献规则见 [文档贡献规范.md](./%E6%96%87%E6%A1%A3%E8%B4%A1%E7%8C%AE%E8%A7%84%E8%8C%83.md)
