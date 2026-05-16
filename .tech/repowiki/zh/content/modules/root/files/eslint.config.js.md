# eslint.config.js

> 模块：`root` · 语言：`javascript` · 行数：34

## 文件职责

ESLint 配置，使用 typescript-eslint 规则集，忽略构建产物目录

## 依赖输入

- `@eslint/js`
- `globals`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
- `typescript-eslint`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```javascript
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
	{ ignores: ['dist', 'dist-react', 'dist-electron'] },
	{
		extends: [js.configs.recommended, ...tseslint.configs.recommended],
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.browser,
		},
		plugins: {
			'react-hooks': reactHooks,
			'react-refresh': reactRefresh,
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			'react-refresh/only-export-components': [
				'warn',
				{ allowConstantExport: true },
			],
		},
		settings: {
			"import/resolver": {
				"typescript": {}
			}
		}
	},
)

```
