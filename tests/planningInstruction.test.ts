import { describe, expect, it } from 'vitest';
import {
  formatPlanningInstruction,
  PLANNING_INSTRUCTION_HEADER,
  PLANNING_INSTRUCTION_MAX_CHARS
} from '../src/lib/harness/planningInstruction';

describe('planning instruction prompt contract', () => {
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
});
