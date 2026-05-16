# src/electron/libs/mcp-tools/figma-locator.ts

> 模块：`mcp-tools` · 语言：`typescript` · 行数：49

## 文件职责

Figma 链接解析：解析 Figma URL 或 fileKey，提取 fileKey 和 nodeId

## 关键符号

- `FigmaLocator@0 - 解析结果类型 {fileKey, nodeIds}`
- `parseFigmaLocator@0 - 解析 Figma URL 或 fileKey，支持设计文件/board/slides/proto/make 路径`

## 对外暴露

- `FigmaLocator`
- `parseFigmaLocator`
- `normalizeNodeId`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export type FigmaLocator = {
  fileKey: string;
  nodeIds: string[];
};

export function parseFigmaLocator(fileKeyOrUrl: string, explicitNodeIds: string[] = []): FigmaLocator {
  const raw = fileKeyOrUrl.trim();
  if (!raw) {
    throw new Error("Missing Figma file key or URL.");
  }

  const parsedNodeIds = explicitNodeIds.map(normalizeNodeId).filter(Boolean);
  try {
    const url = new URL(raw);
    if (!/figma\.com$/i.test(url.hostname) && !url.hostname.endsWith(".figma.com")) {
      throw new Error("Not a Figma URL.");
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const keySegmentIndex = segments.findIndex((segment) => (
      segment === "design" ||
      segment === "file" ||
      segment === "board" ||
      segment === "slides" ||
      segment === "proto" ||
      segment === "make"
    ));
    const fileKey = keySegmentIndex >= 0 ? segments[keySegmentIndex + 1] : "";
    if (!fileKey) {
      throw new Error("Could not parse a Figma file key from the URL.");
    }

    const nodeIdFromUrl = normalizeNodeId(url.searchParams.get("node-id") ?? "");
    return {
      fileKey,
      nodeIds: parsedNodeIds.length > 0 ? parsedNodeIds : nodeIdFromUrl ? [nodeIdFromUrl] : [],
    };
  } catch (error) {
    if (error instanceof TypeError) {
      return { fileKey: raw, nodeIds: parsedNodeIds };
    }
    throw error;
  }
}

export function normalizeNodeId(nodeId: string): string {
  return nodeId.trim().replace(/-/g, ":");
}

```
