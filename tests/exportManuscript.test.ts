// 내보내기 테스트 — 회차 수집, 합본/TXT 조립, EPUB zip 유효성.
import { describe, it, expect, beforeEach } from 'vitest';
import { memoryBridge, resetMemoryBridge } from '../src/lib/bridge/memoryBridge';
import {
  buildDocx, buildEpub, buildMarkdown, buildPlainText, chapterPlainText, collectChapters,
  exportBaseName, saveTextExport, type ExportChapter
} from '../src/lib/harness/exportManuscript';
import { episodePaths, LAYOUT } from '../src/lib/core/layout';
import type { Ctx } from '../src/lib/harness/types';
import type { EpisodeProgress } from '../src/lib/harness/closeout';

const ROOT = '/vault/내보내기작품';
const AGENT = { command: '', argsTemplate: ['{prompt}'], outputMode: 'stdout' as const };
const ctx: Ctx = { root: ROOT, bridge: memoryBridge, agent: AGENT };

async function seedEpisode(ep: string, title: string, body: string): Promise<void> {
  await memoryBridge.writeFile(ROOT, episodePaths(ep).manuscript, `---\nepisode: ${ep}\n---\n\n# ${title}\n\n${body}`);
}

beforeEach(async () => {
  resetMemoryBridge();
  await seedEpisode('ep001', '1화 서장', '비가 내렸다.\n\n미도리는 걸었다.');
  await seedEpisode('ep002', '2화 대립', '"들어와도 돼."\n\n점장이 말했다.');
  // 원고 없는 회차(플레이스홀더) — 제외돼야 한다.
  await memoryBridge.writeFile(ROOT, episodePaths('ep003').manuscript, '# ep003\n\n(원고가 아직 없습니다. 초안 후보를 생성하세요.)');
});

const progress: EpisodeProgress = { ep001: { status: 'fixed' }, ep002: { status: 'drafting' } } as EpisodeProgress;

describe('회차 수집', () => {
  it('원고 있는 회차만, 번호순으로 모은다', async () => {
    const chapters = await collectChapters(ctx, progress, { fixedOnly: false });
    expect(chapters.map((c) => c.episode)).toEqual(['ep001', 'ep002']);
    expect(chapters[0].title).toBe('1화 서장');
    expect(chapters[0].body).not.toContain('#');
    expect(chapters[0].fixed).toBe(true);
    expect(chapters[1].fixed).toBe(false);
  });

  it('fixedOnly면 픽스된 회차만', async () => {
    const chapters = await collectChapters(ctx, progress, { fixedOnly: true });
    expect(chapters.map((c) => c.episode)).toEqual(['ep001']);
  });
});

describe('텍스트 산출물', () => {
  const chapters: ExportChapter[] = [
    { episode: 'ep001', title: '1화', body: '**굵게** 그리고 `코드`.', chars: 6, fixed: true },
    { episode: 'ep002', title: '2화', body: '두 번째 장.', chars: 5, fixed: false }
  ];
  const meta = { title: '테스트작', author: '토푸' };

  it('Markdown 합본은 제목·회차 헤딩을 포함한다', () => {
    const md = buildMarkdown(meta, chapters);
    expect(md).toContain('# 테스트작');
    expect(md).toContain('## 1화');
    expect(md).toContain('## 2화');
  });

  it('TXT는 마크다운 기호를 제거한다', () => {
    const txt = buildPlainText(meta, chapters);
    expect(txt).toContain('굵게');
    expect(txt).not.toContain('**');
    expect(txt).not.toContain('`');
  });

  it('회차 복사는 제목+본문 순수 텍스트', () => {
    expect(chapterPlainText(chapters[0])).toContain('1화');
    expect(chapterPlainText(chapters[0])).not.toContain('**');
  });

  it('파일명은 금지문자를 정리한다', () => {
    expect(exportBaseName({ title: 'a/b:c', author: '' })).toBe('a b c');
  });

  it('합본을 exports/에 저장한다', async () => {
    const path = await saveTextExport(ctx, '합본.md', '내용');
    expect(path).toBe(`${LAYOUT.exports}/합본.md`);
    expect(await memoryBridge.readFile(ROOT, path)).toBe('내용');
  });
});

describe('EPUB zip', () => {
  it('유효한 zip 시그니처와 EPUB 필수 파일을 담는다', () => {
    const bytes = buildEpub({ title: '북', author: '저자' }, [
      { episode: 'ep001', title: '1화', body: '문단 하나.\n\n문단 둘.', chars: 8, fixed: true }
    ]);
    // zip local file header 시그니처 PK\x03\x04
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
    // EPUB은 첫 엔트리가 mimetype이어야 한다.
    const head = new TextDecoder().decode(bytes.slice(0, 200));
    expect(head).toContain('mimetype');
    expect(head).toContain('application/epub+zip');
    // 끝에 central directory end 시그니처 PK\x05\x06
    const tail = bytes.slice(-22);
    expect(tail[0]).toBe(0x50);
    expect(tail[1]).toBe(0x4b);
    expect(tail[2]).toBe(0x05);
    expect(tail[3]).toBe(0x06);
    // 본문/opf/ncx가 전체 바이트 안에 들어 있다.
    const all = new TextDecoder().decode(bytes);
    expect(all).toContain('content.opf');
    expect(all).toContain('toc.ncx');
    expect(all).toContain('ch1.xhtml');
  });
});

describe('DOCX zip', () => {
  it('유효한 zip 시그니처와 DOCX 필수 파일을 담고 XML escape를 적용한다', () => {
    const bytes = buildDocx({ title: '북 & 테스트', author: '저자' }, [
      { episode: 'ep001', title: '1화 <서장>', body: '문단 하나 & 둘.\n\n**강조** `표식`.', chars: 12, fixed: true }
    ]);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
    const all = new TextDecoder().decode(bytes);
    expect(all).toContain('[Content_Types].xml');
    expect(all).toContain('word/document.xml');
    expect(all).toContain('word/styles.xml');
    expect(all).toContain('docProps/core.xml');
    expect(all).toContain('북 &amp; 테스트');
    expect(all).toContain('1화 &lt;서장&gt;');
    expect(all).toContain('문단 하나 &amp; 둘.');
    expect(all).toContain('강조 표식.');
  });
});
