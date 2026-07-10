import { beforeEach, describe, expect, it } from 'vitest';
import { memoryBridge, resetMemoryBridge } from '../src/lib/bridge';
import { diffProjectFileDigests, flattenTrackedFiles, loadProjectFileDigest, shouldTrackProjectFile } from '../src/lib/harness/projectChanges';
import type { Ctx } from '../src/lib/harness/types';

const ROOT = '/project-change-test';

function ctx(): Ctx {
  return {
    root: ROOT,
    bridge: memoryBridge,
    agent: { command: '', argsTemplate: [], outputMode: 'stdout' },
    offline: true
  };
}

describe('project external change tracking', () => {
  beforeEach(() => resetMemoryBridge());

  it('tracks author-editable text files and ignores volatile outputs', () => {
    expect(shouldTrackProjectFile('story/chapters/ep001/manuscript.md')).toBe(true);
    expect(shouldTrackProjectFile('.bindery/settings.json')).toBe(true);
    expect(shouldTrackProjectFile('.bindery/snapshots/ep001/s.md')).toBe(false);
    expect(shouldTrackProjectFile('.bindery/trace/run.prompt')).toBe(false);
    expect(shouldTrackProjectFile('exports/full.docx')).toBe(false);
    expect(shouldTrackProjectFile('src-tauri/target/release/build/output.json')).toBe(false);
    expect(shouldTrackProjectFile('dist/assets/index.json')).toBe(false);
  });

  it('flattens only tracked files from a project tree', () => {
    expect(flattenTrackedFiles([
      {
        name: 'story',
        path: 'story',
        kind: 'directory',
        children: [
          { name: 'manuscript.md', path: 'story/chapters/ep001/manuscript.md', kind: 'file' },
          { name: 'cover.png', path: 'story/cover.png', kind: 'file' }
        ]
      },
      { name: 'settings.json', path: '.bindery/settings.json', kind: 'file' }
    ])).toEqual(['.bindery/settings.json', 'story/chapters/ep001/manuscript.md']);
  });

  it('detects created, modified, and deleted files from bridge digests', async () => {
    const c = ctx();
    await memoryBridge.writeFile(ROOT, 'story/chapters/ep001/manuscript.md', '# 1화');
    await memoryBridge.writeFile(ROOT, 'canon/bible.md', '바이블');
    const before = await loadProjectFileDigest(c);

    await memoryBridge.writeFile(ROOT, 'story/chapters/ep001/manuscript.md', '# 1화\n수정');
    await memoryBridge.deleteFile(ROOT, 'canon/bible.md');
    await memoryBridge.writeFile(ROOT, 'notes/new.txt', '새 메모');
    const after = await loadProjectFileDigest(c);

    expect(diffProjectFileDigests(before, after)).toEqual([
      { path: 'canon/bible.md', kind: 'deleted' },
      { path: 'notes/new.txt', kind: 'created' },
      { path: 'story/chapters/ep001/manuscript.md', kind: 'modified' }
    ]);
  });
});
