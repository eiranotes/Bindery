// 완성물 내보내기 — 흩어진 회차 원고를 합본/TXT/EPUB/DOCX로 묶는다. (제품화 점검 §2.1)
//
// 원칙: 텍스트 산출물(합본 .md, .txt)은 브리지로 `exports/`에 저장한다.
// EPUB/DOCX는 zip(바이너리)이라 utf8 브리지로 저장하면 깨지므로, 여기서는 바이트 배열만
// 만들고 UI가 브라우저 다운로드로 내보낸다(브리지 계약 불변).
import { LAYOUT, episodePaths } from '$lib/core/layout';
import { parseFrontmatter } from '$lib/core/text';
import { listEpisodes, readOptional } from './project';
import type { Ctx } from './types';
import type { EpisodeProgress } from './closeout';

export type ExportChapter = {
  episode: string;
  title: string;
  body: string;
  chars: number;
  fixed: boolean;
};

const PLACEHOLDER_RE = /\(원고가 아직 없습니다[\s\S]*?\)/;

/** 원고 본문에서 제목(첫 h1)과 순수 본문을 분리한다. */
function splitTitleBody(episode: string, raw: string): { title: string; body: string } {
  const body = (parseFrontmatter(raw).body ?? raw).trim();
  const lines = body.split('\n');
  let title = episode;
  let rest = body;
  const h1 = lines.findIndex((l) => /^#\s+/.test(l));
  if (h1 !== -1) {
    title = lines[h1].replace(/^#\s+/, '').trim() || episode;
    rest = lines.slice(h1 + 1).join('\n').trim();
  }
  return { title, body: rest };
}

function hasManuscript(body: string): boolean {
  return body.replace(PLACEHOLDER_RE, '').replace(/^#.*$/gm, '').trim().length > 0;
}

export type CollectOptions = {
  /** true면 픽스된 회차만 (완결분 내보내기). false면 원고가 있는 모든 회차. */
  fixedOnly: boolean;
};

/** 회차 원고를 번호순으로 모은다. */
export async function collectChapters(
  ctx: Ctx,
  progress: EpisodeProgress,
  opts: CollectOptions
): Promise<ExportChapter[]> {
  const episodes = await listEpisodes(ctx);
  const chapters: ExportChapter[] = [];
  for (const episode of episodes) {
    const raw = await readOptional(ctx, episodePaths(episode).manuscript);
    const { title, body } = splitTitleBody(episode, raw);
    if (!hasManuscript(body)) continue;
    const fixed = progress[episode]?.status === 'fixed';
    if (opts.fixedOnly && !fixed) continue;
    chapters.push({ episode, title, body, chars: body.replace(/\s/g, '').length, fixed });
  }
  return chapters;
}

export type ExportMeta = { title: string; author: string };

export function buildMarkdown(meta: ExportMeta, chapters: ExportChapter[]): string {
  const parts = [
    `# ${meta.title}`,
    meta.author ? `\n${meta.author}\n` : '',
    `\n> 합본 · ${chapters.length}화 · 공백 제외 ${totalChars(chapters).toLocaleString()}자 · ${new Date().toISOString().slice(0, 10)}`,
    ''
  ];
  for (const c of chapters) {
    parts.push(`\n\n## ${c.title}`, '', c.body);
  }
  return parts.join('\n').trim() + '\n';
}

export function buildPlainText(meta: ExportMeta, chapters: ExportChapter[]): string {
  const parts = [meta.title, meta.author, ''];
  for (const c of chapters) {
    parts.push('', c.title, '', stripMarkdown(c.body), '');
  }
  return parts.filter((p) => p !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** 회차 1편을 플랫폼 붙여넣기용 순수 텍스트로 — 제목 + 본문. */
export function chapterPlainText(chapter: ExportChapter): string {
  return `${chapter.title}\n\n${stripMarkdown(chapter.body)}`.trim() + '\n';
}

function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^>\s?/gm, '');
}

export function totalChars(chapters: ExportChapter[]): number {
  return chapters.reduce((sum, c) => sum + c.chars, 0);
}

export function exportBaseName(meta: ExportMeta): string {
  return (meta.title || '작품').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim() || '작품';
}

/** 텍스트 산출물을 프로젝트 exports/ 폴더에 저장하고 상대 경로를 돌려준다. */
export async function saveTextExport(ctx: Ctx, fileName: string, content: string): Promise<string> {
  const path = `${LAYOUT.exports}/${fileName}`;
  await ctx.bridge.writeFile(ctx.root, path, content);
  return path;
}

// ---------------------------------------------------------------------------
// EPUB — 최소 유효 EPUB2를 store(무압축) zip으로 직접 만든다 (외부 의존성 없음).
// ---------------------------------------------------------------------------

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function chapterXhtml(title: string, body: string): string {
  const paras = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${xmlEscape(p).replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ko">
<head><meta charset="utf-8"/><title>${xmlEscape(title)}</title></head>
<body><h1>${xmlEscape(title)}</h1>
${paras}
</body></html>`;
}

/** 회차들을 EPUB2 바이트 배열로 만든다. UI가 Blob 다운로드로 내보낸다. */
export function buildEpub(meta: ExportMeta, chapters: ExportChapter[]): Uint8Array {
  const uid = `bindery-${Date.now()}`;
  const files: Array<{ path: string; content: string; compress: false }> = [];

  files.push({ path: 'mimetype', content: 'application/epub+zip', compress: false });
  files.push({
    path: 'META-INF/container.xml',
    content: `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
    compress: false
  });

  const manifestItems: string[] = [];
  const spineItems: string[] = [];
  const navPoints: string[] = [];
  chapters.forEach((c, i) => {
    const id = `ch${i + 1}`;
    const file = `${id}.xhtml`;
    files.push({ path: `OEBPS/${file}`, content: chapterXhtml(c.title, c.body), compress: false });
    manifestItems.push(`<item id="${id}" href="${file}" media-type="application/xhtml+xml"/>`);
    spineItems.push(`<itemref idref="${id}"/>`);
    navPoints.push(
      `<navPoint id="nav${i + 1}" playOrder="${i + 1}"><navLabel><text>${xmlEscape(c.title)}</text></navLabel><content src="${file}"/></navPoint>`
    );
  });

  files.push({
    path: 'OEBPS/content.opf',
    content: `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="2.0">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
<dc:title>${xmlEscape(meta.title)}</dc:title>
<dc:creator opf:role="aut">${xmlEscape(meta.author || 'Unknown')}</dc:creator>
<dc:language>ko</dc:language>
<dc:identifier id="bookid">${uid}</dc:identifier>
</metadata>
<manifest>
<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${manifestItems.join('\n')}
</manifest>
<spine toc="ncx">
${spineItems.join('\n')}
</spine>
</package>`,
    compress: false
  });

  files.push({
    path: 'OEBPS/toc.ncx',
    content: `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="${uid}"/></head>
<docTitle><text>${xmlEscape(meta.title)}</text></docTitle>
<navMap>
${navPoints.join('\n')}
</navMap>
</ncx>`,
    compress: false
  });

  return zipStore(files);
}

// ---------------------------------------------------------------------------
// DOCX — 최소 유효 Office Open XML 패키지. 바이너리 브리지 없이 다운로드 전용.
// ---------------------------------------------------------------------------

function docxTextRun(text: string): string {
  const lines = text.split('\n');
  return lines
    .map((line, index) => {
      const t = `<w:r><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r>`;
      return index === 0 ? t : `<w:r><w:br/></w:r>${t}`;
    })
    .join('');
}

function docxParagraph(text: string, style?: string): string {
  const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
  return `<w:p>${pPr}${docxTextRun(text)}</w:p>`;
}

function docxBody(meta: ExportMeta, chapters: ExportChapter[]): string {
  const parts = [
    docxParagraph(meta.title || '작품', 'Title'),
    meta.author ? docxParagraph(meta.author) : '',
    docxParagraph(`합본 · ${chapters.length}화 · 공백 제외 ${totalChars(chapters).toLocaleString()}자`)
  ];
  for (const c of chapters) {
    parts.push(docxParagraph(c.title, 'Heading1'));
    for (const para of stripMarkdown(c.body).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
      parts.push(docxParagraph(para));
    }
  }
  return parts.filter(Boolean).join('\n');
}

/** 회차들을 DOCX 바이트 배열로 만든다. UI가 Blob 다운로드로 내보낸다. */
export function buildDocx(meta: ExportMeta, chapters: ExportChapter[]): Uint8Array {
  const created = new Date().toISOString();
  const files: Array<{ path: string; content: string }> = [
    {
      path: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`
    },
    {
      path: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
    },
    {
      path: 'docProps/core.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${xmlEscape(meta.title)}</dc:title>
<dc:creator>${xmlEscape(meta.author || 'Bindery')}</dc:creator>
<cp:lastModifiedBy>Bindery</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified>
</cp:coreProperties>`
    },
    {
      path: 'docProps/app.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>Bindery</Application>
</Properties>`
    },
    {
      path: 'word/styles.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="360" w:after="160"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
</w:styles>`
    },
    {
      path: 'word/document.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${docxBody(meta, chapters)}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>
</w:body>
</w:document>`
    }
  ];
  return zipStore(files);
}

// --- store-only zip (무압축) + CRC32 -------------------------------------

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** store(무압축) 방식 zip. EPUB 요건상 mimetype이 첫 엔트리·무압축이어야 한다.
 *  프로젝트 백업 등 다른 zip 산출물도 이 빌더를 공유한다. */
export function zipStore(files: Array<{ path: string; content: string }>): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const u16 = (n: number) => new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
  const u32 = (n: number) =>
    new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]);

  for (const f of files) {
    const nameBytes = utf8(f.path);
    const data = utf8(f.content);
    const crc = crc32(data);
    const local = concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(nameBytes.length), u16(0), nameBytes, data
    ]);
    chunks.push(local);
    central.push(concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0),
      u32(offset), nameBytes
    ]));
    offset += local.length;
  }

  const centralBytes = concat(central);
  const end = concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralBytes.length), u32(offset), u16(0)
  ]);
  return concat([...chunks, centralBytes, end]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}
