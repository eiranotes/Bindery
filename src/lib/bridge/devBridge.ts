// devBridge — Vite dev 서버의 /__bridge 미들웨어(server/bridge.ts)에 위임한다.
import type { AgentResult, AgentSettings, AgentStreamEvent, Bridge, FileNode } from './types';

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

async function callStream(
  payload: unknown,
  onEvent: (event: AgentStreamEvent) => void
): Promise<AgentResult> {
  const res = await fetch('/__bridge/agent-stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({ error: `bridge agent-stream failed (${res.status})` }));
    throw new Error(data.error ?? `bridge agent-stream failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let final: AgentResult | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const dataLine = part.split('\n').find((line) => line.startsWith('data: '));
      if (!dataLine) continue;
      const event = JSON.parse(dataLine.slice(6)) as AgentStreamEvent;
      onEvent(event);
      if (event.type === 'done') final = event.result;
    }
  }

  if (!final) throw new Error('agent stream ended without a final result');
  return final;
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
  async runAgentStream(root, prompt, label, settings, onEvent): Promise<AgentResult> {
    return callStream({ root, prompt, label, settings }, onEvent);
  },
  async cancelAgent(root, label) {
    return call<{ ok: boolean; cancelled: boolean }>('agent/cancel', { root, label });
  },
  async env() {
    const res = await fetch('/__bridge/env');
    return res.json();
  }
};
