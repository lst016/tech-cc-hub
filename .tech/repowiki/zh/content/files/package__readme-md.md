# package/README.md

> 模块：`package` · 语言：`markdown` · 行数：44

## 文件职责

SDK使用文档和迁移指南链接

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Claude Agent SDK

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square) [![npm]](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)

[npm]: https://img.shields.io/npm/v/@anthropic-ai/claude-agent-sdk.svg?style=flat-square

The Claude Agent SDK enables you to programmatically build AI agents with Claude Code's capabilities. Create autonomous agents that can understand codebases, edit files, run commands, and execute complex workflows.

**Learn more in the [official documentation](https://platform.claude.com/docs/en/agent-sdk/overview)**.

## Get started

Install the Claude Agent SDK:

```sh
npm install @anthropic-ai/claude-agent-sdk
```

## Migrating from the Claude Code SDK

The Claude Code SDK is now the Claude Agent SDK. Please check out the [migration guide](https://platform.claude.com/docs/en/agent-sdk/migration-guide) for details on breaking changes.

## Reporting Bugs

We welcome your feedback. File a [GitHub issue](https://github.com/anthropics/claude-agent-sdk-typescript/issues) to report bugs or request features.

## Connect on Discord

Join the [Claude Developers Discord](https://anthropic.com/discord) to connect with other developers building with the Claude Agent SDK. Get help, share feedback, and discuss your projects with the community.

## Data collection, usage, and retention

When you use the Claude Agent SDK, we collect feedback, which includes usage data (such as code acceptance or rejections), associated conversation data, and user feedback submitted via the /bug command.

### How we use your data

See our [data usage policies](https://docs.anthropic.com/en/docs/claude-code/data-usage).

### Privacy safeguards

We have implemented several safeguards to protect your data, including limited retention periods for sensitive information and restricted access to user session data.

For full details, please review our [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) and [Privacy Policy](https://www.anthropic.com/legal/privacy).

```
