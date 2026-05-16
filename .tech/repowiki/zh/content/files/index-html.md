# index.html

> 模块：`root` · 语言：`html` · 行数：21

## 文件职责

前端 HTML 入口，引入 React 主脚本，设置 CSP 安全策略

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```html
<!doctype html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/app-icon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>tech-cc-hub</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'self';
    img-src 'self' data: blob:;
    style-src 'self' 'unsafe-inline';
    script-src 'self' 'unsafe-inline';">
</head>

<body>
    <div id="root"></div>
    <script type="module" src="/src/ui/main.tsx"></script>
</body>

</html>

```
