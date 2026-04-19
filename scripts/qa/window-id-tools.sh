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
