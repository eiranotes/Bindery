// 구조화 기획 패키지 가져오기.
// canon/world/plot/status 경로가 있는 zip은 단순 참고자료가 아니라 사람이 승인해
// 프로젝트 기준 문서로 보존할 수 있다. plot-board.json만 기존 AI/로컬 플롯 단계가 정규화한다.
import { LAYOUT } from '$lib/core/layout';
import { clip, slugify } from '$lib/core/text';
import { writeArtifact } from './artifacts';
import { snapshotFile } from './snapshots';
import type { SourceUpload } from './sourceUploads';
import type { Ctx } from './types';

export type PlanningPackage = {
  archiveName: string;
  setting: SourceUpload;
  character: SourceUpload | null;
  world: SourceUpload[];
  plot: SourceUpload | null;
  resume: SourceUpload | null;
  manifest: SourceUpload | null;
  files: SourceUpload[];
  totalChars: number;
};

export type PlanningPackageImportResult = {
  writtenPaths: string[];
  snapshotCount: number;
  plotPrompt: string;
};

type ArchiveEntry = { archiveName: string; relativePath: string; upload: SourceUpload };

function archiveEntry(upload: SourceUpload): ArchiveEntry | null {
  const match = /^(.+?\.zip)\/(.+)$/i.exec(upload.name);
  if (!match) return null;
  return { archiveName: match[1], relativePath: match[2].replace(/^\/+/, ''), upload };
}

function findPreferred(entries: ArchiveEntry[], patterns: RegExp[]): SourceUpload | null {
  for (const pattern of patterns) {
    const found = entries.find((entry) => pattern.test(entry.relativePath));
    if (found) return found.upload;
  }
  return null;
}

/** canon 설정 문서와 plot/world 문서가 같이 있는 zip만 구조화 패키지로 판정한다. */
export function detectPlanningPackage(uploads: SourceUpload[]): PlanningPackage | null {
  const groups = new Map<string, ArchiveEntry[]>();
  for (const upload of uploads) {
    const entry = archiveEntry(upload);
    if (!entry) continue;
    const list = groups.get(entry.archiveName) ?? [];
    list.push(entry);
    groups.set(entry.archiveName, list);
  }

  for (const [archiveName, entries] of groups) {
    const setting = findPreferred(entries, [
      /^canon\/setting-bible[^/]*\.md$/i,
      /^canon\/.*setting.*\.md$/i,
      /setting.*bible.*\.md$/i
    ]);
    const character = findPreferred(entries, [
      /^canon\/character-bible[^/]*\.md$/i,
      /character.*bible.*\.md$/i
    ]);
    const plot = findPreferred(entries, [
      /^plot\/.*plot.*\.md$/i,
      /^plot\/.*\.md$/i
    ]);
    const world = entries
      .filter((entry) => /^world\/.*\.md$/i.test(entry.relativePath))
      .map((entry) => entry.upload);
    const resume = findPreferred(entries, [/^status\/resume-state[^/]*\.md$/i]);
    const manifest = findPreferred(entries, [/^manifest\/.*\.md$/i, /asset-registry\.md$/i]);
    if (!setting || (!plot && !world.length)) continue;

    const files = entries.map((entry) => entry.upload);
    return {
      archiveName,
      setting,
      character,
      world,
      plot,
      resume,
      manifest,
      files,
      totalChars: files.reduce((sum, file) => sum + file.chars, 0)
    };
  }
  return null;
}

function importedPath(prefix: 'characters' | 'world', upload: SourceUpload): string {
  const base = upload.name.split('/').pop()?.replace(/\.md$/i, '') || 'imported';
  return `${prefix}/imported-${slugify(base)}.md`;
}

async function writeWithSnapshot(
  ctx: Ctx,
  path: string,
  content: string,
  label: string
): Promise<boolean> {
  let snapshotted = false;
  if (await ctx.bridge.exists(ctx.root, path)) {
    await snapshotFile(ctx, path, label);
    snapshotted = true;
  }
  await ctx.bridge.writeFile(ctx.root, path, content.trimEnd() + '\n');
  return snapshotted;
}

/** 사용자의 명시 클릭을 hard commit으로 보고 구조화 문서를 프로젝트 기준 파일에 보존한다. */
export async function importPlanningPackage(
  ctx: Ctx,
  pkg: PlanningPackage
): Promise<PlanningPackageImportResult> {
  const targets: Array<{ path: string; upload: SourceUpload }> = [
    { path: LAYOUT.canon.bible, upload: pkg.setting }
  ];
  if (pkg.character) targets.push({ path: importedPath('characters', pkg.character), upload: pkg.character });
  for (const upload of pkg.world) targets.push({ path: importedPath('world', upload), upload });
  if (pkg.plot) targets.push({ path: 'plot/imported-plot-bible.md', upload: pkg.plot });
  if (pkg.resume) targets.push({ path: LAYOUT.status.resume, upload: pkg.resume });
  if (pkg.manifest) targets.push({ path: 'notes/imported-package-manifest.md', upload: pkg.manifest });

  const writtenPaths: string[] = [];
  let snapshotCount = 0;
  for (const target of targets) {
    if (writtenPaths.includes(target.path)) continue;
    if (await writeWithSnapshot(ctx, target.path, target.upload.content, `기획 패키지 가져오기 전: ${target.path}`)) {
      snapshotCount++;
    }
    writtenPaths.push(target.path);
  }

  const plotPrompt = pkg.plot
    ? [
        `가져온 플롯 원문(${pkg.archiveName})을 Bindery plot-board 구조로 충실히 정리한다.`,
        '새 사건을 추가하지 말고 기존 회차 순서, 목표, 훅, 열린 떡밥을 보존한다.',
        '',
        clip(pkg.plot.content, 12_000)
      ].join('\n')
    : `가져온 설정·세계관 패키지(${pkg.archiveName})를 기준으로 플롯을 구성한다.`;

  await writeArtifact(
    ctx,
    'work',
    'source-package-import',
    `구조화 기획 패키지 가져오기 · ${writtenPaths.length}개 파일`,
    [
      `- 원본: ${pkg.archiveName}`,
      `- 원문 파일: ${pkg.files.length}개 / ${pkg.totalChars.toLocaleString()}자`,
      `- 스냅샷: ${snapshotCount}개`,
      ...writtenPaths.map((path) => `- 적용: ${path}`)
    ].join('\n'),
    'human'
  );

  return { writtenPaths, snapshotCount, plotPrompt };
}
