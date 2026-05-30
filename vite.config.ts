import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { previewTerminalPlugin } from './src/dev/preview-terminal-plugin';
import type { Plugin } from 'vite';
import {
	listPreviewDirectoryForRenderer,
	listPreviewFilesForRenderer,
	readPreviewFileForRenderer,
	writePreviewFileForRenderer,
} from './src/electron/libs/preview-fs';

const maxPreviewTextBytes = 512 * 1024;
const maxPreviewQuickOpenEntries = 2_000;

function sendJson(res: import('node:http').ServerResponse, payload: unknown, statusCode = 200) {
	res.statusCode = statusCode;
	res.setHeader('content-type', 'application/json; charset=utf-8');
	res.end(JSON.stringify(payload));
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
			server.middlewares.use('/__tech_preview/list', async (req, res) => {
				const requestUrl = new URL(req.url || '', 'http://localhost');
				const result = await listPreviewDirectoryForRenderer({
					cwd: requestUrl.searchParams.get('cwd'),
					path: requestUrl.searchParams.get('path'),
				}, { maxEntries: 500 });
				return sendJson(res, result, result.success ? 200 : 400);
			});
			server.middlewares.use('/__tech_preview/files', async (req, res) => {
				const requestUrl = new URL(req.url || '', 'http://localhost');
				const limitParam = Number(requestUrl.searchParams.get('limit') || maxPreviewQuickOpenEntries);
				const result = await listPreviewFilesForRenderer({
					cwd: requestUrl.searchParams.get('cwd'),
					limit: Number.isFinite(limitParam) ? limitParam : maxPreviewQuickOpenEntries,
				});
				return sendJson(res, result, result.success ? 200 : 400);
			});
			server.middlewares.use('/__tech_preview/write', async (req, res) => {
				try {
					if (req.method !== 'POST') return sendJson(res, { success: false, error: 'Only POST is supported.' }, 405);
					const payload = JSON.parse(await readRequestBody(req)) as { cwd?: unknown; path?: unknown; data?: unknown };
					const result = await writePreviewFileForRenderer(payload);
					return sendJson(res, result, result.success ? 200 : 400);
				} catch (error) {
					return sendJson(res, { success: false, error: error instanceof Error ? error.message : 'Write preview file failed.' }, 500);
				}
			});
			server.middlewares.use('/__tech_preview/read', async (req, res) => {
				const requestUrl = new URL(req.url || '', 'http://localhost');
				const result = await readPreviewFileForRenderer({
					cwd: requestUrl.searchParams.get('cwd'),
					path: requestUrl.searchParams.get('path'),
				});
				return sendJson(res, result, result.success ? 200 : 400);
			});
		},
	};
}

export default defineConfig(() => {
	const port = 4173;

	return {
		plugins: [previewFsPlugin(), previewTerminalPlugin(), react(), tailwindcss(), tsconfigPaths({ ignoreConfigErrors: true })],
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
					'**/build/**',
					'**/coverage/**',
					'**/dist/**',
					'**/dist-electron/**',
					'**/dist-react/**',
					'**/dist-test/**',
					'**/node_modules/**',
					'**/out/**',
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
