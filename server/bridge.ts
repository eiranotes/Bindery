// harnessBridge — Vite dev 서버 미들웨어로 local-first 파일/에이전트 접근을 제공한다.
//
// 계층 규칙: 이 파일은 "로컬 머신 어댑터"다. 프런트엔드는 $lib/bridge의 Bridge
// 인터페이스만 알고, 이 미들웨어의 HTTP 형태는 devBridge 어댑터만 안다.
// 패키징 시 Tauri command로 대체해도 프런트엔드 코드는 바뀌지 않는다.
import type { Plugin, ViteDevServer } from 'vite';
import { promises as fs } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

type FsRequest = {
  op: 'read' | 'write' | 'list' | 'move' | 'exists' | 'delete';
  root: string;
  path?: string;
  to?: string;
  content?: string;
};

type AgentRequest = {
  root: string;
  prompt: string;
  label?: string;
  settings: {
    /** 실행할 CLI 명령. 예: codex, claude, gemini, 또는 절대경로 */
    command: string;
    /** 인자 템플릿. {prompt}, {model}, {promptFile} 치환. 예: ["exec", "--json", "{prompt}"] */
    argsTemplate: string[];
    /** stdout: 표준출력이 응답 | file: {promptFile}에 프롬프트를 쓰고 outputFile을 읽음 */
    outputMode: 'stdout' | 'file';
    outputFile?: string;
    model?: string;
    timeoutMs?: number;
  };
};

export type FileNode = { name: string; path: string; kind: 'file' | 'directory'; children?: FileNode[] };

const TEXT_EXT = /\.(md|ya?ml|json|txt|prompt\.md)$/i;
const activeAgents = new Map<string, ChildProcess>();

function bad(msg: string): never {
  const err = new Error(msg) as Error & { status?: number };
  err.status = 400;
  throw err;
}

async function resolveRoot(root: string): Promise<string> {
  if (!root || !path.isAbsolute(root)) bad(`project root must be absolute: ${root}`);
  const real = await fs.realpath(root).catch(() => bad(`project root does not exist: ${root}`));
  return real as string;
}

function resolveInside(root: string, rel: string): string {
  if (!rel) bad('empty relative path');
  const target = path.resolve(root, rel);
  if (target !== root && !target.startsWith(root + path.sep)) bad(`path escapes project root: ${rel}`);
  return target;
}

async function walk(dir: string, base: string, depth: number): Promise<FileNode[]> {
  if (depth > 8) return [];
  const out: FileNode[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.DS_Store') continue;
    const abs = path.join(dir, entry.name);
    const rel = path.relative(base, abs).split(path.sep).join('/');
    if (entry.isDirectory()) {
      out.push({ name: entry.name, path: rel, kind: 'directory', children: await walk(abs, base, depth + 1) });
    } else if (TEXT_EXT.test(entry.name)) {
      out.push({ name: entry.name, path: rel, kind: 'file' });
    }
  }
  out.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, 'ko'));
  return out;
}

async function handleFs(req: FsRequest): Promise<unknown> {
  const root = await resolveRoot(req.root);
  switch (req.op) {
    case 'read': {
      const p = resolveInside(root, req.path!);
      return { content: await fs.readFile(p, 'utf8') };
    }
    case 'write': {
      const p = resolveInside(root, req.path!);
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, req.content ?? '', 'utf8');
      return { ok: true };
    }
    case 'move': {
      const from = resolveInside(root, req.path!);
      const to = resolveInside(root, req.to!);
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.rename(from, to);
      return { ok: true };
    }
    case 'delete': {
      const p = resolveInside(root, req.path!);
      await fs.rm(p, { force: true });
      return { ok: true };
    }
    case 'exists': {
      const p = resolveInside(root, req.path!);
      return { exists: await fs.access(p).then(() => true, () => false) };
    }
    case 'list':
      return { nodes: await walk(root, root, 0) };
    default:
      bad(`unknown fs op: ${(req as FsRequest).op}`);
  }
}

/** 프로젝트 루트 자체를 만들 때 사용 (root 존재 검증 전 단계). base는 절대경로여야 한다. */
async function handleScaffold(req: { base: string; name: string }): Promise<{ root: string }> {
  if (!req.base || !path.isAbsolute(req.base)) bad('base must be absolute');
  const safe = req.name.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!safe) bad('empty project name');
  const root = path.join(req.base, safe);
  await fs.mkdir(root, { recursive: true });
  return { root };
}

function substituteArgs(template: string[], vars: Record<string, string>): string[] {
  return template.map((arg) => arg.replace(/\{(prompt|model|promptFile|outputFile)\}/g, (_, k) => vars[k] ?? ''))
    .filter((arg) => arg.length > 0);
}

function activeKey(root: string, label: string): string {
  return `${root}\0${label}`;
}

function writeSse(res: NodeJS.WritableStream, event: unknown): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

async function handleAgent(req: AgentRequest): Promise<unknown> {
  const root = await resolveRoot(req.root);
  const s = req.settings;
  if (!s?.command?.trim()) bad('agent command not configured');
  const timeoutMs = Math.min(Math.max(s.timeoutMs ?? 180_000, 5_000), 600_000);
  const started = Date.now();

  // 실행 trace용 파일 경로 (프롬프트 원문 보존)
  const stamp = `${Date.now()}`;
  const traceDir = path.join(root, '.bindery', 'trace');
  await fs.mkdir(traceDir, { recursive: true });
  const promptFile = path.join(traceDir, `${stamp}-${(req.label ?? 'run').replace(/[^\w-]/g, '_')}.prompt.md`);
  await fs.writeFile(promptFile, req.prompt, 'utf8');

  const outputFile = s.outputMode === 'file'
    ? path.join(traceDir, `${stamp}-output.md`)
    : '';
  const args = substituteArgs(s.argsTemplate, {
    prompt: req.prompt,
    model: s.model ?? '',
    promptFile,
    outputFile
  });

  return await new Promise((resolve) => {
    const child = spawn(s.command, args, { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    // 청크 경계가 UTF-8 멀티바이트 문자를 자르면 한글이 깨진다 — 반드시 인코딩 지정.
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    const key = activeKey(root, req.label ?? 'run');
    activeAgents.set(key, child);
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      activeAgents.delete(key);
      child.kill('SIGKILL');
      resolve({ ok: false, text: '', stderr: `timeout after ${timeoutMs}ms`, exitCode: -1, durationMs: Date.now() - started, mode: 'timeout', promptFile: path.relative(root, promptFile) });
    }, timeoutMs);
    child.stdout.on('data', (d) => (stdout += String(d)));
    child.stderr.on('data', (d) => (stderr += String(d)));
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      activeAgents.delete(key);
      clearTimeout(timer);
      resolve({ ok: false, text: '', stderr: String(err), exitCode: -1, durationMs: Date.now() - started, mode: 'spawn-error', promptFile: path.relative(root, promptFile) });
    });
    child.on('close', async (code) => {
      if (settled) return;
      settled = true;
      activeAgents.delete(key);
      clearTimeout(timer);
      let text = stdout;
      if (s.outputMode === 'file' && outputFile) {
        text = await fs.readFile(outputFile, 'utf8').catch(() => stdout);
      }
      resolve({
        ok: code === 0 && text.trim().length > 0,
        text,
        stderr: stderr.slice(0, 20_000),
        exitCode: code ?? -1,
        durationMs: Date.now() - started,
        mode: 'cli',
        promptFile: path.relative(root, promptFile)
      });
    });
  });
}

async function handleAgentStream(req: AgentRequest, res: NodeJS.WritableStream): Promise<void> {
  const root = await resolveRoot(req.root);
  const s = req.settings;
  if (!s?.command?.trim()) bad('agent command not configured');
  const timeoutMs = Math.min(Math.max(s.timeoutMs ?? 180_000, 5_000), 600_000);
  const started = Date.now();
  const label = req.label ?? 'run';

  const stamp = `${Date.now()}`;
  const traceDir = path.join(root, '.bindery', 'trace');
  await fs.mkdir(traceDir, { recursive: true });
  const promptFile = path.join(traceDir, `${stamp}-${label.replace(/[^\w-]/g, '_')}.prompt.md`);
  await fs.writeFile(promptFile, req.prompt, 'utf8');

  const outputFile = s.outputMode === 'file'
    ? path.join(traceDir, `${stamp}-output.md`)
    : '';
  const args = substituteArgs(s.argsTemplate, {
    prompt: req.prompt,
    model: s.model ?? '',
    promptFile,
    outputFile
  });

  const key = activeKey(root, label);
  const child = spawn(s.command, args, { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  // 청크 경계가 UTF-8 멀티바이트 문자를 자르면 한글이 깨진다 — 반드시 인코딩 지정.
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  activeAgents.set(key, child);
  let stdout = '';
  let stderr = '';
  let settled = false;

  writeSse(res, { type: 'status', text: `prompt saved: ${path.relative(root, promptFile)}`, promptFile: path.relative(root, promptFile) });

  const finish = async (result: {
    ok: boolean;
    text: string;
    stderr: string;
    exitCode: number;
    mode: string;
  }) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    activeAgents.delete(key);
    let text = result.text;
    if (s.outputMode === 'file' && outputFile && result.ok) {
      text = await fs.readFile(outputFile, 'utf8').catch(() => result.text);
    }
    writeSse(res, {
      type: 'done',
      result: {
        ok: result.ok && text.trim().length > 0,
        text,
        stderr: result.stderr.slice(0, 20_000),
        exitCode: result.exitCode,
        durationMs: Date.now() - started,
        mode: result.mode,
        promptFile: path.relative(root, promptFile)
      }
    });
    res.end();
  };

  const timer = setTimeout(() => {
    if (settled) return;
    child.kill('SIGKILL');
    void finish({ ok: false, text: '', stderr: `timeout after ${timeoutMs}ms`, exitCode: -1, mode: 'timeout' });
  }, timeoutMs);

  child.stdout.on('data', (d) => {
    const text = String(d);
    stdout += text;
    writeSse(res, { type: 'stdout', text });
  });
  child.stderr.on('data', (d) => {
    const text = String(d);
    stderr += text;
    writeSse(res, { type: 'stderr', text });
  });
  child.on('error', (err) => {
    void finish({ ok: false, text: '', stderr: String(err), exitCode: -1, mode: 'spawn-error' });
  });
  child.on('close', (code, signal) => {
    const killed = signal === 'SIGTERM' || signal === 'SIGKILL';
    void finish({
      ok: code === 0,
      text: stdout,
      stderr: killed ? `${stderr}\ncancelled by user`.trim() : stderr,
      exitCode: code ?? -1,
      mode: killed ? 'cancelled' : 'cli'
    });
  });
}

async function handleAgentCancel(req: { root: string; label: string }): Promise<{ ok: boolean; cancelled: boolean }> {
  const root = await resolveRoot(req.root);
  const child = activeAgents.get(activeKey(root, req.label));
  if (!child) return { ok: true, cancelled: false };
  child.kill('SIGTERM');
  return { ok: true, cancelled: true };
}

async function readBody(req: NodeJS.ReadableStream): Promise<string> {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body;
}

export function harnessBridge(): Plugin {
  return {
    name: 'bindery-harness-bridge',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__bridge', (req, res) => {
        void (async () => {
          try {
            if (req.method === 'GET' && req.url === '/env') {
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify({ home: os.homedir(), cwd: process.cwd(), sep: path.sep }));
              return;
            }
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('{"error":"method not allowed"}');
              return;
            }
            const payload = JSON.parse(await readBody(req));
            let result: unknown;
            if (req.url === '/fs') result = await handleFs(payload as FsRequest);
            else if (req.url === '/agent') result = await handleAgent(payload as AgentRequest);
            else if (req.url === '/agent-stream') {
              res.setHeader('content-type', 'text/event-stream');
              res.setHeader('cache-control', 'no-cache');
              res.setHeader('connection', 'keep-alive');
              await handleAgentStream(payload as AgentRequest, res);
              return;
            }
            else if (req.url === '/agent/cancel') result = await handleAgentCancel(payload as { root: string; label: string });
            else if (req.url === '/scaffold') result = await handleScaffold(payload as { base: string; name: string });
            else {
              res.statusCode = 404;
              res.end('{"error":"unknown bridge endpoint"}');
              return;
            }
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err) {
            const status = (err as { status?: number }).status ?? 500;
            res.statusCode = status;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
          }
        })();
      });
    }
  };
}
