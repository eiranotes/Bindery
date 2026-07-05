// 텍스트/마크다운 공통 유틸 — 순수 함수만.

/** frontmatter 파싱 (단순 key: value / key: [a, b] / 리스트 지원) */
export type Frontmatter = { present: boolean; data: Record<string, string | string[]>; body: string };

export function parseFrontmatter(content: string): Frontmatter {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);
  if (!m) return { present: false, data: {}, body: content };
  const data: Record<string, string | string[]> = {};
  let currentKey: string | null = null;
  for (const line of m[1].split(/\r?\n/)) {
    const item = /^\s+-\s*(.+)$/.exec(line);
    if (item && currentKey) {
      const arr = Array.isArray(data[currentKey]) ? (data[currentKey] as string[]) : [];
      arr.push(item[1].trim());
      data[currentKey] = arr;
      continue;
    }
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    currentKey = kv[1];
    const value = kv[2].trim();
    if (!value) {
      data[currentKey] = [];
    } else if (value.startsWith('[') && value.endsWith(']')) {
      data[currentKey] = value.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else {
      data[currentKey] = value.replace(/^["']|["']$/g, '');
    }
  }
  return { present: true, data, body: content.slice(m[0].length) };
}

export function renderFrontmatter(data: Record<string, string | string[] | number | boolean | undefined>): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${item}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push('---', '');
  return lines.join('\n');
}

/** AI 출력에서 JSON object 하나를 관대하게 추출한다 (그대로 / fenced / 중괄호 범위). */
export function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    /* 계속 */
  }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      /* 계속 */
    }
  }
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      return null;
    }
  }
  return null;
}

export function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function safeStringArray(value: unknown, max = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean).slice(0, max);
}

/** 비암호학적 content hash (fnv-1a) — baseline/변경 감지 표시용. */
export function contentHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function stamp(): string {
  return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
}

export function slugify(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|#%{}$!'@`=+~^;,.]/g, '').replace(/\s+/g, '-');
  return cleaned.slice(0, 60) || 'untitled';
}

export function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max)}\n...(잘림: 전체는 파일 참조)` : t;
}

/** 긴 원고를 앞/중간/끝 발췌로 줄인다. 발췌라는 사실을 프롬프트에 명시한다. */
export function excerptWindow(body: string, maxChars = 14000): string {
  const text = body.trim();
  if (text.length <= maxChars) return text;
  const front = Math.floor(maxChars * 0.4);
  const tail = Math.floor(maxChars * 0.4);
  const mid = maxChars - front - tail - 200;
  const midStart = Math.floor((text.length - mid) / 2);
  return [
    `<!-- 원고 ${text.length.toLocaleString()}자 중 앞/중간/끝 발췌. 발췌 밖 내용은 단정하지 말 것. -->`,
    '### 앞부분', text.slice(0, front),
    '### 중간', text.slice(midStart, midStart + mid),
    '### 끝부분', text.slice(text.length - tail)
  ].join('\n\n');
}
