// 작품 시작·이어쓰기에서 받은 짧은 작가 지시를 모든 기획 프롬프트에 같은 계약으로 넣는다.
// 호출부가 이미 포맷된 값을 다시 넘겨도 중복 래핑하지 않는다.
import { LAYOUT } from '$lib/core/layout';
import type { Ctx } from './types';

export const PLANNING_INSTRUCTION_HEADER = '[사용자 추가 지시]';
export const PLANNING_INSTRUCTION_MAX_CHARS = 500;
export const PLANNING_INSTRUCTION_PATH = LAYOUT.bindery.planningPrompt;

export function normalizePlanningInstruction(input: string | undefined): string {
  return (input ?? '').trim().slice(0, PLANNING_INSTRUCTION_MAX_CHARS);
}

/** 사용자가 직접 쓴 작품 시작 프롬프트. 실행 trace와 분리해 프로젝트에 보존한다. */
export async function savePlanningInstruction(ctx: Ctx, input: string | undefined): Promise<string> {
  const instruction = normalizePlanningInstruction(input);
  await ctx.bridge.writeFile(ctx.root, PLANNING_INSTRUCTION_PATH, instruction ? `${instruction}\n` : '');
  return instruction;
}

export async function loadPlanningInstruction(ctx: Ctx): Promise<string> {
  try {
    return normalizePlanningInstruction(await ctx.bridge.readFile(ctx.root, PLANNING_INSTRUCTION_PATH));
  } catch {
    return '';
  }
}

export function formatPlanningInstruction(input: string | undefined): string {
  const raw = input?.trim() ?? '';
  if (!raw) return '';
  if (raw.startsWith(PLANNING_INSTRUCTION_HEADER)) return raw;
  const instruction = normalizePlanningInstruction(raw);
  return [
    PLANNING_INSTRUCTION_HEADER,
    instruction,
    '',
    '[적용 규칙]',
    '- 선택한 시작 방식의 플롯, 회차 브리프, 장면 계획, 초안에서 반드시 반영한다.',
    '- 확정 바이블과 충돌하면 바이블을 독단으로 바꾸지 말고 risk에 충돌을 명시한다.'
  ].join('\n');
}
