---
name: techcc-visualize
description: 将用户提供的数据、结果或分析内容制作成可筛选、可选择并可继续追问的交互式可视化。用户选择 @可视化，或明确要求在 tech-cc-hub 聊天内生成交互式数据探索器、仪表盘、关系图、时间线、流程图时使用。
---

# techcc 可视化

把结果写成一个由 tech-cc-hub 隔离加载的 HTML 片段。优先做能帮助用户判断和继续行动的交互，不要只把静态表格换成装饰图表。

## 输出契约

1. 只在此会话目录创建文件：`{{TECHCC_VISUALIZATION_DIRECTORY}}`。
2. 创建一个 UTF-8、扩展名为 `.html` 的单文件 HTML 片段。每个新视图使用唯一文件名；文件名只使用字母、数字、中文、空格、点、下划线或连字符，不使用目录。
3. 文件不得超过 2 MiB，不得发起网络请求，不依赖 CDN、远程字体或外部资源。
4. 文件内容是可放入 `<body>` 的片段，不写 `<!doctype>`、`<html>`、`<head>` 或 `<body>`。
5. 完成后在最终回复的代码围栏之外单独输出：

   `::techcc-inline-vis{file="文件名.html" title="简短标题"}`

不要把原始 HTML、脚本或完整数据再次输出到回复中。

## 交互要求

- 数据探索器默认包含概览、筛选控件、主视图和选中项详情。
- 筛选后同步更新计数、图形和空状态；选择图形元素或列表项时显示明确详情。
- 对长列表提供搜索、排序或分组，避免一次渲染无法浏览的大表。
- 用按钮、输入框、原生 SVG、Canvas 和少量原生 JavaScript 完成交互。
- 所有交互元素提供可读标签、键盘焦点和选中状态；颜色之外再用文字或形状表达含义。
- 首屏先给结论和关键指标，细节按需展开。
- 标题字号使用 `clamp()` 随容器收缩，并在窄屏减少内边距，避免标题挤压指标或详情。

## techcc 主题接口

宿主会提供以下变量和基础类，优先复用：

- `--techcc-viz-background`
- `--techcc-viz-foreground`
- `--techcc-viz-muted`
- `--techcc-viz-card`
- `--techcc-viz-border`
- `--techcc-viz-accent`
- `--techcc-viz-accent-soft`
- `.techcc-viz-shell`
- `.techcc-viz-card`
- `.techcc-viz-control`
- `.techcc-viz-btn`
- `.techcc-viz-grid`

局部样式必须以 `.techcc-viz-*` 命名，避免污染宿主。

## 继续追问

只有在用户明确点击按钮时调用窄桥，把一个具体后续问题发回当前会话：

```js
window.techcc.visualization.sendFollowUpMessage({
  prompt: "只分析当前选中的异常订单，并给出处理建议",
  title: "分析选中项"
});
```

不要在页面加载、定时器或筛选变化时自动发送消息。

## 完成前检查

- 文件位于指定会话目录，名称和大小符合限制。
- 没有网络请求、外部脚本、表单提交、弹窗或页面跳转。
- 筛选、选择、详情和空状态均可用。
- 小尺寸窗口下仍可阅读，文本不会被关键控件遮挡。
- 最终回复只引用实际创建的文件名，并使用 `::techcc-inline-vis`。
