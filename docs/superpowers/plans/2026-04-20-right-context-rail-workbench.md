# Right Context Rail Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将右侧执行分析升级为包含任务级步骤、原子轨迹、二级详情抽屉和上下文分布弹窗的复盘工作台。

**Architecture:** 先扩展 `activity-rail-model`，让它输出任务级步骤、节点归属和上下文分布，再用这些纯数据驱动 `ActivityRail` 的新布局。UI 侧维持“主右栏 + 二级抽屉 + 弹窗”的组合，不把细节重新塞回底部。

**Tech Stack:** React 19, TypeScript, Zustand, Node test runner, Electron real-window QA.

---

### Task 1: 扩展 Right Rail View Model

**Files:**
- Modify: `src/shared/activity-rail-model.ts`
- Modify: `src/electron/activity-rail-model.test.ts`

- [ ] **Step 1: 先写失败测试**
- [ ] **Step 2: 运行测试确认红灯**
- [ ] **Step 3: 实现任务级步骤抽取、步骤归属、上下文分布**
- [ ] **Step 4: 运行测试确认绿灯**

### Task 2: 重构 ActivityRail 交互结构

**Files:**
- Modify: `src/ui/components/ActivityRail.tsx`

- [ ] **Step 1: 把底部详情区改成二级右侧抽屉**
- [ ] **Step 2: 在主右栏加入任务级步骤带**
- [ ] **Step 3: 接入上下文分布弹窗**
- [ ] **Step 4: 跑构建与静态检查**

### Task 3: 做 Electron 工作台回归验证

**Files:**
- Verify only: `src/ui/components/ActivityRail.tsx`
- Verify only: `src/shared/activity-rail-model.ts`

- [ ] **Step 1: 运行 `npm run transpile:electron`**
- [ ] **Step 2: 运行 `node --test dist-electron/electron/activity-rail-model.test.js`**
- [ ] **Step 3: 运行 `npm run build` 与 `eslint`**
- [ ] **Step 4: 启动真实 Electron 窗口，确认任务级步骤、详情抽屉、上下文分布弹窗全部可见**
