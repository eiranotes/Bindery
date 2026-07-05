// devBridge — Vite dev 서버의 /__bridge 미들웨어(server/bridge.ts)에 위임한다.
import type { AgentResult, AgentSettings, Bridge, FileNode } from './types';

async function call<T>(endpoint: string, payload: unknown): Promise<T> {
  const res = await fetch(`/__bridge/${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `bridge ${endpoint} failed (${res.status})`);
  return data as T;
}

export const devBridge: Bridge = {
  kind: 'dev',
  async readFile(root, path) {
    const { content } = await call<{ content: string }>('fs', { op: 'read', root, path });
    return content;
  },
  async writeFile(root, path, content) {
    await call('fs', { op: 'write', root, path, content });
  },
  async moveFile(root, from, to) {
    await call('fs', { op: 'move', root, path: from, to });
  },
  async deleteFile(root, path) {
    await call('fs', { op: 'delete', root, path });
  },
  async exists(root, path) {
    const { exists } = await call<{ exists: boolean }>('fs', { op: 'exists', root, path });
    return exists;
  },
  async listTree(root) {
    const { nodes } = await call<{ nodes: FileNode[] }>('fs', { op: 'list', root });
    return nodes;
  },
  async scaffold(base, name) {
    const { root } = await call<{ root: string }>('scaffold', { base, name });
    return root;
  },
  async runAgent(root, prompt, label, settings): Promise<AgentResult> {
    return call<AgentResult>('agent', { root, prompt, label, settings });
  },
  async env() {
    const res = await fetch('/__bridge/env');
    return res.json();
  }
};
