// 스냅샷 — 위험한 쓰기(후보 적용·proposal 반영·바이블 교체) 전에 반드시 호출한다.
import { snapshotPath, LAYOUT } from '$lib/core/layout';
import { contentHash, nowIso, stamp } from '$lib/core/text';
import type { Ctx } from './types';

export type SnapshotMeta = {
  id: string;
  targetPath: string;
  snapshotPath: string;
  label: string;
  contentHash: string;
  createdAt: string;
};

/** 대상 파일 현재 내용을 스냅샷으로 복사한다. 파일이 없으면 null(스냅샷 불필요). */
export async function snapshotFile(ctx: Ctx, targetPath: string, label: string, episode: string | null = null): Promise<SnapshotMeta | null> {
  let content: string;
  try {
    content = await ctx.bridge.readFile(ctx.root, targetPath);
  } catch {
    return null;
  }
  const id = `${stamp()}-${contentHash(targetPath).slice(0, 8)}-${targetPath.split('/').pop()}`;
  const dest = snapshotPath(episode, id);
  await ctx.bridge.writeFile(ctx.root, dest, content);
  const meta: SnapshotMeta = {
    id,
    targetPath,
    snapshotPath: dest,
    label,
    contentHash: contentHash(content),
    createdAt: nowIso()
  };
  const indexPath = `${LAYOUT.bindery.snapshots}/index.json`;
  let index: SnapshotMeta[] = [];
  try {
    index = JSON.parse(await ctx.bridge.readFile(ctx.root, indexPath)) as SnapshotMeta[];
  } catch {
    /* 첫 스냅샷 */
  }
  index.unshift(meta);
  await ctx.bridge.writeFile(ctx.root, indexPath, JSON.stringify(index.slice(0, 300), null, 2));
  return meta;
}

export async function loadSnapshotIndex(ctx: Ctx): Promise<SnapshotMeta[]> {
  try {
    const indexPath = `${LAYOUT.bindery.snapshots}/index.json`;
    if (!(await ctx.bridge.exists(ctx.root, indexPath))) return [];
    return JSON.parse(await ctx.bridge.readFile(ctx.root, indexPath)) as SnapshotMeta[];
  } catch {
    return [];
  }
}

export async function restoreSnapshot(ctx: Ctx, meta: SnapshotMeta): Promise<void> {
  // 복원 전에도 현재 상태를 스냅샷으로 남긴다 (복원 취소 가능성).
  await snapshotFile(ctx, meta.targetPath, `복원 전 자동 백업 (${meta.id})`);
  const content = await ctx.bridge.readFile(ctx.root, meta.snapshotPath);
  await ctx.bridge.writeFile(ctx.root, meta.targetPath, content);
}
