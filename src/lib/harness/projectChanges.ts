import type { FileNode } from '$lib/bridge';
import { contentHash } from '$lib/core/text';
import type { Ctx } from './types';

export type ProjectFileDigest = {
  path: string;
  hash: string;
};

export type ProjectFileChange = {
  path: string;
  kind: 'created' | 'modified' | 'deleted';
};

const TEXT_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.csv',
  '.tsv',
  '.prompt'
]);

const IGNORED_PREFIXES = [
  'node_modules/',
  '.superloopy/',
  '.svelte-kit/',
  '.bindery/artifacts/',
  '.bindery/backups/',
  '.bindery/runs/',
  '.bindery/snapshots/',
  '.bindery/trace/',
  'exports/',
  'dist/',
  'build/',
  'target/',
  'src-tauri/target/'
];
const DIGEST_CONCURRENCY = 4;

export function shouldTrackProjectFile(path: string): boolean {
  if (!path || path.includes('..') || path.startsWith('/')) return false;
  if (IGNORED_PREFIXES.some((prefix) => path.startsWith(prefix))) return false;
  const lower = path.toLowerCase();
  for (const ext of TEXT_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

export function flattenTrackedFiles(nodes: FileNode[]): string[] {
  const paths: string[] = [];
  const visit = (node: FileNode): void => {
    if (node.kind === 'file') {
      if (shouldTrackProjectFile(node.path)) paths.push(node.path);
      return;
    }
    for (const child of node.children ?? []) visit(child);
  };
  for (const node of nodes) visit(node);
  return [...new Set(paths)].sort((a, b) => a.localeCompare(b, 'ko'));
}

export async function loadProjectFileDigest(ctx: Ctx, tree?: FileNode[]): Promise<ProjectFileDigest[]> {
  const nodes = tree ?? await ctx.bridge.listTree(ctx.root);
  const files = flattenTrackedFiles(nodes);
  const digests: ProjectFileDigest[] = [];
  for (let i = 0; i < files.length; i += DIGEST_CONCURRENCY) {
    const batch = files.slice(i, i + DIGEST_CONCURRENCY);
    const entries = await Promise.all(batch.map(async (path): Promise<ProjectFileDigest | null> => {
      try {
        return { path, hash: contentHash(await ctx.bridge.readFile(ctx.root, path)) };
      } catch {
        return null;
      }
    }));
    for (const entry of entries) {
      if (entry) digests.push(entry);
    }
  }
  return digests;
}

export function diffProjectFileDigests(
  before: ProjectFileDigest[] | null,
  after: ProjectFileDigest[]
): ProjectFileChange[] {
  if (!before) return [];
  const prev = new Map(before.map((entry) => [entry.path, entry.hash]));
  const next = new Map(after.map((entry) => [entry.path, entry.hash]));
  const changes: ProjectFileChange[] = [];

  for (const [path, hash] of next) {
    const old = prev.get(path);
    if (old == null) changes.push({ path, kind: 'created' });
    else if (old !== hash) changes.push({ path, kind: 'modified' });
  }
  for (const path of prev.keys()) {
    if (!next.has(path)) changes.push({ path, kind: 'deleted' });
  }

  return changes.sort((a, b) => a.path.localeCompare(b.path, 'ko'));
}
