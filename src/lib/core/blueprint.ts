// 프롬프트 blueprint — prompts/*.prompt.md 파일이 원본이다 (Prompt transparency 원칙).
// {{변수}} 치환만 지원하는 의도적으로 단순한 템플릿.
// 조건/반복이 필요하면 호출부에서 문자열을 만들어 변수로 넘긴다.

export type Blueprint = {
  id: string;
  /** 저장소 내 원본 파일 경로 (UI에 출처로 표시) */
  file: string;
  template: string;
};

export function renderBlueprint(bp: Blueprint, vars: Record<string, string>): string {
  const rendered = bp.template.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => {
    if (key in vars) return vars[key];
    return whole; // 미지정 변수는 그대로 남겨 검토 시 눈에 띄게 한다
  });
  return `<!-- blueprint: ${bp.file} -->\n${rendered}`;
}
