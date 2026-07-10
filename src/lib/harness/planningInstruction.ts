// 작품 시작·이어쓰기에서 받은 짧은 작가 지시를 모든 기획 프롬프트에 같은 계약으로 넣는다.
// 호출부가 이미 포맷된 값을 다시 넘겨도 중복 래핑하지 않는다.
export const PLANNING_INSTRUCTION_HEADER = '[사용자 추가 지시]';
export const PLANNING_INSTRUCTION_MAX_CHARS = 500;

export function formatPlanningInstruction(input: string | undefined): string {
  const raw = input?.trim() ?? '';
  if (!raw) return '';
  if (raw.startsWith(PLANNING_INSTRUCTION_HEADER)) return raw;
  const instruction = raw.slice(0, PLANNING_INSTRUCTION_MAX_CHARS);
  return [
    PLANNING_INSTRUCTION_HEADER,
    instruction,
    '',
    '[적용 규칙]',
    '- 선택한 시작 방식의 플롯, 회차 브리프, 장면 계획, 초안에서 반드시 반영한다.',
    '- 확정 바이블과 충돌하면 바이블을 독단으로 바꾸지 말고 risk에 충돌을 명시한다.'
  ].join('\n');
}
