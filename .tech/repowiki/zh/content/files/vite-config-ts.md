# vite.config.ts

> 模块：`root` · 语言：`typescript` · 行数：229

## 文件职责

Vite 构建配置，包含文件预览中间件插件，支持浏览目录和读取文件内容

## 关键符号

- `isPathWithinRoot@0 - 判断目标路径是否在根目录范围内，防止目录遍历攻击`
- `resolvePreviewRequest@0 - 解析预览请求 URL，提取 cwd 和 path 参数，验证路径安全后返回真实路径`
- `previewFsPlugin@0 - Vite 插件，为开发服务器添加 /__tech_preview/list 和 /__tech_preview/files 两个端点，支持目录浏览和文件预览`
- `previewImageMimeTypes@0 - 图片 MIME 类型映射表，用于文件预览响应头设置`

## 依赖输入

- `vite`
- `@vitejs/plugin-react`
- `@tailwindcss/vite`
- `vite-tsconfig-paths`
- `node:fs`
- `node:path`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { extname, isAbsolute, join, relative } from 'node:path';
import type { Plugin } from 'vite';

const previewImageMimeTypes: Record<string, string> = {
	'.gif': 'image/gif',
	'.ico': 'image/x-icon',
	'.jpeg': 'image/jpeg',
	'.jpg': 'image/jpeg',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.webp': 'image/webp',
};

const ignoredPreviewDirectories = new Set(['node_modules', '.git', '.claude', '.codex', '.tech', 'third_party', 'dist-react', 'dist-electron']);
const maxPreviewTextBytes = 512 * 1024;
const maxPreviewImageBytes = 2 * 1024 * 1024;
const maxPreviewQuickOpenEntries = 2_000;

function isPathWithinRoot(rootPath: string, targetPath: string) {
	const rel = relative(rootPath, targetPath);
	return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function sendJson(res: import('node:http').ServerResponse, payload: unknown, statusCode = 200) {
	res.statusCode = statusCode;
	res.setHeader('content-type', 'application/json; charset=utf-8');
	res.end(JSON.stringify(payload));
}

function resolvePreviewRequest(url: URL) {
	const cwd = url.searchParams.get('cwd')?.trim() || '';
	const rawPath = url.searchParams.get('path')?.trim() || '';
	if (!cwd) return { error: '缺少 cwd。' };
	const rootPath = realpathSync(cwd);
	const requestedPath = rawPath ? (isAbsolute(rawPath) ? rawPath : join(rootPath, rawPath)) : rootPath;
	const realPath = realpathSync(requestedPath);
	if (!isPathWithinRoot(rootPath, realPath)) return { error: '只能访问当前工作目录内的文件。' };
	return { rootPath, realPath };
}

function readRequestBody(req: import('node:http').IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let body = '';
		req.setEncoding('utf8');
		req.on('data', (chunk) => {
			body += chunk;
			if (body.length > maxPreviewTextBytes * 2) {
				reject(new Error('Request body is too large.'));
				req.destroy();
			}
		});
		req.on('end', () => resolve(body));
		req.on('error', reject);
	});
}

function previewFsPlugin(): Plugin {
	return {
		name: 'tech-cc-hub-preview-fs',
		configureServer(server) {
			server.middlewares.use('/__tech_preview/list', (req, res) => {
				try {
					const resolved = resolvePreviewRequest(new URL(req.url || '', 'http://localhost'));
					if ('error' in resolved) return sendJson(res, { success: false, error: resolved.error }, 400);
					const stat = statSync(resolved.realPath);
					if (!stat.isDirectory()) return sendJson(res, { success: false, error: '只能浏览目录。' }, 400);
					const entries = readdirSync(resolved.realPath, { withFileTypes: true })
						.filter((entry) => !entry.name.startsWith('.') || entry.name === '.env')
						.filter((entry) => !(entry.isDirectory() && ignoredPreviewDirectories.has(entry.name)))
						.slice(0, 500)
						.map((entry) => {
							const entryPath = join(resolved.realPath, entry.name);
							const entryStat = statSync(entryPath);
							return {
								name: entry.name,
								path: entryPath,
								relativePath: relative(resolved.rootPath, entryPath) || entry.name,
								type: entry.isDirectory() ? 'directory' : 'file',
								size: entry.isFile() ? entryStat.size : undefined,
							};
						})
						.sort((left, right) => left.type === right.type ? left.name.localeCompare(right.name) : left.type === 'directory' ? -1 : 1);
					return sendJson(res, { success: true, path: resolved.realPath, entries });
				} catch (error) {
					return sendJson(res, { success: false, error: error instanceof Error ? error.message : '读取目录失败。' }, 500);
				}
			});
			server.middlewares.use('/__tech_preview/files', (req, res) => {
				try {
					const requestUrl = new URL(req.url || '', 'http://localhost');
					const resolved = resolvePreviewRequest(requestUrl);
					if ('error' in resolved) return sendJson(res, { success: false, error: resolved.error }, 400);
					const limitParam = Number(requestUrl.searchParams.get('limit') || maxPreviewQuickOpenEntries);
					const limit = Number.isFinite(
... (truncated)
```
