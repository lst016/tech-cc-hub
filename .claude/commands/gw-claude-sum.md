---
description: 立即执行：调用 AI 网关 API 查询累计用量+实际 token 汇总+模型分布+趋势
---

用户输入 /gw-claude-sum 时，Claude 立即执行以下步骤（不要解释命令本身，直接出结果）：

## 1. 取累计用量

执行命令并读取输出：

```bash
curl -s -H "Authorization: Bearer $ANTHROPIC_AUTH_TOKEN" "$ANTHROPIC_BASE_URL/api/usage/token/"
```

## 2. 取近期日志

```bash
curl -s -H "Authorization: Bearer $ANTHROPIC_AUTH_TOKEN" "$ANTHROPIC_BASE_URL/api/log/token"
```

## 3. 汇总输出

拿到 JSON 数据后，直接整理输出以下内容（不要解释步骤，直接出结果）：

```
📊 AI 网关用量总览

令牌: <token_name>
网关: <base_url>

累计用量（系统计费单位）
├── 已用:      <data.used> (M)
├── 初始额度:  <data.initial> (K)
└── 状态: <data.status>

近期实际 token 消耗（近 1000 条调用，含 prompt + completion）
├── 实际 token 合计: <sum> (M)
├── 数据覆盖: 约 <days> 天

模型分布（按实际 token 降序）
<逐模型行，含占比>

每日趋势
<逐日行>

每小时热度
<高峰/低谷时段>
```

**注意：**
- `quota` 是加权计费单位，不是实际 token 数。用户关心的是 `prompt_tokens + completion_tokens`
