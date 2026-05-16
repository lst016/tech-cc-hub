# tsconfig.json

> 模块：`root` · 语言：`json` · 行数：12

## 文件职责

TypeScript 项目引用配置，引用 tsconfig.app.json 和 tsconfig.node.json

## 关键符号

- `references@0 - 项目引用数组，指向 app 和 node 两个子配置`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```json
{
	"files": [],
	"references": [
		{
			"path": "./tsconfig.app.json"
		},
		{
			"path": "./tsconfig.node.json"
		}
	]
}

```
