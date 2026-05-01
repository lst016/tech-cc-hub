# AionUi 调研报告 - ACP 协议模块

**模块**: `src/process/acp/`
**调研时间**: 2026-05-01

---

## 一、模块结构

```
acp/
├── compat/           # 兼容性处理
├── errors/          # 错误定义
├── index.ts         # 入口
├── infra/          # 基础设施
│   ├── AcpDetector.ts  # Agent 检测
│   └── ...
├── metrics/        # 指标
├── runtime/        # 运行时
├── session/        # 会话管理
└── types.ts        # 类型定义
```

---

## 二、ACP 协议概述

ACP (Agent Communication Protocol) 是 AionUi 的核心协议，用于：
- 多 Agent 通信
- 权限请求/审批
- 工具调用
- 远程执行

### 2.1 ACP 后端类型

```typescript
// acpTypes.ts
export type AcpBackend = 'claude' | 'qwen' | 'gemini' | 'codex' | 'opencode' | 'kiro';
export type AgentBackend = AcpBackend | 'gemini' | 'aionrs' | 'nanobot' | 'openclaw-gateway' | 'custom';
```

---

## 三、AcpDetector

### 3.1 功能

检测系统上安装的 CLI Agent：
- Claude CLI
- Qwen Code
- Gemini CLI
- Codex
- OpenCode
- Kiro

### 3.2 检测流程

```typescript
class AcpDetector {
  // 检测内置 Agent
  async detectBuiltinAgents(): Promise<AcpDetectedAgent[]> {
    const results = await Promise.all([
      this.detectClaude(),
      this.detectQwen(),
      this.detectGemini(),
      this.detectCodex(),
    ]);
    return results.filter(Boolean);
  }

  // 检测单个 Agent
  private async detectClaude(): Promise<AcpDetectedAgent | null> {
    const cliPath = await this.resolveCliPath('claude');
    if (!cliPath) return null;

    return {
      id: 'claude',
      name: 'Claude CLI',
      kind: 'acp',
      backend: 'claude',
      available: true,
      cliPath,
    };
  }
}
```

---

## 四、tech-cc-hub 立场

**AionUi 的 ACP 协议对我们不适用**，原因：

1. **SDK 差异**: 我们使用 Claude Agent SDK，不支持 ACP
2. **设计理念**: tech-cc-hub 是单一 Claude Agent，不需多 Agent 协议
3. **复杂度**: ACP 协议复杂，收益有限

### 4.1 可借鉴部分

- Agent 检测模式（PATH 扫描）
- CLI 可用性检测

### 4.2 不借鉴部分

- ACP 协议本身
- 多 Agent 通信

---

**文档路径**: `doc/00-research/AionUi-调研报告/07-ACP协议模块.md`
