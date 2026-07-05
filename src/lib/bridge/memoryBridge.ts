// memoryBridge — 테스트와 정적 데모용 인메모리 파일계.
// runAgent는 항상 실패(unavailable)를 돌려주어 각 단계의 로컬 폴백 경로를 검증한다.
// 테스트에서 특정 응답을 주입하려면 setAgentScript()를 사용한다.
import type { AgentResult, AgentSettings, Bridge, FileNode } from './types';

const volumes = new Map<string, Map<string, string>>();
let agentScript: ((prompt: string, label: string) => AgentResult | null) | null = null;

export function setAgentScript(fn: ((prompt: string, label: string) => AgentResult | null) | null): void {
  agentScript = fn;
}

export function resetMemoryBridge(): void {
  volumes.clear();
  agentScript = null;
}

function volume(root: string): Map<string, string> {
  let vol = volumes.get(root);
  if (!vol) {
    vol = new Map();
    volumes.set(root, vol);
  }
  return vol;
}

function treeFrom(files: Map<string, string>): FileNode[] {
  type Mut = FileNode & { children?: Mut[] };
  const roots: Mut[] = [];
  const dirs = new Map<string, Mut>();
  const ensureDir = (p: string): Mut => {
    const hit = dirs.get(p);
    if (hit) return hit;
    const parts = p.split('/');
    const node: Mut = { name: parts[parts.length - 1], path: p, kind: 'directory', children: [] };
    dirs.set(p, node);
    const parent = parts.slice(0, -1).join('/');
    if (parent) ensureDir(parent).children!.push(node);
    else roots.push(node);
    return node;
  };
  for (const p of [...files.keys()].sort()) {
    const parts = p.split('/');
    const file: Mut = { name: parts[parts.length - 1], path: p, kind: 'file' };
    const parent = parts.slice(0, -1).join('/');
    if (parent) ensureDir(parent).children!.push(file);
    else roots.push(file);
  }
  const sort = (nodes: Mut[]): FileNode[] =>
    nodes
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, 'ko'))
      .map((n) => ({ ...n, children: n.children ? sort(n.children) : undefined }));
  return sort(roots);
}

export const memoryBridge: Bridge = {
  kind: 'memory',
  async readFile(root, path) {
    const content = volume(root).get(path);
    if (content == null) throw new Error(`memory read miss: ${path}`);
    return content;
  },
  async writeFile(root, path, content) {
    volume(root).set(path, content);
  },
  async moveFile(root, from, to) {
    const vol = volume(root);
    const content = vol.get(from);
    if (content == null) throw new Error(`memory move miss: ${from}`);
    if (vol.has(to)) throw new Error(`memory move target exists: ${to}`);
    vol.delete(from);
    vol.set(to, content);
  },
  async deleteFile(root, path) {
    volume(root).delete(path);
  },
  async exists(root, path) {
    return volume(root).has(path);
  },
  async listTree(root) {
    return treeFrom(volume(root));
  },
  async scaffold(base, name) {
    const root = `${base.replace(/\/$/, '')}/${name}`;
    volume(root);
    return root;
  },
  async runAgent(_root, prompt, label, _settings: AgentSettings): Promise<AgentResult> {
    const scripted = agentScript?.(prompt, label);
    if (scripted) return scripted;
    return { ok: false, text: '', stderr: 'memory bridge has no agent', exitCode: -1, durationMs: 0, mode: 'unavailable' };
  },
  async env() {
    return { home: '/memory', cwd: '/memory' };
  }
};
