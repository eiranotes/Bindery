export type SourceDocumentText = {
  text: string;
  fileName: string;
};

type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
};

const UTF8 = new TextDecoder('utf-8');

function u16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function findEndOfCentralDirectory(view: DataView): number {
  const min = Math.max(0, view.byteLength - 65558);
  for (let offset = view.byteLength - 22; offset >= min; offset -= 1) {
    if (u32(view, offset) === 0x06054b50) return offset;
  }
  throw new Error('DOCX 압축 구조를 읽을 수 없습니다.');
}

function readZipEntries(buffer: ArrayBuffer): ZipEntry[] {
  const view = new DataView(buffer);
  const eocd = findEndOfCentralDirectory(view);
  const entryCount = u16(view, eocd + 10);
  const centralOffset = u32(view, eocd + 16);
  const entries: ZipEntry[] = [];
  let offset = centralOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (u32(view, offset) !== 0x02014b50) throw new Error('DOCX 중앙 디렉터리가 손상되었습니다.');
    const method = u16(view, offset + 10);
    const compressedSize = u32(view, offset + 20);
    const nameLength = u16(view, offset + 28);
    const extraLength = u16(view, offset + 30);
    const commentLength = u16(view, offset + 32);
    const localHeaderOffset = u32(view, offset + 42);
    const name = UTF8.decode(new Uint8Array(buffer, offset + 46, nameLength));
    entries.push({ name, method, compressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflateEntry(buffer: ArrayBuffer, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(buffer);
  const offset = entry.localHeaderOffset;
  if (u32(view, offset) !== 0x04034b50) throw new Error('DOCX 파일 항목을 읽을 수 없습니다.');
  const nameLength = u16(view, offset + 26);
  const extraLength = u16(view, offset + 28);
  const dataStart = offset + 30 + nameLength + extraLength;
  const data = new Uint8Array(buffer, dataStart, entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method !== 8) throw new Error('지원하지 않는 DOCX 압축 방식입니다.');
  if (!('DecompressionStream' in globalThis)) {
    throw new Error('이 런타임은 DOCX 압축 해제를 지원하지 않습니다.');
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function textFromParagraph(block: string): string {
  const parts: string[] = [];
  const token = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>/g;
  let match: RegExpExecArray | null;
  while ((match = token.exec(block))) {
    if (match[1] != null) parts.push(decodeXml(match[1]));
    else if (match[0].startsWith('<w:tab')) parts.push('\t');
    else parts.push('\n');
  }
  return parts.join('').trim();
}

function paragraphStyle(block: string): string {
  return block.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/)?.[1] ?? '';
}

function textFromDocumentXml(xml: string): string {
  return xml
    .split(/<\/w:p>/)
    .map((block) => {
      const text = textFromParagraph(block);
      if (!text) return '';
      const style = paragraphStyle(block);
      return /^Heading[1-6]$/i.test(style) ? `# ${text}` : text;
    })
    .filter(Boolean)
    .join('\n\n');
}

export async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const entries = readZipEntries(buffer);
  const documentEntry = entries.find((entry) => entry.name === 'word/document.xml');
  if (!documentEntry) throw new Error('DOCX 본문(word/document.xml)을 찾지 못했습니다.');
  const documentXml = UTF8.decode(await inflateEntry(buffer, documentEntry));
  const text = textFromDocumentXml(documentXml);
  if (!text.trim()) throw new Error('DOCX에서 추출할 본문이 없습니다.');
  return text;
}

export async function extractSourceDocumentText(file: File): Promise<SourceDocumentText> {
  const lower = file.name.toLowerCase();
  if (/\.(md|markdown|txt|text)$/.test(lower)) {
    return { fileName: file.name, text: await file.text() };
  }
  if (lower.endsWith('.docx')) {
    return { fileName: file.name, text: await extractDocxText(await file.arrayBuffer()) };
  }
  throw new Error('지원 형식: Markdown, TXT, DOCX');
}
