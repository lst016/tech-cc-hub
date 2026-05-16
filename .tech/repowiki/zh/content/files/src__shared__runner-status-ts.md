# src/shared/runner-status.ts

> 模块：`electron-runtime` · 语言：`typescript` · 行数：8

## 文件职责

共享的状态判断工具模块，用于判断runner执行结果是否成功

## 关键符号

- `isSuccessfulRunnerResult@0 - 判断消息是否为成功的runner结果（type=result且subtype=success）`
- `shouldSuppressRunnerErrorAfterSuccessfulResult@0 - 判断在已发送成功结果后是否应抑制后续错误`

## 对外暴露

- `isSuccessfulRunnerResult`
- `shouldSuppressRunnerErrorAfterSuccessfulResult`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export function isSuccessfulRunnerResult(message: { type?: unknown; subtype?: unknown }): boolean {
  return message.type === "result" && message.subtype === "success";
}

export function shouldSuppressRunnerErrorAfterSuccessfulResult(hasEmittedSuccessfulResult: boolean): boolean {
  return hasEmittedSuccessfulResult;
}

```
