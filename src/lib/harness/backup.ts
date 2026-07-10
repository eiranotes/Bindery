// 프로젝트 백업 — source-of-truth 텍스트 파일을 통째로 zip으로 묶고 복원한다. (제품화 점검 §2.5)
//
// local-first의 이면(클라우드 동기화 없음)을 보완하는 안전판. 재생성 가능한
// .bindery 캐시(runs/trace/candidates/snapshots)는 제외하고, 원고·설정·바이블·
// 프리셋 등 진실 파일만 담는다. utf8 텍스트만 대상(브리지 계약 유지).
import { zipStore } from './exportManuscript';
import { snapshotFile, type SnapshotMeta } from './snapshots';
import { contentHash, nowIso, stamp } from '$lib/core/text';
import { LAYOUT } from '$lib/core/layout';
import type { Ctx } from './types';
import type { FileNode } from '$lib/bridge';

const TEXT_RE = /\.(md|ya?ml|json|txt|csv|tsv|log|xml|html|prompt\.md)$/i;

/** 백업에서 뺄 .bindery 하위 캐시 (재생성 가능·용량 큼). */
const SKIP_PREFIXES = [
  '.bindery/runs',
  '.bindery/trace',
  '.bindery/candidates',
  '.bindery/snapshots',
  '.bindery/exchange'
];

function shouldSkip(path: string): boolean {
  return SKIP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

function isTextPath(path: string): boolean {
  const name = path.split('/').pop() ?? path;
  return TEXT_RE.test(name);
}

function collectPaths(nodes: FileNode[], out: string[]): void {
  for (const node of nodes) {
    if (shouldSkip(node.path)) continue;
    if (node.kind === 'file' && isTextPath(node.name)) {
      out.push(node.path);
    }
    if (node.children) collectPaths(node.children, out);
  }
}

export type BackupResult = { bytes: Uint8Array; fileCount: number };

/** 프로젝트의 진실 텍스트 파일을 모아 백업 zip 바이트를 만든다. */
export async function buildProjectBackup(ctx: Ctx): Promise<BackupResult> {
  const tree = await ctx.bridge.listTree(ctx.root);
  const paths: string[] = [];
  collectPaths(tree, paths);
  const files: Array<{ path: string; content: string }> = [];
  for (const path of paths.sort()) {
    try {
      files.push({ path, content: await ctx.bridge.readFile(ctx.root, path) });
    } catch {
      /* 읽기 실패 파일은 건너뛴다 */
    }
  }
  return { bytes: zipStore(files), fileCount: files.length };
}

export function backupFileName(title: string): string {
  const safe = (title || '작품').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim() || '작품';
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '').replace(/-/g, '');
  return `${safe}-backup-${stamp}.zip`;
}

export type BackupEntry = { path: string; content: string };
export type RestoreEntryStatus = 'create' | 'overwrite' | 'unchanged';
export type RestoreEntryPreview = {
  path: string;
  status: RestoreEntryStatus;
  chars: number;
  incomingHash: string;
  currentHash?: string;
};
export type RestorePreview = {
  entries: RestoreEntryPreview[];
  skipped: number;
  createCount: number;
  overwriteCount: number;
  unchangedCount: number;
};
export type ProjectRestorePoint = {
  schema_version: 'bindery.restore_point.v1';
  id: string;
  createdAt: string;
  label: string;
  snapshots: SnapshotMeta[];
  createdPaths: string[];
};
export type RestoreResult = {
  restored: number;
  skipped: number;
  unchanged: number;
  paths: string[];
  restorePoint: ProjectRestorePoint;
};
export type RollbackResult = { restored: number; deleted: number; skipped: number };

const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY = 0x02014b50;
const ZIP_END_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP_STORED = 0;

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
  );
}

function normalizeBackupPath(path: string): string | null {
  if (!path || path.includes('\0')) return null;
  const slashed = path.replace(/\\/g, '/');
  if (slashed.startsWith('/') || /^[A-Za-z]:\//.test(slashed)) return null;
  if (!slashed || slashed.endsWith('/')) return null;
  const parts = slashed.split('/').filter(Boolean);
  if (!parts.length || parts.some((part) => part === '.' || part === '..')) return null;
  if (parts[0] === '__MACOSX') return null;
  const base = parts[parts.length - 1] ?? '';
  if (base === '.DS_Store' || base.startsWith('._')) return null;
  return parts.join('/');
}

function shouldRestore(path: string): boolean {
  return !shouldSkip(path) && isTextPath(path);
}

/** Bindery 백업 zip(store 방식)에서 안전한 텍스트 엔트리만 읽는다. */
export function readProjectBackup(bytes: Uint8Array): { entries: BackupEntry[]; skipped: number } {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const entries: BackupEntry[] = [];
  let skipped = 0;
  let offset = 0;

  while (offset + 4 <= bytes.length) {
    const sig = readU32(bytes, offset);
    if (sig === ZIP_CENTRAL_DIRECTORY || sig === ZIP_END_CENTRAL_DIRECTORY) break;
    if (sig !== ZIP_LOCAL_FILE_HEADER) {
      throw new Error('지원하지 않는 zip 구조입니다. Bindery 백업 zip을 선택하세요.');
    }
    if (offset + 30 > bytes.length) throw new Error('손상된 zip 헤더입니다.');

    const flags = readU16(bytes, offset + 6);
    const method = readU16(bytes, offset + 8);
    const compressedSize = readU32(bytes, offset + 18);
    const uncompressedSize = readU32(bytes, offset + 22);
    const nameLength = readU16(bytes, offset + 26);
    const extraLength = readU16(bytes, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataStart > bytes.length || dataEnd > bytes.length) throw new Error('zip 엔트리가 손상되었습니다.');

    const rawName = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    const path = normalizeBackupPath(rawName);
    const usesDataDescriptor = (flags & 0x0008) !== 0;
    if (!path || method !== ZIP_STORED || usesDataDescriptor || compressedSize !== uncompressedSize || !shouldRestore(path)) {
      skipped++;
      offset = dataEnd;
      continue;
    }

    entries.push({ path, content: decoder.decode(bytes.slice(dataStart, dataEnd)) });
    offset = dataEnd;
  }

  if (!entries.length && skipped === 0) {
    throw new Error('복원할 텍스트 파일을 찾지 못했습니다.');
  }
  return { entries, skipped };
}

function restorePointPath(id: string): string {
  return `${LAYOUT.bindery.snapshots}/project/${id}.restore.json`;
}

/** 복원 전에 현재 프로젝트와 백업 zip 차이를 계산한다. 쓰기는 하지 않는다. */
export async function previewProjectRestore(ctx: Ctx, bytes: Uint8Array): Promise<RestorePreview> {
  const parsed = readProjectBackup(bytes);
  const entries: RestoreEntryPreview[] = [];
  for (const entry of parsed.entries) {
    const incomingHash = contentHash(entry.content);
    let currentHash: string | undefined;
    try {
      currentHash = contentHash(await ctx.bridge.readFile(ctx.root, entry.path));
    } catch {
      /* 새 파일 */
    }
    entries.push({
      path: entry.path,
      status: currentHash == null ? 'create' : currentHash === incomingHash ? 'unchanged' : 'overwrite',
      chars: entry.content.length,
      incomingHash,
      currentHash
    });
  }
  return {
    entries,
    skipped: parsed.skipped,
    createCount: entries.filter((e) => e.status === 'create').length,
    overwriteCount: entries.filter((e) => e.status === 'overwrite').length,
    unchangedCount: entries.filter((e) => e.status === 'unchanged').length
  };
}

/** 백업 zip의 안전한 텍스트 엔트리를 현재 프로젝트에 덮어쓴다. 덮어쓰기 전 스냅샷을 남긴다. */
export async function restoreProjectBackup(ctx: Ctx, bytes: Uint8Array): Promise<RestoreResult> {
  const parsed = readProjectBackup(bytes);
  const id = `restore-${stamp()}`;
  const restorePoint: ProjectRestorePoint = {
    schema_version: 'bindery.restore_point.v1',
    id,
    createdAt: nowIso(),
    label: '프로젝트 백업 복원 전 상태',
    snapshots: [],
    createdPaths: []
  };
  const paths: string[] = [];
  let skipped = parsed.skipped;
  let unchanged = 0;
  for (const entry of parsed.entries) {
    try {
      let current: string | null = null;
      try {
        current = await ctx.bridge.readFile(ctx.root, entry.path);
      } catch {
        /* 새 파일 */
      }
      if (current != null && contentHash(current) === contentHash(entry.content)) {
        unchanged++;
        continue;
      }
      if (current == null) {
        restorePoint.createdPaths.push(entry.path);
      } else {
        const snap = await snapshotFile(ctx, entry.path, `백업 복원 전 자동 백업 (${id})`);
        if (snap) restorePoint.snapshots.push(snap);
      }
      await ctx.bridge.writeFile(ctx.root, entry.path, entry.content);
      paths.push(entry.path);
    } catch {
      skipped++;
    }
  }
  await ctx.bridge.writeFile(ctx.root, restorePointPath(id), JSON.stringify(restorePoint, null, 2));
  return { restored: paths.length, skipped, unchanged, paths, restorePoint };
}

/** 방금 만든 복원 지점을 되돌린다. 덮어쓴 파일은 snapshot으로 복원하고, 새로 생긴 파일은 삭제한다. */
export async function rollbackProjectRestore(ctx: Ctx, restorePoint: ProjectRestorePoint): Promise<RollbackResult> {
  let restored = 0;
  let deleted = 0;
  let skipped = 0;
  for (const snap of restorePoint.snapshots) {
    try {
      const content = await ctx.bridge.readFile(ctx.root, snap.snapshotPath);
      await ctx.bridge.writeFile(ctx.root, snap.targetPath, content);
      restored++;
    } catch {
      skipped++;
    }
  }
  for (const path of restorePoint.createdPaths) {
    try {
      await ctx.bridge.deleteFile(ctx.root, path);
      deleted++;
    } catch {
      skipped++;
    }
  }
  return { restored, deleted, skipped };
}
