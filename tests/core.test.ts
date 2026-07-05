// 코어 단위 테스트 — diff/hunk, frontmatter, 계약 파서.
import { describe, it, expect } from 'vitest';
import { diffLines, groupHunks, applyHunks } from '../src/lib/core/diff';
import { parseFrontmatter, extractJsonObject, contentHash } from '../src/lib/core/text';
import { parseIdeaSeedBatch, parseWorldExpansionProposal, parseCanonDeltaProposal, parseDraftCandidate, parseQAReport } from '../src/lib/schemas/contracts';

describe('diff', () => {
  it('hunk 단위 선택 적용', () => {
    const base = 'a\nb\nc\nd\ne';
    const next = 'a\nB\nc\nd\nE';
    const hunks = groupHunks(diffLines(base, next));
    expect(hunks.length).toBe(2);
    // 첫 hunk만 적용
    expect(applyHunks(base, hunks, new Set([hunks[0].id]))).toBe('a\nB\nc\nd\ne');
    // 전체 적용
    expect(applyHunks(base, hunks, new Set(hunks.map((h) => h.id)))).toBe(next);
    // 아무것도 적용 안 함
    expect(applyHunks(base, hunks, new Set())).toBe(base);
  });

  it('추가·삭제만 있는 경우', () => {
    const base = 'a\nb';
    const next = 'a\nb\nc\nd';
    const hunks = groupHunks(diffLines(base, next));
    expect(applyHunks(base, hunks, new Set(hunks.map((h) => h.id)))).toBe(next);
  });
});

describe('text', () => {
  it('frontmatter 파싱과 리스트', () => {
    const fm = parseFrontmatter('---\ntitle: 테스트\ntags:\n  - a\n  - b\n---\n본문');
    expect(fm.present).toBe(true);
    expect(fm.data.title).toBe('테스트');
    expect(fm.data.tags).toEqual(['a', 'b']);
    expect(fm.body).toBe('본문');
  });

  it('JSON 추출 — fenced/임베디드', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJsonObject('앞말 {"a":{"b":2}} 뒷말')).toEqual({ a: { b: 2 } });
    expect(extractJsonObject('json 아님')).toBeNull();
  });

  it('contentHash 안정성', () => {
    expect(contentHash('abc')).toBe(contentHash('abc'));
    expect(contentHash('abc')).not.toBe(contentHash('abd'));
  });
});

describe('contracts', () => {
  it('IdeaSeedBatch — 필수 필드 없는 seed 제외', () => {
    const seeds = parseIdeaSeedBatch(JSON.stringify({
      seeds: [
        { title: 'A', hook: 'h', reader_promise: 'p' },
        { title: '', hook: 'h', reader_promise: 'p' }
      ]
    }), '2026-07-05');
    expect(seeds?.length).toBe(1);
  });

  it('WorldExpansionProposal — kind 검증', () => {
    const p = parseWorldExpansionProposal(JSON.stringify({
      assets: [
        { kind: 'character', name: '렌', one_line_function: '시점 인물' },
        { kind: 'nonsense', name: 'X', one_line_function: 'f' }
      ]
    }));
    expect(p?.assets.length).toBe(1);
    expect(p?.assets[0].detail_md).toContain('렌');
  });

  it('CanonDeltaProposal — 경로 탈출·허용 밖 경로 거부', () => {
    const p = parseCanonDeltaProposal(JSON.stringify({
      episode: 'ep001',
      changes: [
        { target_path: 'characters/ren.md', change_type: 'update', summary: 's', patch: 'p', risk: 'low' },
        { target_path: '../etc/passwd', change_type: 'update', summary: 's', patch: 'p', risk: 'low' },
        { target_path: 'src/evil.ts', change_type: 'update', summary: 's', patch: 'p', risk: 'low' }
      ]
    }), 'ep001');
    expect(p?.changes.length).toBe(1);
    expect(p?.changes[0].target_path).toBe('characters/ren.md');
  });

  it('DraftCandidate — 거절/비한국어/동일 원고 거부', () => {
    const ok = parseDraftCandidate(JSON.stringify({ manuscript_md: '그는 오래된 상점의 문을 밀었다. '.repeat(20) }), 'ep001', '');
    expect(ok.candidate).not.toBeNull();
    const refusal = parseDraftCandidate(JSON.stringify({ manuscript_md: '죄송하지만 요청을 수행할 수 없습니다. '.repeat(20) }), 'ep001', '');
    expect(refusal.candidate).toBeNull();
    const english = parseDraftCandidate(JSON.stringify({ manuscript_md: 'english only text. '.repeat(30) }), 'ep001', '');
    expect(english.candidate).toBeNull();
  });

  it('QAReport — 근거 없는 fail은 warn으로 강등', () => {
    const r = parseQAReport(JSON.stringify({
      aspect: 'continuity',
      gates: [{ id: 'pov', score: 40, verdict: 'fail', issues: [{ severity: 'fail', summary: '시점 이탈', evidence: '', location: '', suggestion: '' }] }]
    }), 'continuity', 'ep001');
    expect(r?.gates[0].issues[0].severity).toBe('warn');
  });
});
