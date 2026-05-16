# tsconfig.app.json

> 模块：`root` · 语言：`json` · 行数：44

## 文件职责

React 前端 TypeScript 配置，编译 src/ui、src/shared、types.d.ts

## 关键符号

- `jsx@0 - jsx: react-jsx，启用新版 JSX 转换`
- `baseUrl/paths@0 - @/ alias 指向 ./src/，便于模块导入`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```json
{
    "compilerOptions": {
        "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
        "target": "ES2020",
        "useDefineForClassFields": true,
        "lib": [
            "ES2020",
            "DOM",
            "DOM.Iterable"
        ],
        "module": "ESNext",
        "skipLibCheck": true,
        "moduleResolution": "bundler",
        "allowImportingTsExtensions": true,
        "isolatedModules": true,
        "moduleDetection": "force",
        "noEmit": true,
        "jsx": "react-jsx",
        "strict": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true,
        "noFallthroughCasesInSwitch": true,
        "noUncheckedSideEffectImports": true,
        "baseUrl": ".",
        "paths": {
            "@/*": [
                "./src/*"
            ]
        },
        "types": [
            "./types"
        ]
    },
    "include": [
        "src/ui",
        "src/shared",
        "types.d.ts",
        "types"
    ],
    "exclude": [
        "src/electron"
    ]
}

```
