# .mcp.json

> 模块：`root` · 语言：`json` · 行数：14

## 文件职责

MCP（Model Context Protocol）服务器配置，定义 chrome-devtools 和 windows 两个 MCP 服务

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "cmd",
      "args": ["/c", "npx", "chrome-devtools-mcp@latest"],
      "type": "stdio"
    },
    "windows": {
      "command": "darbot-windows-mcp",
      "type": "stdio"
    }
  }
}

```
