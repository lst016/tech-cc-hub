# Photoshop PSD Web MCP

这个文件夹集中存放 Photoshop/PSD 网页切图 MCP 的规划、实施计划和平台研究。

## 文档

- 设计规格：`specs/2026-05-12-photoshop-psd-web-mcp-design.md`
- 实施计划：`plans/2026-05-12-photoshop-psd-web-mcp.md`
- 自动化通道 spike：`research/2026-05-12-photoshop-automation-spike.md`

## 当前实现范围

- 内置 MCP：`tech-cc-hub-photoshop`
- 代码位置：`src/electron/libs/mcp-tools/photoshop/`
- 测试 fixture：`test/fixtures/photoshop/`

Phase 1 已提供 manifest、环境诊断、PSD layer 分析、资产导出规划、安全编辑计划和工具 handler。后续迭代继续在同一 Photoshop 文件夹中补原生 HTML/CSS/JS、React/Tailwind、视觉闭环和多页面汇总能力。
