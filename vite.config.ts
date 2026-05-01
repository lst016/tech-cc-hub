import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
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

const ignoredPreviewDirectories = new Set(['node_modules', '.git', 'dist-react', 'dist-electron']);
const maxPreviewTextBytes = 512 * 1024;
const maxPreviewImageBytes = 2 * 1024 * 1024;

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
