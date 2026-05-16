# pro-workflow/skills/survey-generator/templates/research_bundle.template.json

> 模块：`pro-workflow` · 语言：`json` · 行数：62

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```json
{
  "topic": "<concise survey topic, e.g. 'Reasoning Models'>",
  "anchor_source": "<URL of the public anchor: arXiv survey, awesome-list, canonical blog post>",
  "abstract_hints": [
    "<one bullet on the core motivation>",
    "<one bullet on the key contributions to highlight>",
    "<one bullet on the open questions to surface in the conclusion>"
  ],
  "taxonomy": [
    {
      "branch": "<top-level category 1>",
      "description": "<one sentence>",
      "children": [
        {"name": "<sub-area>", "description": "<one sentence>"},
        {"name": "<sub-area>", "description": "<one sentence>"}
      ]
    }
  ],
  "sections": [
    {
      "n": 1,
      "title": "Introduction",
      "guidance": "Frame the topic, state why it matters now, preview the taxonomy.",
      "papers": []
    },
    {
      "n": 2,
      "title": "Foundations",
      "guidance": "Cover the prerequisite concepts and earliest-cited papers.",
      "papers": ["author1-year-key", "author2-year-key"]
    },
    {
      "n": 3,
      "title": "Methods",
      "guidance": "Group method papers by taxonomy branch.",
      "papers": []
    },
    {
      "n": 4,
      "title": "Evaluation",
      "guidance": "Benchmarks, evaluation protocols, contested measurements.",
      "papers": []
    },
    {
      "n": 5,
      "title": "Open Problems",
      "guidance": "What remains unsolved, what the field disagrees on.",
      "papers": []
    }
  ],
  "bibliography": [
    {
      "key": "author1-year-shortname",
      "authors": "Last, F., Other, A.",
      "year": 2024,
      "title": "<paper title>",
      "venue": "<conference/journal/arXiv:NNNN.NNNNN>",
      "summary": "<one to two sentence summary of contribution>"
    }
  ]
}

```
