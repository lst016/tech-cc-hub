---
description: 立即执行：查 AI 网关最近调用日志（实际 prompt/completion token）
---

用户输入 /gw-claude-log 时，Claude 立即执行以下步骤（不要解释命令本身，直接出结果）：

## 1. 取日志

```bash
curl -s -H "Authorization: Bearer $ANTHROPIC_AUTH_TOKEN" "$ANTHROPIC_BASE_URL/api/log/token"
```

## 2. 汇总输出

拿到 JSON 数据后，直接整理输出以下内容（不要解释步骤，直接出结果）：

```
📋 AI 网关调用日志

总消耗（实际 token）: <prompt_tokens + completion_tokens 合计>
总消耗（计费单位）:   <quota 合计>

各模型实际 token 消耗排行
<逐模型行，含占比>

最近 5 条
<时间  模型  prompt=xxx  completion=xxx  耗时=xs>
```

**日志字段说明：**
- `prompt_tokens` / `completion_tokens` — 实际 token 数
- `quota` — 系统计费单位（不同模型加权，对人无参考价值）
- `model_name` — 模型名
- `use_time` — 响应耗时（秒）
- `created_at` — 调用时间（Unix 时间戳）
