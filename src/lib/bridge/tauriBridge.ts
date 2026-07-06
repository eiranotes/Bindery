import { invoke } from '@tauri-apps/api/core';
import type { AgentResult, AgentSettings, Bridge, FileNode } from './types';

type FsPayload =
  | { op: 'read'; root: string; path: string }
  | { op: 'write'; root: string; path: string; content: string }
  | { op: 'move'; root: string; path: string; to: string }
  | { op: 'delete'; root: string; path: string }
  | { op: 'exists'; root: string; path: string }
  | { op: 'list'; root: string };

async function fsCall<T>(payload: FsPayload): Promise<T> {
  return invoke<T>('fs_op', { req: payload });
}

export const tauriBridge: Bridge = {
  kind: 'tauri',
  async readFile(root, path) {
    const { content } = await fsCall<{ content: string }>({ op: 'read', root, path });
    return content;
  },
  async writeFile(root, path, content) {
    await fsCall({ op: 'write', root, path, content });
  },
  async moveFile(root, from, to) {
    await fsCall({ op: 'move', root, path: from, to });
  },
  async deleteFile(root, path) {
    await fsCall({ op: 'delete', root, path });
  },
  async exists(root, path) {
    const { exists } = await fsCall<{ exists: boolean }>({ op: 'exists', root, path });
    return exists;
  },
  async listTree(root) {
    const { nodes } = await fsCall<{ nodes: FileNode[] }>({ op: 'list', root });
    return nodes;
  },
  async scaffold(base, name) {
    const { root } = await invoke<{ root: string }>('scaffold', { base, name });
    return root;
  },
  async runAgent(root, prompt, label, settings: AgentSettings): Promise<AgentResult> {
    return invoke<AgentResult>('run_agent', { req: { root, prompt, label, settings } });
  },
  async cancelAgent(root, label) {
    return invoke<{ ok: boolean; cancelled: boolean }>('cancel_agent', { root, label });
  },
  async env() {
    return invoke<{ home: string; cwd: string }>('env_info');
  }
};
