# tsconfig.node.json

> 模块：`root` · 语言：`json` · 行数：27

## 文件职责

Node 端 TypeScript 配置，用于 vite.config.ts 等 Node 脚本

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```json
{
	"compilerOptions": {
		"tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
		"target": "ES2022",
		"lib": [
			"ES2023"
		],
		"module": "ESNext",
		"skipLibCheck": true,
		/* Bundler mode */
		"moduleResolution": "bundler",
		"allowImportingTsExtensions": true,
		"isolatedModules": true,
		"moduleDetection": "force",
		"noEmit": true,
		/* Linting */
		"strict": true,
		"noUnusedLocals": true,
		"noUnusedParameters": true,
		"noFallthroughCasesInSwitch": true,
		"noUncheckedSideEffectImports": true
	},
	"include": [
		"vite.config.ts"
	]
}

```
