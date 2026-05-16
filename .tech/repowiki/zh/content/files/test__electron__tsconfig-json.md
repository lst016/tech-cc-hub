# test/electron/tsconfig.json

> 模块：`test` · 语言：`json` · 行数：19

## 文件职责

TypeScript编译配置，指定测试输出到dist-test目录，包含node和项目自定义types

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ESNext",
    "module": "NodeNext",
    "outDir": "../../dist-test",
    "rootDir": "../..",
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "types": [
      "node",
      "../../types"
    ]
  },
  "include": [
    "./**/*.test.ts"
  ]
}

```
