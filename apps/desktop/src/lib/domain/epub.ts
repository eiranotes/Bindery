// 의존성 없는 EPUB3 생성기.
// EPUB은 ZIP 컨테이너이며, 규격상 무압축(STORED) 엔트리를 허용한다.
// mimetype 파일은 반드시 첫 엔트리 + 무압축이어야 하므로 STORED 방식이 오히려 안전하다.

const enc = new TextEncoder();

// ---- CRC32 -----------------------------------------------------------------
let CRC_TABLE: Uint32Array | null = null;
function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  CRC_TABLE = t;
  return t;
}
function crc32(data: Uint8Array): number {
  const t = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = t[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---- STORED ZIP ------------------------------------------------------------
type ZipEntry = { name: string; data: Uint8Array };

function u16(v: number): number[] { return [v & 0xff, (v >> 8) & 0xff]; }
function u32(v: number): number[] { return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]; }

export function storedZip(files: ZipEntry[]): Uint8Array {
  const chunks: number[] = [];
  const central: number[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const header = [
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0),
      ...u16(dosTime), ...u16(dosDate),
      ...u32(crc), ...u32(f.data.length), ...u32(f.data.length),
      ...u16(name.length), ...u16(0)
    ];
    central.push(
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0),
      ...u16(dosTime), ...u16(dosDate),
      ...u32(crc), ...u32(f.data.length), ...u32(f.data.length),
      ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset),
      ...name
    );
    chunks.push(...header, ...name, ...f.data);
    offset += header.length + name.length + f.data.length;
  }

  const centralOffset = offset;
  chunks.push(...central);
  chunks.push(
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(files.length), ...u16(files.length),
    ...u32(central.length), ...u32(centralOffset), ...u16(0)
  );
  return new Uint8Array(chunks);
}

// ---- EPUB ------------------------------------------------------------------
export type EpubChapter = { id: string; title: string; paragraphs: string[] };

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function chapterXhtml(ch: EpubChapter): string {
  const body = ch.paragraphs
    .map((p) => (p.startsWith('#') ? `<h3>${esc(p.replace(/^#+\s*/, ''))}</h3>` : `<p>${esc(p).replace(/\n/g, '<br />')}</p>`))
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ko" lang="ko">
<head><title>${esc(ch.title)}</title><link rel="stylesheet" type="text/css" href="style.css" /></head>
<body><section><h2>${esc(ch.title)}</h2>
${body}
</section></body>
</html>`;
}

export function buildEpub(title: string, author: string, chapters: EpubChapter[]): Uint8Array {
  const uid = `bindery-${Date.now()}`;
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

  const containerXml = `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;

  const manifestItems = chapters
    .map((c, i) => `<item id="ch${i + 1}" href="ch${i + 1}.xhtml" media-type="application/xhtml+xml"/>`)
    .join('\n    ');
  const spineItems = chapters.map((_, i) => `<itemref idref="ch${i + 1}"/>`).join('\n    ');

  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="ko">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">${uid}</dc:identifier>
    <dc:title>${esc(title)}</dc:title>
    <dc:language>ko</dc:language>
    ${author ? `<dc:creator>${esc(author)}</dc:creator>` : ''}
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="style.css" media-type="text/css"/>
    ${manifestItems}
  </manifest>
  <spine>
    ${spineItems}
  </spine>
</package>`;

  const navItems = chapters.map((c, i) => `<li><a href="ch${i + 1}.xhtml">${esc(c.title)}</a></li>`).join('\n      ');
  const nav = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="ko" lang="ko">
<head><title>목차</title></head>
<body>
  <nav epub:type="toc"><h1>목차</h1>
    <ol>
      ${navItems}
    </ol>
  </nav>
</body>
</html>`;

  const css = `body { font-family: serif; line-height: 1.9; } h2 { margin: 1.6em 0 1em; } p { margin: 0 0 0.9em; text-indent: 1em; }`;

  const files: ZipEntry[] = [
    { name: 'mimetype', data: enc.encode('application/epub+zip') },
    { name: 'META-INF/container.xml', data: enc.encode(containerXml) },
    { name: 'OEBPS/content.opf', data: enc.encode(opf) },
    { name: 'OEBPS/nav.xhtml', data: enc.encode(nav) },
    { name: 'OEBPS/style.css', data: enc.encode(css) },
    ...chapters.map((c, i) => ({ name: `OEBPS/ch${i + 1}.xhtml`, data: enc.encode(chapterXhtml(c)) }))
  ];
  return storedZip(files);
}

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}
