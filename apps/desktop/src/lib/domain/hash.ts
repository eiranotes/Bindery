// 콘텐츠 해시 — 후보 baseline과 QA 대상 식별용. 암호학적 강도가 필요 없는
// 짧은 지문이므로 FNV-1a 32bit 두 개(정/역방향)를 이어 붙여 충돌 가능성을 낮춘다.
function fnv1a(text: string, reverse = false): number {
  let hash = 0x811c9dc5;
  const len = text.length;
  for (let i = 0; i < len; i++) {
    const code = text.charCodeAt(reverse ? len - 1 - i : i);
    hash ^= code;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function contentHash(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n');
  return `${fnv1a(normalized).toString(16).padStart(8, '0')}${fnv1a(normalized, true).toString(16).padStart(8, '0')}`;
}

/** UI 표시에 쓰는 짧은 해시 (앞 8자리). */
export function shortHash(text: string): string {
  return contentHash(text).slice(0, 8);
}
