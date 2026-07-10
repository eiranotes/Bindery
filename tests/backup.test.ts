// 프로젝트 백업 테스트 — 텍스트 파일 수집, 캐시 제외, zip 유효성.
import { describe, it, expect, beforeEach } from 'vitest';
import { memoryBridge, resetMemoryBridge } from '../src/lib/bridge/memoryBridge';
import {
  backupFileName, buildProjectBackup, previewProjectRestore, readProjectBackup, restoreProjectBackup,
  rollbackProjectRestore
} from '../src/lib/harness/backup';
import { zipStore } from '../src/lib/harness/exportManuscript';
import type { Ctx } from '../src/lib/harness/types';

const ROOT = '/vault/백업작품';
const AGENT = { command: '', argsTemplate: ['{prompt}'], outputMode: 'stdout' as const };
const ctx: Ctx = { root: ROOT, bridge: memoryBridge, agent: AGENT };

beforeEach(async () => {
  resetMemoryBridge();
  const w = (p: string, c: string) => memoryBridge.writeFile(ROOT, p, c);
  await w('canon/setting-bible.md', '# 바이블');
  await w('story/chapters/ep001/manuscript.md', '# 1화\n본문');
  await w('style/presets/style-1.json', '{"name":"풍"}');
  await w('.bindery/settings.json', '{"schema_version":"bindery.settings.v1"}');
  await w('.bindery/usage.json', '[]');
  // 제외 대상 — 재생성 캐시
  await w('.bindery/runs/index.json', '[]');
  await w('.bindery/trace/123.prompt.md', 'prompt');
  await w('.bindery/snapshots/index.json', '[]');
});

describe('프로젝트 백업', () => {
  it('진실 파일은 담고 재생성 캐시는 제외한다', async () => {
    const { bytes, fileCount } = await buildProjectBackup(ctx);
    // 유효한 zip 시그니처.
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    const all = new TextDecoder().decode(bytes);
    expect(all).toContain('canon/setting-bible.md');
    expect(all).toContain('story/chapters/ep001/manuscript.md');
    expect(all).toContain('style/presets/style-1.json');
    expect(all).toContain('.bindery/settings.json');
    expect(all).toContain('.bindery/usage.json');
    // 캐시는 제외.
    expect(all).not.toContain('.bindery/runs/index.json');
    expect(all).not.toContain('.bindery/trace/123.prompt.md');
    expect(all).not.toContain('.bindery/snapshots/index.json');
    // settings + usage + bible + manuscript + preset = 5개.
    expect(fileCount).toBe(5);
  });

  it('백업 파일명은 안전하고 타임스탬프를 포함한다', () => {
    const name = backupFileName('내 작품/제목');
    expect(name).toMatch(/^내 작품 제목-backup-\d{8}\d{4}\.zip$/);
  });

  it('Bindery 백업 zip을 현재 프로젝트에 복원한다', async () => {
    const backup = await buildProjectBackup(ctx);
    await memoryBridge.writeFile(ROOT, 'story/chapters/ep001/manuscript.md', '# 변경됨');
    await memoryBridge.deleteFile(ROOT, 'canon/setting-bible.md');

    const preview = await previewProjectRestore(ctx, backup.bytes);
    expect(preview.createCount).toBe(1);
    expect(preview.overwriteCount).toBe(1);
    expect(preview.unchangedCount).toBe(3);
    expect(preview.entries.find((e) => e.path === 'canon/setting-bible.md')?.status).toBe('create');
    expect(preview.entries.find((e) => e.path === 'story/chapters/ep001/manuscript.md')?.status).toBe('overwrite');

    const result = await restoreProjectBackup(ctx, backup.bytes);
    expect(result.restored).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.unchanged).toBe(3);
    expect(result.restorePoint.createdPaths).toEqual(['canon/setting-bible.md']);
    expect(result.restorePoint.snapshots.map((s) => s.targetPath)).toEqual(['story/chapters/ep001/manuscript.md']);
    expect(await memoryBridge.readFile(ROOT, 'story/chapters/ep001/manuscript.md')).toBe('# 1화\n본문');
    expect(await memoryBridge.readFile(ROOT, 'canon/setting-bible.md')).toBe('# 바이블');
    expect(await memoryBridge.exists(ROOT, `.bindery/snapshots/project/${result.restorePoint.id}.restore.json`)).toBe(true);
  });

  it('복원 지점으로 방금 복원을 되돌린다', async () => {
    const backup = await buildProjectBackup(ctx);
    await memoryBridge.writeFile(ROOT, 'story/chapters/ep001/manuscript.md', '# 변경 전 사용자 원고');
    await memoryBridge.deleteFile(ROOT, 'canon/setting-bible.md');

    const restored = await restoreProjectBackup(ctx, backup.bytes);
    const rollback = await rollbackProjectRestore(ctx, restored.restorePoint);

    expect(rollback).toEqual({ restored: 1, deleted: 1, skipped: 0 });
    expect(await memoryBridge.readFile(ROOT, 'story/chapters/ep001/manuscript.md')).toBe('# 변경 전 사용자 원고');
    await expect(memoryBridge.readFile(ROOT, 'canon/setting-bible.md')).rejects.toThrow();
  });

  it('복원 시 경로 탈출·캐시·비텍스트 엔트리는 건너뛴다', async () => {
    const bytes = zipStore([
      { path: '../escape.md', content: 'bad' },
      { path: '/abs.md', content: 'bad' },
      { path: '__MACOSX/._junk.md', content: 'bad' },
      { path: '.bindery/runs/index.json', content: 'cache' },
      { path: 'cover.png', content: 'binary' },
      { path: 'story/chapters/ep001/manuscript.md', content: '# 복원됨' }
    ]);

    const parsed = readProjectBackup(bytes);
    expect(parsed.entries.map((e) => e.path)).toEqual(['story/chapters/ep001/manuscript.md']);
    expect(parsed.skipped).toBe(5);

    const result = await restoreProjectBackup(ctx, bytes);
    expect(result.restored).toBe(1);
    expect(result.skipped).toBe(5);
    expect(result.unchanged).toBe(0);
    expect(await memoryBridge.readFile(ROOT, 'story/chapters/ep001/manuscript.md')).toBe('# 복원됨');
    await expect(memoryBridge.readFile(ROOT, '../escape.md')).rejects.toThrow();
  });
});
