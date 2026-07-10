import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, readOptional } from '../src/lib/harness/project';
import { detectPlanningPackage, importPlanningPackage } from '../src/lib/harness/sourcePackage';
import { memoryBridge, resetMemoryBridge } from '../src/lib/bridge/memoryBridge';
import type { SourceUpload } from '../src/lib/harness/sourceUploads';
import type { Ctx } from '../src/lib/harness/types';

function upload(path: string, content: string): SourceUpload {
  return {
    id: path,
    name: `planning.zip/${path}`,
    size: new TextEncoder().encode(content).length,
    chars: content.length,
    content,
    truncated: false
  };
}

describe('structured planning package', () => {
  let ctx: Ctx;

  beforeEach(async () => {
    resetMemoryBridge();
    const meta = await createProject(memoryBridge, '/vault', '패키지 작품', '토푸');
    ctx = {
      root: meta.root,
      bridge: memoryBridge,
      agent: { command: '', argsTemplate: [], outputMode: 'stdout' },
      offline: true
    };
  });

  it('detects canon/world/plot roles and imports them with snapshots', async () => {
    const files = [
      upload('canon/setting-bible-v51.md', '# 설정 바이블\n\n확정 세계 규칙과 장기 전제가 충분히 들어 있다.'),
      upload('canon/character-bible-v51.md', '# 인물 바이블\n\n렌은 메달리온을 상속받는다.'),
      upload('world/dungeon-industry-bible-v51.md', '# 던전 산업\n\n리그와 계약 규칙.'),
      upload('plot/season1-plot-bible-v51.md', '# 시즌 플롯\n\n1화 상속, 2화 첫 원정.'),
      upload('status/resume-state-v51.md', '# Resume State\n\n다음 회차는 ep001.')
    ];
    const pkg = detectPlanningPackage(files);
    expect(pkg?.archiveName).toBe('planning.zip');
    expect(pkg?.files).toHaveLength(5);

    const result = await importPlanningPackage(ctx, pkg!);
    expect(result.writtenPaths).toEqual(expect.arrayContaining([
      'canon/setting-bible.md',
      'characters/imported-character-bible-v51.md',
      'world/imported-dungeon-industry-bible-v51.md',
      'plot/imported-plot-bible.md',
      'status/resume-state.md'
    ]));
    expect(result.snapshotCount).toBeGreaterThanOrEqual(2);
    expect(await readOptional(ctx, 'canon/setting-bible.md')).toContain('확정 세계 규칙');
    expect(await readOptional(ctx, 'plot/imported-plot-bible.md')).toContain('1화 상속');
    expect(result.plotPrompt).toContain('새 사건을 추가하지 말고');
  });

  it('does not misclassify an ordinary text zip as a structured package', () => {
    expect(detectPlanningPackage([
      upload('notes/idea.md', '# 아이디어\n\n던전 경영물')
    ])).toBeNull();
  });
});
