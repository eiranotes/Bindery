import assert from 'node:assert/strict';
import {
  buildPromptCapsule,
  buildStyleSkillPackFiles,
  classifyScene,
  mergeStyleStack,
  resolveActiveStyleStack,
  scoreStyleMatch
} from '../apps/desktop/src/lib/domain/styleSystem.ts';

const text = '“선생님, 이 자료를 믿어도 됩니까?”\n“아직은요. 그래도 당신 말은 확인하겠습니다.”\n그 호칭은 조금 가까워져 있었다.';
const cls = classifyScene(text, { scene_id: 'S001', chapter_id: 'CH001' });
assert.equal(cls.primary_type, 'DIA');
assert.equal(cls.style_register, 'dialogue');
assert.ok(cls.secondary_types.includes('REL'));

const router = {
  router_id: 'router_test',
  default_stack_id: 'stack_default',
  rules: [
    { rule_id: 'dialogue', target_type: 'dialogue', target_value: '*', stack_id: 'stack_dialogue', priority: 1, enabled: true, compatible_registers: ['dialogue'] },
    { rule_id: 'char', target_type: 'character_dialogue', target_value: 'eira', stack_id: 'stack_eira', priority: 1, enabled: true }
  ]
};
const active = resolveActiveStyleStack({ scene_id: 'S001', classification: cls, character_id: 'eira', dialogue_speakers: ['eira'] }, router);
assert.equal(active.primary_stack_id, 'stack_eira');
assert.deepEqual(active.overlay_stack_ids, ['stack_dialogue']);

const preset = {
  preset_id: 'preset_base',
  name: 'base',
  preset_type: 'mixed',
  default_strength: 0.75,
  allowed_scopes: ['project', 'dialogue'],
  style_axes: {},
  register_availability: { dialogue: true },
  compact_instruction: 'base',
  global_rules: [{ rule_id: 'g1', instruction: '감정 해설보다 관찰과 판단을 먼저 둔다.' }],
  register_rules: { dialogue: [{ rule_id: 'd1', instruction: '질문과 답변은 짧게 유지한다.' }] },
  overlay_rules: { REL: [{ rule_id: 'rel1', instruction: '말의 내용보다 거리 변화가 보이게 한다.' }] },
  character_rules: { eira: [{ rule_id: 'c1', instruction: '에이라는 확인형 반응을 우선한다.' }] },
  negative_rules: ['설정 설명을 대사로 몰아넣지 않는다.'],
  fewshot_refs: ['fs1', 'fs2', 'fs3']
};
const stack = {
  stack_id: 'stack_eira',
  name: 'stack',
  adapters: [{ preset_id: 'preset_base', role: 'base', weight: 0.8, scope: 'global' }],
  presets: [preset],
  conflict_policy: 'scope_priority',
  normalization: 'weighted_average',
  max_active_rules: 4,
  fewshot_refs: ['fs_stack']
};
const merged = mergeStyleStack(stack, cls, 'eira');
assert.ok(merged.global_rules.length > 0);
assert.ok(merged.register_rules.length > 0);
assert.ok(merged.overlay_rules.length > 0);
assert.ok(merged.character_rules.length > 0);

const capsule = buildPromptCapsule({ scene_id: 'S001', scene_classification: cls, focus_character: 'eira', stacks: [stack] }, { primary_stack_id: 'stack_eira', overlay_stack_ids: [], matched_rules: [], routing_reason: 'test' }, 4);
assert.ok(capsule.negative_rules.length > 0);
assert.ok(capsule.fewshot_refs.length <= 2);

const report = scoreStyleMatch(text, stack, cls);
assert.ok(report.total_score >= 0 && report.total_score <= 1);

const files = buildStyleSkillPackFiles('proj', [preset], [stack], router);
assert.ok(files.some((f) => f.path === 'SKILL.md'));
assert.ok(files.some((f) => f.path === 'references/scene-classification.md'));
console.log('styleSystem TS smoke tests ok');
