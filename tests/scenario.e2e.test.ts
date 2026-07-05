// 검증 시나리오 E2E (지시서 §11) — memory 브리지 + 스크립트된 에이전트로
// "새 작품 → 소재 → 세계관 → 바이블 → 플롯 → 브리프 → 장면 → 초안 → diff →
//  QA → 수정 → 일부 적용 → 요약 → 정사 proposal → resume state" 전체 루프를 돌린다.
import { describe, it, expect, beforeEach } from 'vitest';
import { memoryBridge, resetMemoryBridge, setAgentScript } from '../src/lib/bridge/memoryBridge';
import type { Ctx } from '../src/lib/harness/types';
import { createProject } from '../src/lib/harness/project';
import { discoverIdeas, listIdeas, moveIdea } from '../src/lib/harness/ideas';
import { expandWorld } from '../src/lib/harness/world';
import { applyProposal, decideItem, loadProposals, assetTargetPath, pendingCount } from '../src/lib/harness/proposals';
import { assembleBible, applyBibleCandidate } from '../src/lib/harness/bible';
import { proposePlot, approvePlotEpisodes, loadPlotPlan } from '../src/lib/harness/plot';
import {
  generateBrief, generateScenePlan, generateDraftCandidates, readCandidateBody,
  applyToManuscript, runQA, generateRevisionPlanStage, generateRevisionCandidate
} from '../src/lib/harness/episode';
import { summarizeEpisode, proposeCanonDelta, fixEpisode, loadProgress } from '../src/lib/harness/closeout';
import { diffLines, groupHunks, applyHunks } from '../src/lib/core/diff';
import { LAYOUT, episodePaths } from '../src/lib/core/layout';
import type { QAReport } from '../src/lib/schemas/contracts';

const AGENT = { command: 'mock-agent', argsTemplate: ['{prompt}'], outputMode: 'stdout' as const };

const KOREAN_DRAFT = [
  '유품 정리는 새벽에 시작되었다. 렌은 장갑을 끼기 전에 잠시 문 앞에 서 있었다.',
  '',
  '상자 속의 메달리온은 차가웠다. 각인이 손끝에서 얕게 빛났고, 렌은 그것이 빚의 표식이라는 것을 아직 몰랐다.',
  '',
  '"이 집의 물건은 전부 목록에 있습니다." 관리인의 목소리는 서류처럼 건조했다.',
  '',
  '렌은 고개를 끄덕였지만, 목록에 없는 서랍 하나가 이미 눈에 들어와 있었다.',
  '',
  '서랍은 잠겨 있지 않았다. 그 안에는 편지 한 장 없이, 메달리온과 같은 문양이 새겨진 빈 상자만 놓여 있었다.',
  '',
  '손끝이 문양에 닿는 순간, 각인이 손등을 타고 올라왔다. 세상의 왼쪽 절반이 천천히 어두워졌고, 렌은 그것이 대가라는 것을 본능적으로 알았다.',
  '',
  '"괜찮으십니까?" 관리인이 물었을 때, 렌은 이미 목록의 마지막 줄을 다시 읽고 있었다. 거기에는 자신의 이름이 적혀 있었다.'
].join('\n');

function scriptedAgent(prompt: string, label: string): { ok: true; text: string; stderr: ''; exitCode: 0; durationMs: 5; mode: 'memory-mock' } | null {
  const reply = (text: string) => ({ ok: true as const, text, stderr: '' as const, exitCode: 0 as const, durationMs: 5 as const, mode: 'memory-mock' as const });
  if (label.includes('idea-discovery')) {
    return reply(JSON.stringify({
      seeds: [
        { title: '메달리온의 계승', genre_tags: ['현대판타지'], hook: '유품에서 산 자의 계약이 튀어나온다', emotional_engine: '상속된 죄책감', reader_promise: '매 회차 하나의 유품, 하나의 비밀', longform_potential: '유품 단위 에피소드 + 계약 추적 메인 플롯', first_scene_image: '새벽의 유품 정리 현장', risks: ['소재 반복 시 단조로움'] },
        { title: '야간 사서', genre_tags: ['미스터리'], hook: '밤에만 열리는 서고', emotional_engine: '금지된 앎', reader_promise: '한 권의 금서, 한 명의 의뢰인', longform_potential: '금서 목록이 곧 시즌 구조', first_scene_image: '자정의 대출 창구', risks: ['에피소드 고립'] }
      ]
    }));
  }
  if (label.includes('world-expansion')) {
    return reply(JSON.stringify({
      premise: '유품 정리사가 메달리온과 함께 죽은 자의 계약을 상속받는다',
      assets: [
        { kind: 'character', name: '렌', one_line_function: '유품 정리사, 계약을 상속받는 시점 인물', detail_md: '## 상태\n- 각인 없음 (ep001에서 발현)\n\n## 결핍\n- 가족 부채', needed_by: 'ep001', risk: '' },
        { kind: 'institution', name: '유품관리공사', one_line_function: '계약 회수의 적대 축', detail_md: '## 기능\n- 사망자의 미청산 계약을 회수한다', needed_by: 'ep002', risk: '' },
        { kind: 'rule', name: '계승 각인', one_line_function: '계약 상속의 물리 규칙 — 대가 없는 힘은 없다', detail_md: '## 규칙\n- 각인은 감각 하나를 담보로 잡는다', needed_by: 'ep001', risk: '감각 상실 묘사 부담' }
      ],
      story_license_notes: ['계약의 최초 발행자는 미정으로 열어둔다']
    }));
  }
  if (label.includes('bible-assembly')) {
    return reply('# 설정 바이블 — 메달리온의 계승\n\n## 전제\n유품 정리사 렌이 죽은 자의 계약을 상속받는다.\n\n## 세계 규칙 (어기면 안 되는 것)\n- 계승 각인은 감각 하나를 담보로 잡는다: world/systems/계승-각인.md\n\n## 주요 인물\n| 이름 | 기능 | 상태 | 파일 |\n|---|---|---|---|\n| 렌 | 시점 인물 | 각인 미발현 | characters/렌.md |\n\n## 미확정 (열어둔 것)\n- 계약의 최초 발행자');
  }
  if (label.includes('plot-plan')) {
    return reply(JSON.stringify({
      arcs: [{ id: 'arc1', label: '1부 — 상속', goal: '렌이 계약의 실체를 안다', episodes: 'ep001-ep004' }],
      episodes: [
        { episode: 'ep001', arc: 'arc1', title: '새벽의 목록', goal: '렌이 메달리온을 상속받고 각인이 발현된다', beats: ['유품 정리 개시', '목록에 없는 서랍', '각인 발현'], threads_open: ['목록에 없는 서랍의 주인'], threads_close: [], hook: '각인이 렌의 왼쪽 시야를 가져간다', risk: '' },
        { episode: 'ep002', arc: 'arc1', title: '공사의 방문', goal: '유품관리공사가 회수를 통보한다', beats: ['공사 등장', '회수 시한 통보'], threads_open: ['공사 내부의 협력자'], threads_close: ['목록에 없는 서랍의 주인'], hook: '회수 시한 7일', risk: '' }
      ]
    }));
  }
  if (label.includes('episode-brief')) {
    return reply(JSON.stringify({
      episode: 'ep001', goal: '렌이 메달리온을 상속받고 각인이 발현된다',
      must_events: ['유품 정리 개시', '목록에 없는 서랍 발견', '각인 발현'],
      characters: ['렌', '관리인'], locations: ['고인의 자택'], pov: '렌',
      knowledge_change: ['메달리온이 단순 유품이 아니라는 것'], emotion_change: ['렌: 무심함 → 불안'],
      conflict_change: '개인 부채 문제에 초자연 계약이 얹힌다',
      threads_touch: ['목록에 없는 서랍의 주인 (심기)'], forbidden: ['공사를 ep001에 등장시키지 않는다'],
      target_length: 1200, exit_hook: '각인이 렌의 왼쪽 시야를 가져간다'
    }));
  }
  if (label.includes('scene-plan')) {
    return reply(JSON.stringify({
      episode: 'ep001',
      scenes: [
        { id: 's1', purpose: '유품 정리 개시와 일상 톤 확립', setting: '새벽, 고인의 자택', characters: ['렌', '관리인'], conflict: '목록과 현실의 불일치', turn: '목록에 없는 서랍 발견', carries: ['유품 정리 개시', '목록에 없는 서랍 발견'], target_length: 600, exit: '서랍에 손을 대는 렌' },
        { id: 's2', purpose: '메달리온 상속과 각인 발현', setting: '같은 집, 안방', characters: ['렌'], conflict: '호기심 대 직업 윤리', turn: '각인 발현 — 왼쪽 시야 상실', carries: ['각인 발현'], target_length: 600, exit: '시야가 어두워지는 감각' }
      ],
      risks: []
    }));
  }
  if (label.includes('revision-candidate')) {
    return reply(JSON.stringify({
      episode: 'ep001',
      manuscript_md: KOREAN_DRAFT.replace('차가웠다', '얼음장 같았다'),
      scene_coverage: [], canon_delta_candidates: [],
      style_self_check: { score: 80, notes: '' },
      change_summary: '반영 항목: r1'
    }));
  }
  if (label.includes('draft-candidate')) {
    return reply(JSON.stringify({
      episode: 'ep001',
      manuscript_md: KOREAN_DRAFT,
      scene_coverage: [{ scene: 's1', covered: true, note: '' }, { scene: 's2', covered: true, note: '' }],
      canon_delta_candidates: [{ summary: '렌: 각인 발현, 왼쪽 시야 상실', target_hint: 'characters/렌.md', risk: 'medium' }],
      style_self_check: { score: 78, notes: '' },
      change_summary: '장면 계획 2장면을 그대로 따름'
    }));
  }
  if (label.includes('qa-continuity')) {
    return reply(JSON.stringify({
      aspect: 'continuity', episode: 'ep001',
      gates: [
        { id: 'plot_goal', score: 85, verdict: 'pass', issues: [] },
        { id: 'threads', score: 70, verdict: 'warn', issues: [{ severity: 'warn', summary: '각인 발현 장면이 압축적', evidence: '각인이 손끝에서 얕게 빛났고', location: '중간', suggestion: '감각 상실의 대가를 한 문장 더 보여줄 것' }] }
      ],
      overall: { score: 78, verdict: 'warn', note: '' }
    }));
  }
  if (label.includes('revision-plan')) {
    return reply(JSON.stringify({
      episode: 'ep001',
      items: [{ id: 'r1', severity: 'warn', instruction: '메달리온의 냉기를 더 물성 있게 바꾼다', target: '차가웠다', source_gate: 'continuity/threads' }],
      note: ''
    }));
  }
  if (label.includes('summary')) {
    return reply('# ep001 요약\n\n## 한 줄 요약\n- 렌이 메달리온을 상속받고 각인이 왼쪽 시야를 가져갔다.\n\n## 장면 흐름\n- 유품 정리 개시\n- 목록에 없는 서랍 발견\n- 각인 발현\n\n## 인물 상태 변화\n- 렌: 각인 미발현 → 각인 1단계, 왼쪽 시야 상실\n\n## 관계 변화\n- 없음\n\n## 떡밥\n- 새로 열림: 목록에 없는 서랍의 주인\n- 회수됨: 없음\n\n## 다음 회차 연결점\n- 각인의 대가를 안 렌이 계약의 출처를 추적하기 시작한다');
  }
  if (label.includes('canon-delta')) {
    return reply(JSON.stringify({
      episode: 'ep001', requires_human_approval: true,
      changes: [
        { target_path: 'characters/렌.md', change_type: 'update', summary: '렌: 각인 1단계, 왼쪽 시야 상실', patch: '## ep001 이후 상태\n- 각인 1단계 발현\n- 왼쪽 시야 상실', risk: 'medium' },
        { target_path: 'plot/open-threads.md', change_type: 'add_fact', summary: '떡밥: 목록에 없는 서랍의 주인', patch: '- 목록에 없는 서랍의 주인 (ep001에서 심음)', risk: 'low' }
      ]
    }));
  }
  return null;
}

describe('검증 시나리오 — 소재 발굴부터 resume state까지', () => {
  let ctx: Ctx;

  beforeEach(async () => {
    resetMemoryBridge();
    setAgentScript(scriptedAgent);
    const meta = await createProject(memoryBridge, '/vault', '메달리온의 계승', '토푸');
    ctx = { root: meta.root, bridge: memoryBridge, agent: AGENT };
  });

  it('전체 루프가 파일 기반으로 이어진다', async () => {
    // 1. 소재 후보 생성 → ideas/inbox
    const { files } = await discoverIdeas(ctx, { genres: '현대판타지', mood: '서늘한 성장담', cliches: '', readerExperience: '', avoid: '회귀', notes: '', count: 2 }, []);
    expect(files.length).toBe(2);
    expect(files[0].path.startsWith('ideas/inbox/')).toBe(true);

    // 2. 소재 채택 (사람의 결정 = 폴더 이동)
    const selected = await moveIdea(ctx, files[0], 'selected');
    await moveIdea(ctx, files[1], 'discarded');
    const ideas = await listIdeas(ctx);
    expect(ideas.find((i) => i.seed.title === '메달리온의 계승')?.status).toBe('selected');

    // 3. 세계관 확장 proposal — 파일은 아직 생기지 않는다
    const { proposal } = await expandWorld(ctx, [selected], '');
    expect(proposal.status).toBe('pending');
    expect(await memoryBridge.exists(ctx.root, 'characters/렌.md')).toBe(false);

    // 4. 자산 승인 → 파일 생성 (거부 1건은 생성 안 됨)
    let decided = proposal;
    decided = decideItem(decided, 0, 'approved');
    decided = decideItem(decided, 1, 'rejected');
    decided = decideItem(decided, 2, 'approved');
    const applied = await applyProposal(ctx, decided);
    expect(applied.status).toBe('partial');
    expect(await memoryBridge.exists(ctx.root, 'characters/렌.md')).toBe(true);
    expect(await memoryBridge.exists(ctx.root, assetTargetPath(proposal.payload.assets[1]))).toBe(false);

    // 5. 바이블 조립 → 후보 → 적용 (스냅샷 포함)
    const { candidatePath } = await assembleBible(ctx, '메달리온의 계승', [selected]);
    await applyBibleCandidate(ctx, candidatePath);
    const bible = await memoryBridge.readFile(ctx.root, LAYOUT.canon.bible);
    expect(bible).toContain('계승 각인');

    // 6. 플롯 설계 → ep001 승인
    await proposePlot(ctx, 2, '');
    await approvePlotEpisodes(ctx, ['ep001']);
    const plan = await loadPlotPlan(ctx);
    expect(plan?.episodes[0].status).toBe('approved');
    expect(plan?.episodes[1].status).toBe('draft');

    // 7. 회차 브리프 → 파일로 존재
    const brief = await generateBrief(ctx, 'ep001', '', 1200);
    expect(brief.source).toBe('agent');
    expect(await memoryBridge.exists(ctx.root, episodePaths('ep001').brief)).toBe(true);

    // 8. 장면 계획
    const scenes = await generateScenePlan(ctx, 'ep001');
    expect('output' in scenes && scenes.output.scenes.length).toBe(2);

    // 9. 초안 후보 — 원고를 덮어쓰지 않는다
    const { candidates } = await generateDraftCandidates(ctx, 'ep001', 1, '');
    expect(candidates.length).toBe(1);
    const manuscriptBefore = await memoryBridge.readFile(ctx.root, episodePaths('ep001').manuscript);
    expect(manuscriptBefore).not.toContain('메달리온은 차가웠다');

    // 10. diff 확인 후 전체 적용 (스냅샷 생성 확인)
    const body = await readCandidateBody(ctx, candidates[0]);
    const hunks = groupHunks(diffLines('', body));
    expect(hunks.length).toBeGreaterThan(0);
    await applyToManuscript(ctx, 'ep001', body, '후보 A 전체 적용');
    const manuscriptAfter = await memoryBridge.readFile(ctx.root, episodePaths('ep001').manuscript);
    expect(manuscriptAfter).toContain('메달리온은 차가웠다');
    const snapshots = JSON.parse(await memoryBridge.readFile(ctx.root, `${LAYOUT.bindery.snapshots}/index.json`));
    expect(snapshots.length).toBeGreaterThan(0);

    // 11. QA (연속성 관점)
    const qa = await runQA(ctx, 'ep001', 'continuity', { label: '현재 원고', content: manuscriptAfter });
    expect(qa.output.overall.verdict).toBe('warn');

    // 12. 수정 계획 → 수정 후보 → hunk 일부 적용
    const revPlan = await generateRevisionPlanStage(ctx, 'ep001', [qa.output as QAReport], []);
    expect(revPlan.output.items.length).toBe(1);
    const { candidate: revCand } = await generateRevisionCandidate(ctx, 'ep001', revPlan.output);
    expect(revCand).not.toBeNull();
    const revBody = await readCandidateBody(ctx, revCand!);
    const currentBody = manuscriptAfter.replace(/^---[\s\S]*?---\n\n?/, '');
    const revHunks = groupHunks(diffLines(currentBody, revBody));
    expect(revHunks.length).toBeGreaterThan(0);
    const partial = applyHunks(currentBody, revHunks, new Set([revHunks[0].id]));
    await applyToManuscript(ctx, 'ep001', partial, '수정 후보 일부 적용');
    expect(await memoryBridge.readFile(ctx.root, episodePaths('ep001').manuscript)).toContain('얼음장');

    // 13. 요약 → canon/summaries
    await summarizeEpisode(ctx, 'ep001');
    expect(await memoryBridge.exists(ctx.root, 'canon/summaries/ep001.md')).toBe(true);

    // 14. 정사 변경 proposal — 승인 전에는 canon에 반영되지 않는다
    const { proposal: delta } = await proposeCanonDelta(ctx, 'ep001', candidates[0].deltaCandidates);
    expect(delta).not.toBeNull();
    const renBefore = await memoryBridge.readFile(ctx.root, 'characters/렌.md');
    expect(renBefore).not.toContain('왼쪽 시야 상실');
    let deltaDecided = delta!;
    deltaDecided = decideItem(deltaDecided, 0, 'approved');
    deltaDecided = decideItem(deltaDecided, 1, 'approved');
    await applyProposal(ctx, deltaDecided);
    expect(await memoryBridge.readFile(ctx.root, 'characters/렌.md')).toContain('왼쪽 시야 상실');
    expect(await memoryBridge.readFile(ctx.root, LAYOUT.plot.openThreads)).toContain('목록에 없는 서랍');

    // 15. 기록·픽스 → resume state 갱신 → 다음 회차 ep002
    await fixEpisode(ctx, 'ep001');
    const progress = await loadProgress(ctx);
    expect(progress.ep001.status).toBe('fixed');
    const resume = await memoryBridge.readFile(ctx.root, LAYOUT.status.resume);
    expect(resume).toContain('다음 회차: ep002');
    expect(resume).toContain('각인 1단계');
    expect(pendingCount(await loadProposals(ctx))).toBe(1); // 세계관 proposal이 partial로 남아있음
  });

  it('오프라인 폴백 — AI 없이도 흐름이 끊기지 않고, 정직하게 표시된다', async () => {
    setAgentScript(null);
    const offline: Ctx = { ...ctx, offline: true };

    const { files, outcome } = await discoverIdeas(offline, { genres: '', mood: '', cliches: '', readerExperience: '', avoid: '', notes: '', count: 3 }, []);
    expect(outcome.source).toBe('fallback');
    expect(files.length).toBe(1); // 뼈대 1건만 — AI 흉내 금지
    expect(files[0].seed.risks.join(' ')).toContain('AI 미연결');

    // 정사 변경은 오프라인에서 proposal 자체를 만들지 않는다 (지어내기 금지)
    const { proposal } = await proposeCanonDelta(offline, 'ep001', []);
    expect(proposal).toBeNull();

    // 수정 후보도 오프라인에서는 거부된다 (원고 훼손 방지)
    const { candidate, error } = await generateRevisionCandidate(offline, 'ep001', {
      schema_version: 'bindery.revision_plan.v1', episode: 'ep001',
      items: [{ id: 'r1', severity: 'warn', instruction: 'x', target: '', source_gate: '', accepted: true }],
      note: '', source: 'local'
    });
    expect(candidate).toBeNull();
    expect(error).toBeTruthy();
  });
});
