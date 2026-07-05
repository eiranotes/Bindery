// 세계관 확장 — 채택 소재를 근거로 자산 proposal을 만든다. 확정은 사람이 한다.
import { BLUEPRINTS } from '$lib/prompts';
import { runStage } from './runner';
import { writeArtifact } from './artifacts';
import { readOptional } from './project';
import { LAYOUT } from '$lib/core/layout';
import { clip } from '$lib/core/text';
import { parseWorldExpansionProposal, type WorldExpansionProposal } from '$lib/schemas/contracts';
import { registerWorldExpansion, saveProposal, type WorldExpansionRecord } from './proposals';
import type { IdeaFile } from './ideas';
import type { Ctx, StageOutcome } from './types';

function localWorldFallback(seeds: IdeaFile[]): WorldExpansionProposal {
  const first = seeds[0];
  return {
    schema_version: 'bindery.world_expansion_proposal.v1',
    premise: first ? `${first.seed.title} — ${first.seed.hook}` : '(채택 소재 없음)',
    assets: [
      {
        kind: 'character',
        name: '(주인공 이름 미정)',
        one_line_function: first ? `독자 약속 「${first.seed.reader_promise}」을 매 회차 수행하는 시점 인물` : '시점 인물',
        detail_md: '## 상태\n- (오프라인 뼈대 — AI 연결 후 재실행하거나 직접 채우세요)\n\n## 욕망과 결핍\n- ',
        needed_by: 'ep001',
        risk: 'AI 미연결 상태의 뼈대 자산입니다.'
      }
    ],
    story_license_notes: ['오프라인 뼈대 proposal — 내용을 채우기 전에는 승인하지 마세요.']
  };
}

export function renderWorldProposalArtifact(p: WorldExpansionProposal): string {
  return [
    `# 세계관 확장 proposal`,
    '',
    `- 전제: ${p.premise || '(없음)'}`,
    '',
    '| 자산 | 종류 | 기능 | 필요 시점 | 리스크 |',
    '|---|---|---|---|---|',
    ...p.assets.map((a) => `| ${a.name} | ${a.kind} | ${a.one_line_function} | ${a.needed_by} | ${a.risk || '-'} |`),
    '',
    '## 열어둔 것 (story license)',
    ...(p.story_license_notes.length ? p.story_license_notes.map((n) => `- ${n}`) : ['- (없음)'])
  ].join('\n');
}

/** 세계관 확장 proposal 생성 + 레지스트리 등록. 파일 반영은 승인(applyProposal) 이후. */
export async function expandWorld(ctx: Ctx, selectedIdeas: IdeaFile[], notes: string): Promise<{ proposal: WorldExpansionRecord; outcome: StageOutcome<WorldExpansionProposal> }> {
  const selectedSeeds = selectedIdeas
    .map((i) => `### ${i.seed.title}\n- 훅: ${i.seed.hook}\n- 감정 엔진: ${i.seed.emotional_engine}\n- 독자 약속: ${i.seed.reader_promise}\n- 장기 잠재력: ${i.seed.longform_potential}`)
    .join('\n\n');
  const canonContext = [
    clip(await readOptional(ctx, LAYOUT.canon.bible), 4000),
    clip(await readOptional(ctx, LAYOUT.world.rules), 1500)
  ].filter(Boolean).join('\n\n');

  const outcome = await runStage(ctx, {
    stage: 'world-expansion',
    scope: 'work',
    blueprint: BLUEPRINTS.worldExpansion,
    vars: {
      selectedSeeds: selectedSeeds || '(채택된 소재 없음 — 보수적으로 최소 자산만 제안)',
      canonContext: canonContext || '(기존 확정 설정 없음)',
      notes: notes || '(없음)',
      assetCount: '8'
    },
    parse: parseWorldExpansionProposal,
    fallback: () => localWorldFallback(selectedIdeas),
    repairHint: '{"schema_version":"bindery.world_expansion_proposal.v1","premise":"...","assets":[{"kind":"character","name":"...","one_line_function":"...","detail_md":"...","needed_by":"ep001","risk":""}],"story_license_notes":["..."]}'
  });

  const proposal = registerWorldExpansion(outcome.output, outcome.source);
  await saveProposal(ctx, proposal);
  await writeArtifact(ctx, 'work', 'world-expansion', `세계관 확장 proposal · 자산 ${outcome.output.assets.length}건`, renderWorldProposalArtifact(outcome.output), outcome.source);
  return { proposal, outcome };
}
