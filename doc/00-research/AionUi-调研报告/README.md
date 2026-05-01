# AionUi 调研报告 - 索引

**项目**: iOfficeAI/AionUi
**调研时间**: 2026-05-01
**报告路径**: `doc/00-research/AionUi-调研报告/`

---

## 报告列表

| 编号 | 文档 | 说明 |
|------|------|------|
| 00 | [00-总览.md](./00-总览.md) | 项目整体分析、架构概览、核心特性对比 |
| 01 | [01-MCP服务模块.md](./01-MCP服务模块.md) | MCP 协议服务、IMcpProtocol 接口、Agent 实现 |
| 02 | [02-Cron调度模块.md](./02-Cron调度模块.md) | CronService、CronStore、并发保护 |
| 03 | [03-Agent管理层.md](./03-Agent管理层.md) | AgentRegistry、DetectedAgent 类型系统 |
| 04 | [04-数据库层.md](./04-数据库层.md) | Schema 设计、仓库接口、索引策略 |
| 05 | [05-WebUI远程访问.md](./05-WebUI远程访问.md) | Express + WebSocket、JWT 认证、心跳 |
| 06 | [06-UI组件层.md](./06-UI组件层.md) | Chat 组件、Slash 命令、Markdown |
| 07 | [07-ACP协议模块.md](./07-ACP协议模块.md) | ACP 协议分析（不适用于我们） |

---

## 核心结论

### 高价值借鉴（可直接移植）

1. **MCP 服务层** — 完整的 MCP 协议实现
2. **Cron 调度系统** — 24/7 无人值守的核心能力
3. **AgentRegistry 模式** — 统一的 Agent 管理架构
4. **数据库 Schema** — 完整的会话/消息模型参考
5. **WebSocket 心跳** — 远程连接健康检测

### 中价值借鉴（需适配）

6. **API 适配层** — 多后端支持模式
7. **IPC 保护机制** — 50MB Payload 限制
8. **协议转换器** — OpenAI ↔ Anthropic ↔ Gemini

### 不适用（架构差异）

- **ACP 协议** — 我们基于 Claude SDK
- **Arco Design UI** — UI 框架不兼容
- **UnoCSS 样式** — 与 Tailwind 不兼容
- **用户系统** — 我们无多用户需求
- **团队模式** — 我们无协作需求

---

## 下一步行动建议

### Phase 1: MCP 服务（3 days）

```
目标: 为 tech-cc-hub 添加 MCP 支持

1. 定义 IMcpProtocol 接口
2. 实现 ClaudeMcpAgent
3. 添加 MCP 设置 UI
```

### Phase 2: Cron 调度（5 days）

```
目标: 实现计划任务功能

1. CronStore 类型定义
2. ICronRepository 接口 + SQLite 实现
3. CronService 核心逻辑
4. CronBusyGuard 并发保护
```

### Phase 3: 远程访问（7 days）

```
目标: 支持远程浏览器访问

1. WebSocketManager 核心
2. 简化的认证机制
3. 会话同步
```

---

## 文档维护

- 有效期: 2026-05-01 起 3 个月
- 更新: 重大架构变更后需更新
- 评审: 迭代计划制定前需重新审视
