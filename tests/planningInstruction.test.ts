import { beforeEach, describe, expect, it } from 'vitest';
import {
  formatPlanningInstruction,
  loadPlanningInstruction,
  PLANNING_INSTRUCTION_HEADER,
  PLANNING_INSTRUCTION_MAX_CHARS,
  PLANNING_INSTRUCTION_PATH,
  savePlanningInstruction
} from '../src/lib/harness/planningInstruction';
import { memoryBridge, resetMemoryBridge } from '../src/lib/bridge/memoryBridge';
import type { Ctx } from '../src/lib/harness/types';

const ctx: Ctx = {
  root: '/planning-prompt-test',
  bridge: memoryBridge,
  agent: { command: '', argsTemplate: ['{prompt}'], outputMode: 'stdout' }
};

describe('planning instruction prompt contract', () => {
  beforeEach(() => resetMemoryBridge());

  it('omits an empty instruction', () => {
    expect(formatPlanningInstruction('   ')).toBe('');
  });

  it('wraps a user instruction once with mandatory application rules', () => {
    const instruction = '1화는 실패한 공략 현장에서 시작한다.';
    const formatted = formatPlanningInstruction(instruction);

    expect(formatted).toContain(PLANNING_INSTRUCTION_HEADER);
    expect(formatted).toContain(instruction);
    expect(formatted).toContain('플롯, 회차 브리프, 장면 계획, 초안에서 반드시 반영한다.');
    expect(formatPlanningInstruction(formatted)).toBe(formatted);
  });

  it('limits raw instructions to the UI maximum before prompt insertion', () => {
    const formatted = formatPlanningInstruction('가'.repeat(PLANNING_INSTRUCTION_MAX_CHARS + 20));

    expect(formatted).toContain('가'.repeat(PLANNING_INSTRUCTION_MAX_CHARS));
    expect(formatted).not.toContain('가'.repeat(PLANNING_INSTRUCTION_MAX_CHARS + 1));
  });

  it('persists the exact authored prompt separately from rendered execution prompts', async () => {
    const instruction = '1화는 실패한 공략 현장에서 시작하고 설명은 뒤로 미룬다.';

    expect(await loadPlanningInstruction(ctx)).toBe('');
    expect(await savePlanningInstruction(ctx, `  ${instruction}  `)).toBe(instruction);
    expect(await memoryBridge.readFile(ctx.root, PLANNING_INSTRUCTION_PATH)).toBe(`${instruction}\n`);
    expect(await loadPlanningInstruction(ctx)).toBe(instruction);
  });

  it('applies the same length limit to the saved prompt', async () => {
    await savePlanningInstruction(ctx, '가'.repeat(PLANNING_INSTRUCTION_MAX_CHARS + 20));
    expect((await loadPlanningInstruction(ctx)).length).toBe(PLANNING_INSTRUCTION_MAX_CHARS);
  });
});
