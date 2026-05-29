import { execSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { realpathSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

const requestBodyLimitBytes = 64 * 1024;
const defaultTimeoutMs = 120_000;
const maxTimeoutMs = 10 * 60_000;
const maxOutputChars = 200_000;
const processTailChars = 60_000;
const processHistoryLimit = 30;

type PreviewProcessStatus = 'running' | 'exited' | 'killed' | 'error';

type PreviewProcessRecord = {
	id: string;
	command: string;
	cwd: string;
	shell: string;
	pid?: number;
	startedAt: number;
	endedAt?: number;
	exitCode?: number | null;
	signal?: string | null;
	stdoutTail: string;
	stderrTail: string;
	status: PreviewProcessStatus;
	error?: string;
	stopRequested?: boolean;
	child?: ChildProcessWithoutNullStreams;
};

type PreviewProcessInfo = Omit<PreviewProcessRecord, 'child' | 'stopRequested'> & {
	running: boolean;
};

const processes = new Map<string, PreviewProcessRecord>();

function sendJson(res: ServerResponse, payload: unknown, statusCode = 200) {
	res.statusCode = statusCode;
	res.setHeader('content-type', 'application/json; charset=utf-8');
	res.end(JSON.stringify(payload));
}

function readRequestBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let body = '';
		req.setEncoding('utf8');
		req.on('data', (chunk) => {
			body += chunk;
			if (body.length > requestBodyLimitBytes) {
				reject(new Error('Request body is too large.'));
				req.destroy();
			}
		});
		req.on('end', () => resolve(body));
		req.on('error', reject);
	});
}

async function readJsonRequest(req: IncomingMessage): Promise<unknown> {
	const raw = await readRequestBody(req);
	return raw.trim() ? JSON.parse(raw) : {};
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function clampTimeoutMs(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return defaultTimeoutMs;
	}
	return Math.max(1_000, Math.min(maxTimeoutMs, Math.floor(value)));
}

function appendOutput(current: string, chunk: Buffer): string {
	if (current.length >= maxOutputChars) {
		return current;
	}

	const text = chunk.toString('utf8');
	const remaining = maxOutputChars - current.length;
	if (text.length <= remaining) {
		return `${current}${text}`;
	}

	const marker = '\n...[output truncated]';
	const available = Math.max(0, remaining - marker.length);
	return `${current}${text.slice(0, available)}${marker}`;
}

function appendTail(current: string, chunk: Buffer): string {
	const next = `${current}${chunk.toString('utf8')}`;
	return next.length > processTailChars ? next.slice(next.length - processTailChars) : next;
}

function resolveCwd(value: unknown): string {
	if (typeof value === 'string' && value.trim()) {
		try {
			const realPath = realpathSync(value.trim());
			if (statSync(realPath).isDirectory()) {
				return realPath;
			}
		} catch {
			// Browser preview sessions can carry placeholder paths from the demo shim.
		}
	}
	return process.cwd();
}

function buildShell(command: string): { command: string; args: string[]; label: string } {
	if (process.platform === 'win32') {
		const shellCommand = 'powershell.exe';
		return {
			command: shellCommand,
			args: ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
			label: shellCommand,
		};
	}

	const shellCommand = process.env.SHELL || 'bash';
	return {
		command: shellCommand,
		args: ['-lc', command],
		label: shellCommand.split(/[\\/]/).pop() || 'bash',
	};
}

function toProcessInfo(record: PreviewProcessRecord): PreviewProcessInfo {
	return {
		id: record.id,
		command: record.command,
		cwd: record.cwd,
		shell: record.shell,
		pid: record.pid,
		startedAt: record.startedAt,
		endedAt: record.endedAt,
		exitCode: record.exitCode,
		signal: record.signal,
		stdoutTail: record.stdoutTail,
		stderrTail: record.stderrTail,
		status: record.status,
		error: record.error,
		running: record.status === 'running',
	};
}

function pruneProcessHistory(): void {
	const completed = [...processes.values()]
		.filter((record) => record.status !== 'running')
		.sort((left, right) => (right.endedAt ?? right.startedAt) - (left.endedAt ?? left.startedAt));

	for (const record of completed.slice(processHistoryLimit)) {
		processes.delete(record.id);
	}
}

function finishProcess(
	record: PreviewProcessRecord,
	result: { exitCode?: number | null; signal?: string | null; error?: string },
): void {
	if (record.status !== 'running') return;
	record.endedAt = Date.now();
	record.exitCode = result.exitCode ?? null;
	record.signal = result.signal ?? null;
	record.error = result.error;
	record.status = result.error ? 'error' : record.stopRequested ? 'killed' : 'exited';
	record.child = undefined;
	pruneProcessHistory();
}

function runTaskkill(pid: number): Promise<void> {
	return new Promise((resolve, reject) => {
		const killer = spawn('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
			windowsHide: true,
		});
		let stderr = '';
		killer.stderr?.on('data', (chunk: Buffer) => {
			stderr = appendTail(stderr, chunk);
		});
		killer.on('error', reject);
		killer.on('close', (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(new Error(stderr.trim() || `taskkill exited with code ${code ?? 'unknown'}`));
		});
	});
}

async function stopProcessTree(record: PreviewProcessRecord): Promise<void> {
	if (!record.pid) {
		record.child?.kill();
		return;
	}

	if (process.platform === 'win32') {
		await runTaskkill(record.pid);
		return;
	}

	try {
		process.kill(-record.pid, 'SIGTERM');
	} catch {
		record.child?.kill('SIGTERM');
	}
}

function stopProcessTreeSync(record: PreviewProcessRecord): void {
	if (!record.pid) {
		record.child?.kill();
		return;
	}

	try {
		if (process.platform === 'win32') {
			execSync(`taskkill /PID ${record.pid} /T /F`, { stdio: 'ignore' });
			return;
		}
		process.kill(-record.pid, 'SIGTERM');
	} catch {
		try {
			record.child?.kill();
		} catch {
			// The process may have exited between the status check and shutdown.
		}
	}
}

function readProcessId(request: unknown): string {
	const payload = request && typeof request === 'object' ? request as { id?: unknown; processId?: unknown } : {};
	const id = typeof payload.id === 'string' ? payload.id.trim() : '';
	const processId = typeof payload.processId === 'string' ? payload.processId.trim() : '';
	return id || processId;
}

function startProcess(request: unknown) {
	const payload = request && typeof request === 'object' ? request as { command?: unknown; cwd?: unknown } : {};
	const command = typeof payload.command === 'string' ? payload.command.trim() : '';
	const cwd = resolveCwd(payload.cwd);
	const shellInfo = buildShell(command);

	if (!command) {
		return { success: false, error: 'Please enter a command.' };
	}

	try {
		const child = spawn(shellInfo.command, shellInfo.args, {
			cwd,
			env: process.env,
			windowsHide: true,
			detached: process.platform !== 'win32',
		});
		const record: PreviewProcessRecord = {
			id: randomUUID(),
			command,
			cwd,
			shell: shellInfo.label,
			pid: child.pid,
			startedAt: Date.now(),
			stdoutTail: '',
			stderrTail: '',
			status: 'running',
			child,
		};

		processes.set(record.id, record);

		child.stdout?.on('data', (chunk: Buffer) => {
			record.stdoutTail = appendTail(record.stdoutTail, chunk);
		});
		child.stderr?.on('data', (chunk: Buffer) => {
			record.stderrTail = appendTail(record.stderrTail, chunk);
		});
		child.on('error', (error) => {
			finishProcess(record, { exitCode: null, error: error.message });
		});
		child.on('close', (code, signal) => {
			finishProcess(record, { exitCode: code, signal });
		});

		return { success: true, process: toProcessInfo(record) };
	} catch (error) {
		return { success: false, error: getErrorMessage(error) };
	}
}

function listProcesses() {
	const processInfos = [...processes.values()]
		.sort((left, right) => {
			if (left.status === 'running' && right.status !== 'running') return -1;
			if (left.status !== 'running' && right.status === 'running') return 1;
			return right.startedAt - left.startedAt;
		})
		.map(toProcessInfo);
	return { success: true, processes: processInfos };
}

async function stopProcess(request: unknown) {
	const id = readProcessId(request);
	const record = id ? processes.get(id) : undefined;
	if (!record) {
		return { success: false, error: 'Background process does not exist or has been cleaned up.' };
	}
	if (record.status !== 'running') {
		return { success: true, process: toProcessInfo(record) };
	}

	record.stopRequested = true;
	try {
		await stopProcessTree(record);
		return { success: true, process: toProcessInfo(record) };
	} catch (error) {
		record.error = getErrorMessage(error);
		return { success: false, process: toProcessInfo(record), error: record.error };
	}
}

function runCommand(request: unknown) {
	const payload = request && typeof request === 'object' ? request as { command?: unknown; cwd?: unknown; timeoutMs?: unknown } : {};
	const command = typeof payload.command === 'string' ? payload.command.trim() : '';
	const cwd = resolveCwd(payload.cwd);
	const timeoutMs = clampTimeoutMs(payload.timeoutMs);
	const shellInfo = buildShell(command);
	const startedAt = Date.now();

	if (!command) {
		return Promise.resolve({
			success: false,
			command,
			cwd,
			shell: shellInfo.label,
			exitCode: null,
			stdout: '',
			stderr: '',
			timedOut: false,
			elapsedMs: 0,
			error: 'Please enter a command.',
		});
	}

	return new Promise((resolve) => {
		let stdout = '';
		let stderr = '';
		let timedOut = false;
		let settled = false;
		const child = spawn(shellInfo.command, shellInfo.args, {
			cwd,
			env: process.env,
			windowsHide: true,
		});
		const finish = (result: { exitCode: number | null; signal?: string | null; error?: string }) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			resolve({
				success: !timedOut && !result.error && result.exitCode === 0,
				command,
				cwd,
				shell: shellInfo.label,
				exitCode: result.exitCode,
				signal: result.signal,
				stdout,
				stderr,
				timedOut,
				elapsedMs: Date.now() - startedAt,
				error: result.error,
			});
		};
		const timeout = setTimeout(() => {
			timedOut = true;
			child.kill();
		}, timeoutMs);

		child.stdout?.on('data', (chunk: Buffer) => {
			stdout = appendOutput(stdout, chunk);
		});
		child.stderr?.on('data', (chunk: Buffer) => {
			stderr = appendOutput(stderr, chunk);
		});
		child.on('error', (error) => {
			finish({ exitCode: null, error: error.message });
		});
		child.on('close', (code, signal) => {
			finish({ exitCode: code, signal });
		});
	});
}

export function previewTerminalPlugin(): Plugin {
	return {
		name: 'tech-cc-hub-preview-terminal',
		configureServer(server) {
			const handleJson = async (
				req: IncomingMessage,
				res: ServerResponse,
				handler: (payload: unknown) => unknown | Promise<unknown>,
			) => {
				try {
					if (req.method !== 'POST') return sendJson(res, { success: false, error: 'Only POST is supported.' }, 405);
					const payload = await readJsonRequest(req);
					return sendJson(res, await handler(payload));
				} catch (error) {
					return sendJson(res, { success: false, error: getErrorMessage(error) }, 500);
				}
			};

			server.middlewares.use('/__tech_terminal/run', (req, res) => {
				void handleJson(req, res, runCommand);
			});
			server.middlewares.use('/__tech_terminal/start', (req, res) => {
				void handleJson(req, res, startProcess);
			});
			server.middlewares.use('/__tech_terminal/list', (req, res) => {
				void handleJson(req, res, () => listProcesses());
			});
			server.middlewares.use('/__tech_terminal/stop', (req, res) => {
				void handleJson(req, res, stopProcess);
			});
			server.httpServer?.once('close', () => {
				for (const record of processes.values()) {
					if (record.status !== 'running') continue;
					record.stopRequested = true;
					stopProcessTreeSync(record);
				}
			});
		},
	};
}
