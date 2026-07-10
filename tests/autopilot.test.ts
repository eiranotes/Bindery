// autopilot/workflow 레이어 검증 — 간단 모드 계약:
// 1) 버튼 하나로 설계→초안 후보까지 자동 진행 (기존 stage 재사용, 의미 라벨)
// 2) soft output(브리프·장면 계획)은 autopilot이 자동 승인
// 3) hard commit(원고 반영·canon 변경·픽스)은 절대 자동 확정되지 않는다
// 4) workflow가 상태별 next action을 올바르게 계산한다
import { describe, it, expect, beforeEach } from 'vitest';
import { memoryBridge, resetMemoryBridge, setAgentScript } from '../src/lib/bridge/memoryBridge';
import type { Ctx } from '../src/lib/harness/types';
import { createProject, readOptional } from '../src/lib/harness/project';
import {
  runEpisodeAutopilot, runRevisionAutopilot, runCloseEpisodeAutopilot,
  finalizeCloseEpisode, applyCandidateToManuscript, DEFAULT_CANDIDATE_LABELS,
  runProjectStarterAutopilot, adoptStarterIdea, ensureStoryFoundation
} from '../src/lib/harness/autopilot';
import { loadWorkflowSnapshot, computeNextStep } from '../src/lib/harness/workflow';
import { loadBrief, loadScenePlan } from '../src/lib/harness/episode';
import { loadProgress } from '../src/lib/harness/closeout';
import { loadProposals } from '../src/lib/harness/proposals';
import { loadPlotPlan } from '../src/lib/harness/plot';
import { LAYOUT, episodePaths } from '../src/lib/core/layout';
import type { Bridge } from '../src/lib/bridge/types';

const AGENT = { command: 'mock-agent', argsTemplate: ['{prompt}'], outputMode: 'stdout' as const };

const DRAFT = [
  '유품 정리는 새벽에 시작되었다. 렌은 장갑을 끼기 전에 잠시 문 앞에 서 있었다.',
  '',
  '상자 속의 메달리온은 차가웠다. 각인이 손끝에서 얕게 빛났고, 렌은 그것이 빚의 표식이라는 것을 아직 몰랐다.',
  '',
  '"이 집의 물건은 전부 목록에 있습니다." 관리인의 목소리는 서류처럼 건조했다.',
  '',
  '렌은 고개를 끄덕였지만, 목록에 없는 서랍 하나가 이미 눈에 들어와 있었다. 서랍 안에는 같은 문양이 새겨진 빈 상자만 놓여 있었다.',
  '',
  '손끝이 문양에 닿는 순간, 각인이 손등을 타고 올라왔다. 세상의 왼쪽 절반이 천천히 어두워졌다.'
].join('\n');

function reply(text: string) {
  return { ok: true as const, text, stderr: '' as const, exitCode: 0 as const, durationMs: 5 as const, mode: 'memory-mock' as const };
}

function scriptedAgent(prompt: string, label: string) {
  if (label.includes('idea-discovery')) {
    return reply(JSON.stringify({
      seeds: [
        {
          title: '던전 머니볼', genre_tags: ['판타지', '경영'],
          hook: '파산 직전 악마성을 데이터 운영으로 되살린다',
          emotional_engine: '저평가 자산을 알아보는 쾌감',
          reader_promise: '매 회차 가성비 전술이 하나씩 작동한다',
          longform_potential: '던전 리그와 신용평가, 몬스터 노무 이슈로 확장된다',
          first_scene_image: '적자 장부 위에 용사 파티 침공 로그가 겹쳐 뜬다',
          risks: ['설정이 숫자 설명으로 흐를 위험']
        }
      ]
    }));
  }
  if (label.includes('world-expansion')) {
    return reply(JSON.stringify({
      premise: '파산 직전 악마성이 마력 회계 시스템으로 흑자 전환을 노린다',
      assets: [
        {
          kind: 'character', name: '엘리고스',
          one_line_function: '마력 회계로 던전을 운영하는 던전 마스터',
          detail_md: '제66구역 악마성의 던전 마스터. 감정적 마력 낭비를 싫어하고 데이터로 용사 파티를 상대한다.',
          needed_by: 'ep001', risk: ''
        },
        {
          kind: 'system', name: '마력 회계 시스템',
          one_line_function: '던전 운영 비용을 실시간으로 보여주는 회계 체계',
          detail_md: '몬스터 소환, 함정 작동, 전리품 회수 비용을 계산해 순이익을 극대화한다.',
          needed_by: 'ep001', risk: ''
        }
      ],
      story_license_notes: ['초기 악마성의 등급은 미정']
    }));
  }
  if (label.includes('bible-assembly')) {
    return reply('```markdown\n# 설정 바이블 — 던전 머니볼\n\n## 전제\n파산 직전 악마성이 마력 회계 시스템으로 흑자 전환을 노린다. 엘리고스는 감이 아니라 데이터로 용사 파티를 상대한다.\n\n## 세계 규칙 (어기면 안 되는 것)\n- 마력 회계 시스템은 던전 운영 비용을 실시간으로 보여준다: world/systems/마력-회계-시스템.md\n\n## 주요 인물\n| 이름 | 기능 | 상태 | 파일 |\n|---|---|---|---|\n| 엘리고스 | 던전 마스터 | 적자 던전 운영 중 | characters/엘리고스.md |\n\n## 장소·기관\n| 이름 | 기능 | 파일 |\n|---|---|---|\n\n## 용어\n- 마력 회계 시스템: 던전 운영 비용을 회계화하는 체계\n\n## 미확정 (열어둔 것)\n- 초기 악마성의 등급\n```');
  }
  if (label.includes('plot-plan')) {
    const title = prompt.includes('마력 회계 시스템') ? '회계 장부 위의 악마성' : '바이블 누락 경로';
    return reply(JSON.stringify({
      arcs: [{ id: 'arc1', label: '가성비 악마성', goal: '적자 악마성을 흑자로 돌린다', episodes: 'ep001-ep008' }],
      episodes: [
        {
          episode: 'ep001', arc: 'arc1', title,
          goal: '엘리고스가 마력 회계 시스템으로 적자 원인을 찾는다',
          beats: ['적자 장부 확인', '용사 파티 침공 로그 분석', '첫 비용 절감 대상 지목'],
          threads_open: ['악마성 적자의 진짜 원인'], threads_close: [],
          hook: '가장 비싼 방어 자산을 해고하겠다고 선언한다', risk: '설정 필요'
        },
        {
          episode: 'ep002', arc: 'arc1', title: '첫 비용 절감',
          goal: '엘리고스가 저비용 방어 조합으로 첫 침공을 막는다',
          beats: ['저비용 몬스터 배치', '용사 파티 재침공', '마력 순이익 확인'],
          threads_open: [], threads_close: ['악마성 적자의 진짜 원인'],
          hook: '신용평가원이 악마성 등급 재심사를 예고한다', risk: ''
        }
      ]
    }));
  }
  if (label.includes('episode-brief')) {
    return reply(JSON.stringify({
      episode: 'ep001', goal: '렌이 메달리온을 상속받는다',
      must_events: ['유품 정리 개시', '각인 발현'], characters: ['렌'], locations: ['자택'], pov: '렌',
      knowledge_change: [], emotion_change: [], conflict_change: '',
      threads_touch: [], forbidden: [], target_length: 1200, exit_hook: '왼쪽 시야 상실'
    }));
  }
  if (label.includes('scene-plan')) {
    return reply(JSON.stringify({
      episode: 'ep001',
      scenes: [{ id: 's1', purpose: '개시', setting: '자택', characters: ['렌'], conflict: '', turn: '서랍 발견', carries: ['유품 정리 개시'], target_length: 600, exit: '' }],
      risks: []
    }));
  }
  if (label.includes('revision-candidate')) {
    return reply(JSON.stringify({
      episode: 'ep001', manuscript_md: DRAFT.replace('차가웠다', '얼음장 같았다'),
      scene_coverage: [], canon_delta_candidates: [], style_self_check: { score: 82, notes: '' }, change_summary: '반영: r1'
    }));
  }
  if (label.includes('draft-candidate')) {
    // 변주 지시(variation)에 라벨명이 들어왔는지 확인용으로 점수를 달리 준다
    const score = prompt.includes('감정안') ? 90 : prompt.includes('추진안') ? 70 : 80;
    return reply(JSON.stringify({
      episode: 'ep001', manuscript_md: DRAFT,
      scene_coverage: [{ scene: 's1', covered: true, note: '' }],
      canon_delta_candidates: [{ summary: '렌: 각인 발현', target_hint: 'characters/렌.md', risk: 'medium' }],
      style_self_check: { score, notes: '' }, change_summary: '장면 계획을 따름'
    }));
  }
  if (label.includes('qa-')) {
    const aspect = label.includes('qa-style') ? 'style' : label.includes('qa-continuity') ? 'continuity' : 'canon';
    return reply(JSON.stringify({
      aspect, episode: 'ep001',
      gates: [{ id: 'g1', score: 70, verdict: 'warn', issues: [{ severity: 'warn', summary: `${aspect} 이슈`, evidence: '', location: '', suggestion: '고칠 것' }] }],
      overall: { score: 70, verdict: 'warn', note: '' }
    }));
  }
  if (label.includes('revision-plan')) {
    return reply(JSON.stringify({
      episode: 'ep001',
      items: [{ id: 'r1', severity: 'warn', instruction: '냉기를 물성 있게', target: '차가웠다', source_gate: 'style/g1' }],
      note: ''
    }));
  }
  if (label.includes('summary')) {
    return reply('# ep001 요약\n\n## 한 줄 요약\n- 렌이 메달리온을 상속받았다.\n\n## 인물 상태 변화\n- 렌: 각인 발현\n\n## 떡밥\n- 새로 열림: 서랍의 주인');
  }
  if (label.includes('canon-delta')) {
    return reply(JSON.stringify({
      episode: 'ep001', requires_human_approval: true,
      changes: [
        { target_path: 'characters/렌.md', change_type: 'update', summary: '각인 발현', patch: '- 각인 1단계', risk: 'medium' },
        { target_path: 'world/rules.md', change_type: 'update', summary: '위험한 규칙 변경', patch: '- 규칙 변경', risk: 'high' }
      ]
    }));
  }
  return null;
}

async function prepareFoundation(ctx: Ctx) {
  await memoryBridge.writeFile(ctx.root, 'characters/엘리고스.md', [
    '---',
    'schema: bindery.world_asset.v1',
    'kind: character',
    'name: 엘리고스',
    'status: canon',
    '---',
    '',
    '# 엘리고스',
    '',
    '> 기능: 마력 회계로 던전을 운영하는 던전 마스터',
    '',
    '파산 직전 악마성을 데이터로 되살리려 한다.'
  ].join('\n'));
  await memoryBridge.writeFile(ctx.root, 'world/systems/마력-회계-시스템.md', [
    '---',
    'schema: bindery.world_asset.v1',
    'kind: system',
    'name: 마력 회계 시스템',
    'status: canon',
    '---',
    '',
    '# 마력 회계 시스템',
    '',
    '> 기능: 던전 운영 비용을 실시간으로 보여주는 회계 체계',
    '',
    '몬스터 소환, 함정 작동, 전리품 회수 비용을 계산한다.'
  ].join('\n'));
  return ensureStoryFoundation(ctx, { title: '던전 머니볼', episode: 'ep001', notes: '테스트 준비' });
}

describe('autopilot — 최소 입력·자동 중간 처리·최종 선택', () => {
  let ctx: Ctx;

  beforeEach(async () => {
    resetMemoryBridge();
    setAgentScript(scriptedAgent);
    const meta = await createProject(memoryBridge, '/vault', '메달리온의 계승', '토푸');
    ctx = { root: meta.root, bridge: memoryBridge, agent: AGENT };
  });

  it('runEpisodeAutopilot: 무입력 실행으로 설계+후보 1개, 원고는 건드리지 않는다', async () => {
    const before = await readOptional(ctx, episodePaths('ep001').manuscript);
    const blocked = await runEpisodeAutopilot(ctx, { episode: 'ep001' });
    expect(blocked.error).toContain('준비가 필요합니다');
    expect(blocked.candidates.length).toBe(0);

    await prepareFoundation(ctx);
    const r = await runEpisodeAutopilot(ctx, { episode: 'ep001' });

    expect(r.error).toBeUndefined();
    expect(r.candidates.length).toBe(1);
    expect(r.candidates.map((c) => c.label)).toEqual([...DEFAULT_CANDIDATE_LABELS]);
    // 후보가 하나여도 추천 id를 명시한다.
    const rec = r.candidates.find((c) => c.id === r.recommendedId);
    expect(rec?.label).toBe('집필안');

    // soft output 자동 승인 (autopilot 주체 기록)
    const brief = await loadBrief(ctx, 'ep001');
    const scene = await loadScenePlan(ctx, 'ep001');
    expect(brief?.bindery_approval?.status).toBe('approved');
    expect(brief?.bindery_approval?.approvedBy).toBe('autopilot');
    expect(scene?.bindery_approval?.approvedBy).toBe('autopilot');

    // hard commit 보호: 원고 파일은 그대로
    const after = await readOptional(ctx, episodePaths('ep001').manuscript);
    expect(after).toBe(before);
    // 후보는 파일로 남는다
    expect(await memoryBridge.exists(ctx.root, r.candidates[0].path)).toBe(true);
  });

  it('runEpisodeAutopilot: 추가 지시가 있으면 기존 회차 설계를 재사용하지 않고 모든 생성 프롬프트에 넣는다', async () => {
    await prepareFoundation(ctx);
    await runEpisodeAutopilot(ctx, { episode: 'ep001' });

    const instruction = '첫 장면은 설명이 아니라 실패한 공략 현장으로 시작한다.';
    const prompts: Record<string, string> = {};
    setAgentScript((prompt, label) => {
      for (const stage of ['episode-brief', 'scene-plan', 'draft-candidate']) {
        if (label.includes(stage) && !prompts[stage]) prompts[stage] = prompt;
      }
      return scriptedAgent(prompt, label);
    });

    const rerun = await runEpisodeAutopilot(ctx, { episode: 'ep001', userNote: instruction });

    expect(rerun.error).toBeUndefined();
    expect(Object.keys(prompts).sort()).toEqual(['draft-candidate', 'episode-brief', 'scene-plan']);
    for (const prompt of Object.values(prompts)) {
      expect(prompt).toContain('[사용자 추가 지시]');
      expect(prompt).toContain(instruction);
    }
  });

  it('workflow: 상태에 따라 next action이 이동한다', async () => {
    // 빈 프로젝트 → startProject
    let step = computeNextStep(await loadWorkflowSnapshot(ctx));
    expect(step.action).toBe('startProject');

    // 작품노트 자산은 있는데 바이블/플롯이 없으면 집필 전에 준비 CTA
    await memoryBridge.writeFile(ctx.root, 'characters/엘리고스.md', '# 엘리고스\n\n> 기능: 던전 마스터\n\n마력 회계로 악마성을 운영한다.');
    step = computeNextStep(await loadWorkflowSnapshot(ctx));
    expect(step.action).toBe('prepareStoryFoundation');

    await ensureStoryFoundation(ctx, { title: '던전 머니볼', episode: 'ep001' });
    step = computeNextStep(await loadWorkflowSnapshot(ctx));
    expect(step.action).toBe('writeNextEpisode');

    // 후보 생성 후 → applyCandidate
    const r = await runEpisodeAutopilot(ctx, { episode: 'ep001' });
    step = computeNextStep(await loadWorkflowSnapshot(ctx));
    expect(step.action).toBe('applyCandidate');

    // 후보 적용(사람의 확정) → reviseCurrentDraft
    await applyCandidateToManuscript(ctx, r.candidates[0]);
    step = computeNextStep(await loadWorkflowSnapshot(ctx));
    expect(step.action).toBe('reviseCurrentDraft');

    // 마감 준비(요약 존재) → closeEpisode
    const card = await runCloseEpisodeAutopilot(ctx, 'ep001');
    step = computeNextStep(await loadWorkflowSnapshot(ctx));
    expect(step.action).toBe('closeEpisode');

    // 마감 확정 → 다음 회차 writeNextEpisode
    await finalizeCloseEpisode(ctx, card, card.recommendedChecks);
    step = computeNextStep(await loadWorkflowSnapshot(ctx));
    expect(step.action).toBe('writeNextEpisode');
    expect(step.episode).toBe('ep002');
  });

  it('workflow: 바이블만 있으면 플롯 준비를 먼저 요구한다', async () => {
    await memoryBridge.writeFile(ctx.root, LAYOUT.canon.bible, [
      '# 설정 바이블 — 수동 입력',
      '',
      '## 전제',
      '수동으로 작성된 바이블이 충분히 길게 존재한다. 이 기준을 바탕으로 회차 플롯을 먼저 정리해야 한다.',
      '',
      '## 세계 규칙 (어기면 안 되는 것)',
      '- 핵심 설정은 플롯 전에 확정 기준으로 읽힌다.'
    ].join('\n'));
    const step = computeNextStep(await loadWorkflowSnapshot(ctx));
    expect(step.action).toBe('prepareStoryFoundation');
    expect(step.detail).toContain('ep001 플롯');
  });

  it('workflow: imported resume point can continue at ep015 instead of the blank ep001 scaffold', async () => {
    const startInstruction = '콜러 설명보다 팀이 실제로 엇갈리는 현장 장면을 먼저 보여준다.';
    const continuationPrompts: Record<string, string> = {};
    setAgentScript((prompt, label) => {
      for (const stage of ['plot-plan', 'episode-brief', 'scene-plan', 'draft-candidate']) {
        if (label.includes(stage) && !continuationPrompts[stage]) continuationPrompts[stage] = prompt;
      }
      return scriptedAgent(prompt, label);
    });
    await memoryBridge.writeFile(ctx.root, LAYOUT.canon.bible, [
      '# 메달리온 설정 바이블', '',
      '확정 설정과 인물 관계가 충분히 기록되어 있으며, 던전 진입 규칙과 구단 운영 원칙은 이후 회차에서도 변경하지 않는다.'
    ].join('\n'));
    await memoryBridge.writeFile(ctx.root, LAYOUT.plot.board, JSON.stringify({
      schema_version: 'bindery.plot_plan.v1',
      arcs: [{ id: 'arc1', label: '시즌 1', goal: '첫 공략', episodes: 'ep001-ep020' }],
      episodes: [{
        episode: 'ep015', arc: 'arc1', title: '콜러 공백', goal: '팀의 우선순위 충돌을 드러낸다',
        beats: ['복합 훈련', '지시 충돌'], threads_open: ['콜러 후보'], threads_close: [], hook: '새 후보 조사', risk: '', status: 'draft'
      }],
      source: 'agent', updatedAt: '2026-07-10T00:00:00Z'
    }, null, 2));
    await memoryBridge.writeFile(ctx.root, LAYOUT.status.resume, [
      '# Resume State v51',
      '',
      '## Next recommended episode',
      '',
      'Episode 15 should center on the caller gap.'
    ].join('\n'));
    const step = computeNextStep(await loadWorkflowSnapshot(ctx));
    expect(step.action).toBe('writeNextEpisode');
    expect(step.episode).toBe('ep015');

    const continued = await runEpisodeAutopilot(ctx, { episode: 'ep015', userNote: startInstruction, regeneratePlan: true });
    expect(continued.error).toBeUndefined();
    await ensureStoryFoundation(ctx, {
      title: '메달리온', episode: 'ep015', episodeCount: 20, forcePlot: true, startInstruction
    });
    for (const prompt of Object.values(continuationPrompts)) {
      expect(prompt).toContain('[사용자 추가 지시]');
      expect(prompt).toContain(startInstruction);
    }
    expect(Object.keys(continuationPrompts).sort()).toEqual(['draft-candidate', 'episode-brief', 'plot-plan', 'scene-plan']);
  });

  it('workflow: ep001 재작성은 ep015 활성 플롯을 이어 쓰지 않고 회차 설계부터 다시 만든다', async () => {
    const restartCtx: Ctx = { ...ctx };
    const startInstruction = '1화는 계약 설명보다 실패 공략 현장을 먼저 보여주고 코믹 톤을 줄인다.';
    let restartPlotPrompt = '';
    const restartEpisodePrompts: Record<string, string> = {};
    setAgentScript((prompt, label) => {
      if (label.includes('plot-plan')) {
        if (!restartPlotPrompt) restartPlotPrompt = prompt;
        return reply(JSON.stringify({
          schema_version: 'bindery.plot_plan.v1',
          arcs: [{ id: 'old', label: '잘못된 이어쓰기', goal: '15화 이후', episodes: 'ep015-ep022' }],
          episodes: [{
            episode: 'ep015', arc: 'old', title: '콜러 공백', goal: '기존 진행을 잇는다',
            beats: ['훈련 로그 분석'], threads_open: [], threads_close: [], hook: '콜러를 찾는다', risk: ''
          }]
        }));
      }
      for (const stage of ['episode-brief', 'scene-plan', 'draft-candidate']) {
        if (label.includes(stage) && !restartEpisodePrompts[stage]) restartEpisodePrompts[stage] = prompt;
      }
      return scriptedAgent(prompt, label);
    });
    await memoryBridge.writeFile(ctx.root, LAYOUT.canon.bible, [
      '# 메달리온 설정 바이블', '',
      '던전 산업과 구단 계약, 인물 관계, 마력 규칙을 확정 기준으로 유지한다. 기존 사건은 새 연재선에서 처음부터 다시 배치할 수 있다.'
    ].join('\n'));
    await memoryBridge.writeFile(ctx.root, LAYOUT.plot.board, JSON.stringify({
      schema_version: 'bindery.plot_plan.v1',
      arcs: [{ id: 'old', label: '기존 이어쓰기', goal: '15화 이후', episodes: 'ep015-ep022' }],
      episodes: [{
        episode: 'ep015', arc: 'old', title: '콜러 공백', goal: '기존 진행을 잇는다',
        beats: ['훈련 로그 분석'], threads_open: [], threads_close: [], hook: '콜러를 찾는다', risk: '', status: 'draft'
      }],
      source: 'agent', updatedAt: '2026-07-10T00:00:00Z'
    }, null, 2));
    await memoryBridge.writeFile(ctx.root, 'plot/imported-plot-bible.md', [
      '# 시즌 플롯', '### 1화: 성공한 공략', '창단의 원인이 되는 사건.', '### 20화: 첫 공식 공략', '시즌 전반의 도착점.'
    ].join('\n'));
    await memoryBridge.writeFile(ctx.root, LAYOUT.status.resume, [
      '# 재개 상태', '> planning_start_mode: restart', '- 다음 회차: ep001', '- 실제 원고는 ep001부터 새로 작성합니다.'
    ].join('\n'));

    const foundation = await ensureStoryFoundation(restartCtx, {
      title: '메달리온', episode: 'ep001', startInstruction
    });
    const replanned = await loadPlotPlan(restartCtx);
    expect(foundation.plotCreated).toBe(true);
    expect(foundation.plotEpisodes).toBe(20);
    expect(foundation.plotSource).toBe('fallback');
    expect(restartPlotPrompt).toContain('[ep001 재작성 모드]');
    expect(restartPlotPrompt).toContain('[원본 플롯 바이블]');
    expect(restartPlotPrompt).toContain('1화: 성공한 공략');
    expect(restartPlotPrompt).toContain('[사용자 추가 지시]');
    expect(restartPlotPrompt).toContain(startInstruction);
    expect(replanned?.episodes[0].episode).toBe('ep001');
    expect(replanned?.episodes.at(-1)?.episode).toBe('ep020');
    const snapshotIndex = JSON.parse(await readOptional(restartCtx, `${LAYOUT.bindery.snapshots}/index.json`)) as Array<{ targetPath: string }>;
    expect(snapshotIndex.some((snapshot) => snapshot.targetPath === LAYOUT.plot.board)).toBe(true);
    const runIndex = JSON.parse(await readOptional(restartCtx, `${LAYOUT.bindery.runs}/index.json`)) as Array<{ stage: string; repairUsed: boolean }>;
    expect(runIndex.find((run) => run.stage === 'plot-plan')?.repairUsed).toBe(true);

    const step = computeNextStep(await loadWorkflowSnapshot(restartCtx));
    expect(step.action).toBe('writeNextEpisode');
    expect(step.episode).toBe('ep001');

    const written = await runEpisodeAutopilot(restartCtx, { episode: 'ep001', userNote: startInstruction, regeneratePlan: true });
    expect(written.error).toBeUndefined();
    expect(await loadBrief(restartCtx, 'ep001')).not.toBeNull();
    expect(await loadScenePlan(restartCtx, 'ep001')).not.toBeNull();
    for (const prompt of Object.values(restartEpisodePrompts)) {
      expect(prompt).toContain('[사용자 추가 지시]');
      expect(prompt).toContain(startInstruction);
    }
    expect(Object.keys(restartEpisodePrompts).sort()).toEqual(['draft-candidate', 'episode-brief', 'scene-plan']);
  });

  it('workflow: 원고가 있어도 바이블이 없으면 준비를 먼저 요구한다', async () => {
    await memoryBridge.writeFile(ctx.root, episodePaths('ep001').manuscript, [
      '---',
      'episode: ep001',
      'status: drafting',
      '---',
      '',
      '# ep001',
      '',
      '이미 잘못 생성된 원고가 있더라도 기준 바이블이 비어 있으면 검토나 마감으로 넘어가지 않는다.'
    ].join('\n'));
    const step = computeNextStep(await loadWorkflowSnapshot(ctx));
    expect(step.action).toBe('prepareStoryFoundation');
  });

  it('runRevisionAutopilot: QA 3종 묶음 + 기본 체크된 수정 제안', async () => {
    await prepareFoundation(ctx);
    const r0 = await runEpisodeAutopilot(ctx, { episode: 'ep001' });
    await applyCandidateToManuscript(ctx, r0.candidates[0]);

    const r = await runRevisionAutopilot(ctx, { episode: 'ep001' });
    expect(r.error).toBeUndefined();
    expect(r.reports.map((x) => x.aspect).sort()).toEqual(['canon', 'continuity', 'style']);
    expect(r.plan?.items.length).toBeGreaterThan(0);
    expect(r.plan?.items.every((i) => i.accepted)).toBe(true);
  });

  it('runRevisionAutopilot: QA 3종을 실제로 병렬 실행한다', async () => {
    await prepareFoundation(ctx);
    const r0 = await runEpisodeAutopilot(ctx, { episode: 'ep001' });
    await applyCandidateToManuscript(ctx, r0.candidates[0]);

    let activeQa = 0;
    let maxActiveQa = 0;
    const parallelBridge: Bridge = {
      ...memoryBridge,
      async runAgentStream(root, prompt, label, settings, onEvent) {
        const isQa = label.includes('qa-');
        if (isQa) {
          activeQa++;
          maxActiveQa = Math.max(maxActiveQa, activeQa);
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        try {
          onEvent({ type: 'status', text: 'parallel test' });
          return await memoryBridge.runAgent(root, prompt, label, settings);
        } finally {
          if (isQa) activeQa--;
        }
      }
    };
    const result = await runRevisionAutopilot({ ...ctx, bridge: parallelBridge }, { episode: 'ep001' });
    expect(result.reports).toHaveLength(3);
    expect(maxActiveQa).toBe(3);
    const runIndex = JSON.parse(await readOptional(ctx, `${LAYOUT.bindery.runs}/index.json`)) as Array<{ stage: string }>;
    expect(runIndex.filter((run) => run.stage.startsWith('qa-'))).toHaveLength(3);
    const usage = JSON.parse(await readOptional(ctx, `${LAYOUT.bindery.root}/usage.json`)) as Array<{ stage: string }>;
    expect(usage.filter((entry) => entry.stage.startsWith('qa-'))).toHaveLength(3);
  });

  it('closeEpisode: 추천 체크는 high 리스크 제외, 체크 항목만 반영·나머지는 보류', async () => {
    await prepareFoundation(ctx);
    const r0 = await runEpisodeAutopilot(ctx, { episode: 'ep001' });
    await applyCandidateToManuscript(ctx, r0.candidates[0]);

    const card = await runCloseEpisodeAutopilot(ctx, 'ep001');
    expect(card.proposal).not.toBeNull();
    // medium → 체크, high → 해제
    expect(card.recommendedChecks).toEqual([true, false]);

    // 마감 전에는 canon 파일이 바뀌지 않았다 (hard commit 보호)
    expect(await memoryBridge.exists(ctx.root, 'characters/렌.md')).toBe(false);

    const result = await finalizeCloseEpisode(ctx, card, card.recommendedChecks);
    expect(result.appliedChanges).toBe(1);
    expect(result.heldChanges).toBe(1);

    // 체크 항목만 반영됨
    expect(await memoryBridge.exists(ctx.root, 'characters/렌.md')).toBe(true);
    expect((await readOptional(ctx, 'world/rules.md')).includes('규칙 변경')).toBe(false);
    // 해제 항목은 보류함(pending/partial)에 남는다
    const pending = (await loadProposals(ctx)).filter((p) => p.status === 'pending' || p.status === 'partial');
    expect(pending.length).toBe(1);

    // 픽스 완료 + 재개 상태 갱신
    const progress = await loadProgress(ctx);
    expect(progress['ep001']?.status).toBe('fixed');
    expect((await readOptional(ctx, LAYOUT.status.resume)).includes('ep002')).toBe(true);
  });

  it('오프라인: 후보는 정직한 뼈대 1개, 자동 확정 없음', async () => {
    setAgentScript(null);
    await prepareFoundation(ctx);
    const r = await runEpisodeAutopilot(ctx, { episode: 'ep001' });
    expect(r.candidates.length).toBe(1);
    expect(r.candidates[0].source).toBe('fallback');
    expect(r.recommendedId).toBeNull();
    const manuscript = await readOptional(ctx, episodePaths('ep001').manuscript);
    expect(manuscript.includes('오프라인 뼈대')).toBe(false);
  });

  it('기획 채택: 코드펜스 바이블을 적용하고 그 바이블로 플롯을 짠다', async () => {
    const starter = await runProjectStarterAutopilot(ctx, '던전 머니볼');
    const r = await adoptStarterIdea(ctx, starter.ideas[0], '던전 머니볼');

    expect(r.assets).toBe(2);
    expect(r.bibleSource).toBe('agent');
    const bible = await readOptional(ctx, LAYOUT.canon.bible);
    expect(bible).toContain('마력 회계 시스템');

    const plan = await loadPlotPlan(ctx);
    expect(plan?.episodes[0].title).toBe('회계 장부 위의 악마성');
  });

  it('기획 채택: AI 바이블 조립 실패 시에도 로컬 바이블을 적용해 플롯 입력이 비지 않는다', async () => {
    setAgentScript((prompt: string, label: string) => {
      if (label.includes('bible-assembly')) return reply('요약만 있고 제목 구조가 없어 파싱 실패');
      return scriptedAgent(prompt, label);
    });

    const starter = await runProjectStarterAutopilot(ctx, '던전 머니볼');
    const r = await adoptStarterIdea(ctx, starter.ideas[0], '던전 머니볼');

    expect(r.bibleSource).toBe('fallback');
    const bible = await readOptional(ctx, LAYOUT.canon.bible);
    expect(bible).toContain('로컬 조립본');
    expect(bible).toContain('마력 회계 시스템');

    const plan = await loadPlotPlan(ctx);
    expect(plan?.episodes[0].title).toBe('회계 장부 위의 악마성');
  });

  it('기획 채택: AI 전체 실패에도 채택 기획 기반 로컬 바이블을 먼저 적용한다', async () => {
    setAgentScript(null);
    const starter = await runProjectStarterAutopilot(ctx, '던전 운영 손익을 뒤집는 이야기');
    const r = await adoptStarterIdea(ctx, starter.ideas[0], '오프라인 던전');

    expect(r.assets).toBe(0);
    expect(r.bibleSource).toBe('fallback');
    const bible = await readOptional(ctx, LAYOUT.canon.bible);
    expect(bible).toContain('로컬 조립본');
    expect(bible).toContain('던전 운영 손익');
    expect((await loadPlotPlan(ctx))?.episodes.length).toBeGreaterThan(0);
  });
});
