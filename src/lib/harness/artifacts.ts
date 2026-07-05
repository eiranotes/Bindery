// 산출물 저장 — 모든 단계 출력을 회차/작품 범위 파일로 남긴다.
// 타임스탬프본(불변)과 latest본(참조용)을 함께 쓴다. 진실은 항상 파일이다.
import { artifactPath, LAYOUT } from '$lib/core/layout';
import { nowIso, stamp } from '$lib/core/text';
import type { Ctx } from './types';

export type ArtifactMeta = {
  id: string;
  scope: string;
  stage: string;
  title: string;
  path: string;
  latestPath: string;
  createdAt: string;
  source: string;
};

export async function writeArtifact(
  ctx: Ctx,
  scope: string,
  stage: string,
  title: string,
  content: string,
  source: string
): Promise<ArtifactMeta> {
  const createdAt = nowIso();
  const id = `${stage}-${scope}-${stamp()}`;
  const path = artifactPath(scope, `${stage}-${stamp()}.md`);
  const latestPath = artifactPath(scope, `${stage}.md`);
  const header = `<!-- bindery artifact · ${title} · ${createdAt} · source=${source} -->\n\n`;
  await ctx.bridge.writeFile(ctx.root, path, header + content);
  await ctx.bridge.writeFile(ctx.root, latestPath, header + content);
  const meta: ArtifactMeta = { id, scope, stage, title, path, latestPath, createdAt, source };
  await appendIndex(ctx, meta);
  return meta;
}

async function appendIndex(ctx: Ctx, meta: ArtifactMeta): Promise<void> {
  const indexPath = `${LAYOUT.bindery.artifacts}/index.json`;
  let index: ArtifactMeta[] = [];
  try {
    index = JSON.parse(await ctx.bridge.readFile(ctx.root, indexPath)) as ArtifactMeta[];
  } catch {
    /* 첫 산출물 */
  }
  index.unshift(meta);
  await ctx.bridge.writeFile(ctx.root, indexPath, JSON.stringify(index.slice(0, 300), null, 2));
}

export async function loadArtifactIndex(ctx: Ctx): Promise<ArtifactMeta[]> {
  try {
    return JSON.parse(await ctx.bridge.readFile(ctx.root, `${LAYOUT.bindery.artifacts}/index.json`)) as ArtifactMeta[];
  } catch {
    return [];
  }
}

/** scope의 단계별 latest 산출물 본문. 없으면 null. */
export async function readLatestArtifact(ctx: Ctx, scope: string, stage: string): Promise<string | null> {
  try {
    return await ctx.bridge.readFile(ctx.root, artifactPath(scope, `${stage}.md`));
  } catch {
    return null;
  }
}
