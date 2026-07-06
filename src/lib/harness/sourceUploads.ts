import { slugify } from '$lib/core/text';

export type SourceUpload = {
  id: string;
  name: string;
  size: number;
  chars: number;
  content: string;
  truncated: boolean;
};

export type SourceUploadSkip = {
  name: string;
  reason: 'unsupported' | 'read-error' | 'zip-error' | 'zip-entry-unsupported';
};

export type SourceUploadReadResult = {
  uploads: SourceUpload[];
  skipped: SourceUploadSkip[];
  zipFiles: number;
  zipEntries: number;
};

export type SourceReadableFile = {
  name: string;
  size: number;
  type?: string;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export const SOURCE_FILE_MAX_CHARS = 120_000;
export const SOURCE_FILE_ACCEPT =
  '.txt,.md,.markdown,.json,.yaml,.yml,.csv,.tsv,.log,.rtf,.xml,.html,.zip';

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.yaml',
  '.yml',
  '.csv',
  '.tsv',
  '.log',
  '.rtf',
  '.xml',
  '.html'
]);

const TEXT_MIME_TYPES = new Set([
  'application/json',
  'application/x-yaml',
  'application/yaml',
  'text/yaml',
  'text/csv',
  'text/tab-separated-values'
]);

const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY = 0x02014b50;
const ZIP_END_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP_STORED = 0;
const ZIP_DEFLATED = 8;

type ZipTextEntry = {
  name: string;
  size: number;
  text: string;
};

function uploadId(name: string): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${slugify(name)}`;
}

export function formatSourceBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function extensionOf(name: string): string {
  const clean = name.split('?')[0]?.split('#')[0] ?? name;
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot).toLowerCase() : '';
}

function isTextSourceName(name: string, mimeType = ''): boolean {
  const type = mimeType.toLowerCase();
  return TEXT_EXTENSIONS.has(extensionOf(name)) || type.startsWith('text/') || TEXT_MIME_TYPES.has(type);
}

function isZipSource(file: SourceReadableFile): boolean {
  const type = (file.type ?? '').toLowerCase();
  return extensionOf(file.name) === '.zip' || type.includes('zip');
}

function normalizeSourceText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function makeSourceUpload(name: string, size: number, rawText: string): SourceUpload {
  const raw = normalizeSourceText(rawText);
  const content = raw.slice(0, SOURCE_FILE_MAX_CHARS);
  return {
    id: uploadId(name),
    name: name || 'untitled.txt',
    size,
    chars: content.length,
    content,
    truncated: raw.length > SOURCE_FILE_MAX_CHARS
  };
}

function readUint16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readUint32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function findEndOfCentralDirectory(view: DataView): number {
  const min = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= min; offset--) {
    if (readUint32(view, offset) === ZIP_END_CENTRAL_DIRECTORY) return offset;
  }
  return -1;
}

function decodeZipName(bytes: Uint8Array, flags: number): string {
  const utf8 = (flags & 0x0800) !== 0;
  const label = utf8 ? 'utf-8' : 'utf-8';
  return new TextDecoder(label, { fatal: false }).decode(bytes);
}

function normalizeZipEntryName(name: string): string | null {
  const cleaned = name.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!cleaned || cleaned.endsWith('/')) return null;
  const parts = cleaned.split('/').filter(Boolean);
  if (!parts.length || parts.some((part) => part === '..')) return null;
  if (parts[0] === '__MACOSX') return null;
  const base = parts[parts.length - 1] ?? '';
  if (base === '.DS_Store' || base.startsWith('._')) return null;
  return parts.join('/');
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function inflateRawZipPayload(payload: Uint8Array): Promise<Uint8Array> {
  const StreamCtor = (globalThis as unknown as {
    DecompressionStream?: new (format: string) => DecompressionStream;
  }).DecompressionStream;

  if (!StreamCtor) {
    throw new Error('DecompressionStream is not available');
  }

  const stream = new Blob([toArrayBuffer(payload)]).stream().pipeThrough(new StreamCtor('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decodeZipPayload(payload: Uint8Array, method: number): Promise<Uint8Array> {
  if (method === ZIP_STORED) return payload;
  if (method === ZIP_DEFLATED) return inflateRawZipPayload(payload);
  throw new Error(`Unsupported ZIP compression method: ${method}`);
}

async function readZipTextEntries(file: SourceReadableFile): Promise<{
  entries: ZipTextEntry[];
  skipped: SourceUploadSkip[];
}> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view);
  if (eocd < 0) throw new Error('ZIP central directory not found');

  const entryCount = readUint16(view, eocd + 10);
  const directoryOffset = readUint32(view, eocd + 16);
  const directorySize = readUint32(view, eocd + 12);
  const directoryEnd = directoryOffset + directorySize;
  if (entryCount === 0xffff || directoryOffset + 46 > bytes.length || directoryEnd > bytes.length) {
    throw new Error('ZIP64 or corrupt ZIP is not supported');
  }

  const entries: ZipTextEntry[] = [];
  const skipped: SourceUploadSkip[] = [];
  let cursor = directoryOffset;

  for (let index = 0; index < entryCount; index++) {
    if (cursor + 46 > directoryEnd || readUint32(view, cursor) !== ZIP_CENTRAL_DIRECTORY) {
      throw new Error('Corrupt ZIP central directory');
    }

    const flags = readUint16(view, cursor + 8);
    const method = readUint16(view, cursor + 10);
    const compressedSize = readUint32(view, cursor + 20);
    const uncompressedSize = readUint32(view, cursor + 24);
    const fileNameLength = readUint16(view, cursor + 28);
    const extraLength = readUint16(view, cursor + 30);
    const commentLength = readUint16(view, cursor + 32);
    const localHeaderOffset = readUint32(view, cursor + 42);
    const rawName = decodeZipName(bytes.slice(cursor + 46, cursor + 46 + fileNameLength), flags);
    const entryName = normalizeZipEntryName(rawName);
    cursor += 46 + fileNameLength + extraLength + commentLength;

    if (!entryName || !isTextSourceName(entryName)) {
      skipped.push({ name: rawName || file.name, reason: 'zip-entry-unsupported' });
      continue;
    }

    if (localHeaderOffset + 30 > bytes.length || readUint32(view, localHeaderOffset) !== ZIP_LOCAL_FILE_HEADER) {
      skipped.push({ name: entryName, reason: 'zip-error' });
      continue;
    }

    const localNameLength = readUint16(view, localHeaderOffset + 26);
    const localExtraLength = readUint16(view, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataStart > bytes.length || dataEnd > bytes.length) {
      skipped.push({ name: entryName, reason: 'zip-error' });
      continue;
    }

    try {
      const payload = bytes.slice(dataStart, dataEnd);
      const textBytes = await decodeZipPayload(payload, method);
      const text = new TextDecoder('utf-8', { fatal: false }).decode(textBytes);
      entries.push({ name: entryName, size: uncompressedSize, text });
    } catch {
      skipped.push({ name: entryName, reason: 'zip-error' });
    }
  }

  return { entries, skipped };
}

export async function readSourceUploads(files: SourceReadableFile[]): Promise<SourceUploadReadResult> {
  const uploads: SourceUpload[] = [];
  const skipped: SourceUploadSkip[] = [];
  let zipFiles = 0;
  let zipEntries = 0;

  for (const file of files) {
    if (isZipSource(file)) {
      zipFiles++;
      try {
        const { entries, skipped: zipSkipped } = await readZipTextEntries(file);
        skipped.push(...zipSkipped);
        for (const entry of entries) {
          uploads.push(makeSourceUpload(`${file.name}/${entry.name}`, entry.size, entry.text));
        }
        zipEntries += entries.length;
        if (!entries.length && !zipSkipped.length) {
          skipped.push({ name: file.name, reason: 'zip-entry-unsupported' });
        }
      } catch {
        skipped.push({ name: file.name, reason: 'zip-error' });
      }
      continue;
    }

    if (!isTextSourceName(file.name, file.type)) {
      skipped.push({ name: file.name, reason: 'unsupported' });
      continue;
    }

    try {
      uploads.push(makeSourceUpload(file.name || 'untitled.txt', file.size, await file.text()));
    } catch {
      skipped.push({ name: file.name || 'untitled.txt', reason: 'read-error' });
    }
  }

  return { uploads, skipped, zipFiles, zipEntries };
}
