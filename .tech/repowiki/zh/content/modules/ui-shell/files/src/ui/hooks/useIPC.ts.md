# src/ui/hooks/useIPC.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：32

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `useIPC@3`
- `unsubscribeRef@6`
- `unsubscribe@10`
- `sendEvent@25`

## 依赖输入

- `react`
- `../types`

## 对外暴露

- `useIPC`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { useCallback, useEffect, useRef, useState } from "react";
import type { ServerEvent, ClientEvent } from "../types";

export function useIPC(onEvent: (event: ServerEvent) => void) {
  const [connected, setConnected] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Subscribe to server events
    const unsubscribe = window.electron.onServerEvent((event: ServerEvent) => {
      onEvent(event);
    });

    unsubscribeRef.current = unsubscribe;
    setConnected(true);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      setConnected(false);
    };
  }, [onEvent]);

  const sendEvent = useCallback((event: ClientEvent) => {
    window.electron.sendClientEvent(event);
  }, []);

  return { connected, sendEvent };
}

```
