# Photoshop Automation Spike

日期：2026-05-12
状态：待平台验证
范围：为 `tech-cc-hub-photoshop` Phase 1 选择 Windows/macOS Photoshop 自动化通道前的能力矩阵

## 目标

在实现真实 Photoshop 平台自动化前，先验证 macOS 和 Windows 的可用通道，避免把 Phase 1 锁死在单平台或易碎脚本方案上。

## 候选通道

macOS：

- UXP / Photoshop plugin bridge
- ExtendScript / Photoshop script
- AppleScript bridge, only for launch/focus/bootstrap support

Windows：

- UXP / Photoshop plugin bridge
- ExtendScript / Photoshop script
- COM automation where available
- Command bridge launched by the desktop app

## Phase 1 必需能力

- Detect Photoshop install and version.
- Detect whether Photoshop is running.
- Open PSD/PSB.
- Read document metadata.
- Read layer tree, bounds, text, visibility, and basic style.
- Export document/artboard preview.
- Export selected layer/group as PNG/WebP.
- Prepare allowlisted safe edits with backup and changeLog.

## Capability Matrix

| Platform | Channel | Install friction | Permissions | Open doc | List layers | Export layer | Safe edit | Notes |
|---|---|---:|---|---|---|---|---|---|
| macOS | UXP | unknown | unknown | unknown | unknown | unknown | unknown | Validate first |
| macOS | ExtendScript | unknown | unknown | unknown | unknown | unknown | unknown | Validate script execution path |
| macOS | AppleScript bridge | low | Automation permission | bootstrap only | no | no | no | Do not use as primary channel |
| Windows | UXP | unknown | unknown | unknown | unknown | unknown | unknown | Validate first |
| Windows | ExtendScript | unknown | unknown | unknown | unknown | unknown | unknown | Validate script execution path |
| Windows | COM | unknown | unknown | unknown | unknown | unknown | unknown | Validate version support |

## Decision Gate

No platform-specific Photoshop automation implementation should be added before this spike is filled with findings from at least one macOS check and one Windows check.

The implementation decision must record:

- chosen primary channel per platform;
- fallback channel per platform;
- unavailable diagnostics shown to the MCP caller;
- unsupported operations in the capability matrix;
- security boundary for script execution.
