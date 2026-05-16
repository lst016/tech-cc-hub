# scripts/qa/window-id-tools.sh

> 模块：`scripts` · 语言：`shell` · 行数：51

## 文件职责

macOS窗口ID查询和截图工具，用于获取Electron/Chrome窗口信息

## 关键符号

- `list_windows@0 - 用Swift/CoreGraphics列出Electron和Chrome窗口的ID、owner、layer和name`
- `capture_window@0 - 使用screencapture -l截取指定窗口ID的PNG图片`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```shell
#!/usr/bin/env bash

set -euo pipefail

MODE="${1:-list}"
WINDOW_ID="${2:-}"
OUTPUT_PATH="${3:-}"

list_windows() {
  swift - <<'SWIFT'
import Foundation
import CoreGraphics

let info = CGWindowListCopyWindowInfo(.optionOnScreenOnly, kCGNullWindowID) as? [[String: Any]] ?? []
for window in info {
  let owner = window[kCGWindowOwnerName as String] as? String ?? ""
  let name = window[kCGWindowName as String] as? String ?? ""
  let layer = window[kCGWindowLayer as String] ?? ""
  let id = window[kCGWindowNumber as String] ?? ""
  if owner == "Electron" || owner == "Google Chrome" || owner == "Codex" {
    print("\(id)\t\(owner)\t\(layer)\t\(name)")
  }
}
SWIFT
}

capture_window() {
  if [[ -z "${WINDOW_ID}" ]]; then
    echo "用法: bash scripts/qa/window-id-tools.sh capture <window_id> [output_path]" >&2
    exit 1
  fi

  local output="${OUTPUT_PATH:-/tmp/window-${WINDOW_ID}.png}"
  screencapture -x -l "${WINDOW_ID}" "${output}"
  echo "${output}"
}

case "${MODE}" in
  list)
    list_windows
    ;;
  capture)
    capture_window
    ;;
  *)
    echo "未知模式: ${MODE}" >&2
    echo "支持: list | capture" >&2
    exit 1
    ;;
esac

```
