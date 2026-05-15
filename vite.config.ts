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
					const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(Math.floor(limitParam), 10_000)) : maxPreviewQuickOpenEntries;
					const stat = statSync(resolved.realPath);
					if (!stat.isDirectory()) return sendJson(res, { success: false, error: '只能索引目录。' }, 400);

					const entries: Array<{ name: string; path: string; relativePath: string; type: 'file'; size?: number }> = [];
					const pending = [resolved.realPath];
					let truncated = false;

					while (pending.length > 0) {
						const currentPath = pending.pop()!;
						const children = readdirSync(currentPath, { withFileTypes: true })
							.filter((entry) => !entry.name.startsWith('.') || entry.name === '.env')
							.sort((left, right) => left.name.localeCompare(right.name));

						for (const child of children) {
							const childPath = join(currentPath, child.name);
							if (child.isDirectory()) {
								if (!ignoredPreviewDirectories.has(child.name)) pending.push(childPath);
								continue;
							}
							if (!child.isFile()) continue;
							const childStat = statSync(childPath);
							entries.push({
								name: child.name,
								path: childPath,
								relativePath: relative(resolved.rootPath, childPath) || child.name,
								type: 'file',
								size: childStat.size,
							});
							if (entries.length >= limit) {
								truncated = pending.length > 0;
								break;
							}
						}
						if (entries.length >= limit) {
							truncated = truncated || pending.length > 0;
							break;
						}
					}

					entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
					return sendJson(res, { success: true, entries, truncated });
				} catch (error) {
					return sendJson(res, { success: false, error: error instanceof Error ? error.message : '索引文件失败。' }, 500);
				}
			});
			server.middlewares.use('/__tech_preview/write', async (req, res) => {
				try {
					if (req.method !== 'POST') return sendJson(res, { success: false, error: 'Only POST is supported.' }, 405);
					const payload = JSON.parse(await readRequestBody(req)) as { cwd?: unknown; path?: unknown; data?: unknown };
					const cwd = typeof payload.cwd === 'string' ? payload.cwd.trim() : '';
					const rawPath = typeof payload.path === 'string' ? payload.path.trim() : '';
					if (!cwd || !rawPath || typeof payload.data !== 'string') {
						return sendJson(res, { success: false, error: 'Missing cwd, path, or data.' }, 400);
					}
					const requestUrl = new URL('http://localhost');
					requestUrl.searchParams.set('cwd', cwd);
					requestUrl.searchParams.set('path', rawPath);
					const resolved = resolvePreviewRequest(requestUrl);
					if ('error' in resolved) return sendJson(res, { success: false, error: resolved.error }, 400);
					const stat = statSync(resolved.realPath);
					if (!stat.isFile()) return sendJson(res, { success: false, error: 'Only regular files can be written.' }, 400);
					writeFileSync(resolved.realPath, payload.data, 'utf8');
					return sendJson(res, { success: true, path: resolved.realPath });
				} catch (error) {
					return sendJson(res, { success: false, error: error instanceof Error ? error.message : 'Write preview file failed.' }, 500);
				}
			});
			server.middlewares.use('/__tech_preview/read', (req, res) => {
				try {
					const resolved = resolvePreviewRequest(new URL(req.url || '', 'http://localhost'));
					if ('error' in resolved) return sendJson(res, { success: false, error: resolved.error }, 400);
					const stat = statSync(resolved.realPath);
					if (!stat.isFile()) return sendJson(res, { success: false, error: '只能预览普通文件。' }, 400);
					const extension = extname(resolved.realPath).toLowerCase();
					const imageMime = previewImageMimeTypes[extension];
					if (imageMime) {
						if (stat.size > maxPreviewImageBytes) return sendJson(res, { success: false, error: '图片过大。' }, 400);
						return sendJson(res, {
							success: true,
							path: resolved.realPath,
							content: `data:${imageMime};base64,${readFileSync(resolved.realPath).toString('base64')}`,
						});
					}
					if (stat.size > maxPreviewTextBytes) return sendJson(res, { success: false, error: '文件过大。' }, 400);
					return sendJson(res, { success: true, path: resolved.realPath, content: readFileSync(resolved.realPath, 'utf8') });
				} catch (error) {
					return sendJson(res, { success: false, error: error instanceof Error ? error.message : '读取文件失败。' }, 500);
				}
			});
		},
	};
}

export default defineConfig(() => {
	const port = 4173;

	return {
		plugins: [previewFsPlugin(), react(), tailwindcss(), tsconfigPaths({ ignoreConfigErrors: true })],
		base: './',
		optimizeDeps: {
			entries: ['index.html'],
			exclude: ['monaco-editor'],
		},
		build: {
			outDir: 'dist-react',
		},
		server: {
			port, // MUST BE LOWERCASE
			strictPort: true,
			watch: {
				ignored: [
					'**/.claude/**',
					'**/.codex/**',
					'**/.tech/**',
					'**/third_party/**',
					'**/dist-electron/**',
					'**/dist-react/**',
				],
			},
			proxy: {
				"/__dev_bridge": {
					target: "http://127.0.0.1:4317",
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/__dev_bridge/, ''),
				},
			},
		},
	};
});
