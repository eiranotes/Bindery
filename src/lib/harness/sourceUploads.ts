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
const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83,
  99, 115, 131, 163, 195, 227, 258
];
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5,
  5, 5, 0
];
const DISTANCE_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769,
  1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577
];
const DISTANCE_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11,
  11, 12, 12, 13, 13
];

type ZipTextEntry = {
  name: string;
  size: number;
  text: string;
};

type HuffmanTable = {
  maps: Array<Map<number, number>>;
  maxBits: number;
};

class DeflateBitReader {
  private bitOffset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  readBit(): number {
    if (this.bitOffset >= this.bytes.length * 8) {
      throw new Error('Unexpected end of deflate stream');
    }
    const bit = (this.bytes[this.bitOffset >> 3] >> (this.bitOffset & 7)) & 1;
    this.bitOffset++;
    return bit;
  }

  readBits(count: number): number {
    let value = 0;
    for (let index = 0; index < count; index++) {
      value |= this.readBit() << index;
    }
    return value;
  }

  alignByte(): void {
    this.bitOffset = Math.ceil(this.bitOffset / 8) * 8;
  }
}

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

function reverseBits(value: number, length: number): number {
  let reversed = 0;
  for (let index = 0; index < length; index++) {
    reversed = (reversed << 1) | (value & 1);
    value >>= 1;
  }
  return reversed;
}

function buildHuffmanTable(lengths: number[]): HuffmanTable {
  const maxBits = Math.max(0, ...lengths);
  const counts = new Array(maxBits + 1).fill(0);
  const nextCode = new Array(maxBits + 1).fill(0);
  const maps = Array.from({ length: maxBits + 1 }, () => new Map<number, number>());

  for (const length of lengths) {
    if (length > 0) counts[length]++;
  }

  let code = 0;
  for (let bits = 1; bits <= maxBits; bits++) {
    code = (code + counts[bits - 1]) << 1;
    nextCode[bits] = code;
  }

  lengths.forEach((length, symbol) => {
    if (length <= 0) return;
    const symbolCode = nextCode[length]++;
    maps[length].set(reverseBits(symbolCode, length), symbol);
  });

  return { maps, maxBits };
}

function decodeHuffmanSymbol(reader: DeflateBitReader, table: HuffmanTable): number {
  let code = 0;
  for (let bits = 1; bits <= table.maxBits; bits++) {
    code |= reader.readBit() << (bits - 1);
    const symbol = table.maps[bits]?.get(code);
    if (symbol !== undefined) return symbol;
  }
  throw new Error('Invalid deflate Huffman code');
}

function fixedHuffmanTables(): { literal: HuffmanTable; distance: HuffmanTable } {
  const literalLengths = new Array(288).fill(0);
  for (let symbol = 0; symbol <= 143; symbol++) literalLengths[symbol] = 8;
  for (let symbol = 144; symbol <= 255; symbol++) literalLengths[symbol] = 9;
  for (let symbol = 256; symbol <= 279; symbol++) literalLengths[symbol] = 7;
  for (let symbol = 280; symbol <= 287; symbol++) literalLengths[symbol] = 8;
  return {
    literal: buildHuffmanTable(literalLengths),
    distance: buildHuffmanTable(new Array(32).fill(5))
  };
}

function dynamicHuffmanTables(reader: DeflateBitReader): { literal: HuffmanTable; distance: HuffmanTable } {
  const literalCount = reader.readBits(5) + 257;
  const distanceCount = reader.readBits(5) + 1;
  const codeLengthCount = reader.readBits(4) + 4;
  const codeLengthLengths = new Array(19).fill(0);

  for (let index = 0; index < codeLengthCount; index++) {
    codeLengthLengths[CODE_LENGTH_ORDER[index]] = reader.readBits(3);
  }

  const codeLengthTable = buildHuffmanTable(codeLengthLengths);
  const lengths: number[] = [];
  const total = literalCount + distanceCount;

  while (lengths.length < total) {
    const symbol = decodeHuffmanSymbol(reader, codeLengthTable);
    if (symbol <= 15) {
      lengths.push(symbol);
    } else if (symbol === 16) {
      if (!lengths.length) throw new Error('Invalid deflate repeat length');
      const repeat = reader.readBits(2) + 3;
      const previous = lengths[lengths.length - 1];
      for (let index = 0; index < repeat; index++) lengths.push(previous);
    } else if (symbol === 17) {
      const repeat = reader.readBits(3) + 3;
      for (let index = 0; index < repeat; index++) lengths.push(0);
    } else if (symbol === 18) {
      const repeat = reader.readBits(7) + 11;
      for (let index = 0; index < repeat; index++) lengths.push(0);
    } else {
      throw new Error('Invalid deflate code length symbol');
    }
  }

  return {
    literal: buildHuffmanTable(lengths.slice(0, literalCount)),
    distance: buildHuffmanTable(lengths.slice(literalCount, total))
  };
}

function inflateRawDeflate(payload: Uint8Array, expectedSize: number): Uint8Array {
  const reader = new DeflateBitReader(payload);
  let output = new Uint8Array(Math.max(1024, expectedSize || 0));
  let outputLength = 0;

  function ensureCapacity(extra: number): void {
    const required = outputLength + extra;
    if (required <= output.length) return;
    let nextLength = output.length;
    while (nextLength < required) nextLength *= 2;
    const next = new Uint8Array(nextLength);
    next.set(output);
    output = next;
  }

  function appendByte(byte: number): void {
    ensureCapacity(1);
    output[outputLength++] = byte & 0xff;
  }

  function copyFromDistance(distance: number, length: number): void {
    if (distance <= 0 || distance > outputLength) throw new Error('Invalid deflate distance');
    ensureCapacity(length);
    for (let index = 0; index < length; index++) {
      output[outputLength] = output[outputLength - distance];
      outputLength++;
    }
  }

  function inflateCompressedBlock(literal: HuffmanTable, distance: HuffmanTable): void {
    while (true) {
      const symbol = decodeHuffmanSymbol(reader, literal);
      if (symbol < 256) {
        appendByte(symbol);
      } else if (symbol === 256) {
        return;
      } else {
        const lengthIndex = symbol - 257;
        const baseLength = LENGTH_BASE[lengthIndex];
        if (baseLength === undefined) throw new Error('Invalid deflate length symbol');
        const length = baseLength + reader.readBits(LENGTH_EXTRA[lengthIndex]);
        const distanceSymbol = decodeHuffmanSymbol(reader, distance);
        const baseDistance = DISTANCE_BASE[distanceSymbol];
        if (baseDistance === undefined) throw new Error('Invalid deflate distance symbol');
        const copyDistance = baseDistance + reader.readBits(DISTANCE_EXTRA[distanceSymbol]);
        copyFromDistance(copyDistance, length);
      }
    }
  }

  let finalBlock = false;
  while (!finalBlock) {
    finalBlock = reader.readBits(1) === 1;
    const blockType = reader.readBits(2);
    if (blockType === 0) {
      reader.alignByte();
      const length = reader.readBits(16);
      const inverseLength = reader.readBits(16);
      if (((length ^ 0xffff) & 0xffff) !== inverseLength) {
        throw new Error('Invalid deflate stored block length');
      }
      for (let index = 0; index < length; index++) appendByte(reader.readBits(8));
    } else if (blockType === 1) {
      const tables = fixedHuffmanTables();
      inflateCompressedBlock(tables.literal, tables.distance);
    } else if (blockType === 2) {
      const tables = dynamicHuffmanTables(reader);
      inflateCompressedBlock(tables.literal, tables.distance);
    } else {
      throw new Error('Unsupported deflate block type');
    }
  }

  return output.slice(0, outputLength);
}

async function inflateRawZipPayload(payload: Uint8Array, expectedSize: number): Promise<Uint8Array> {
  const StreamCtor = (globalThis as unknown as {
    DecompressionStream?: new (format: string) => DecompressionStream;
  }).DecompressionStream;

  if (StreamCtor) {
    try {
      const stream = new Blob([toArrayBuffer(payload)]).stream().pipeThrough(new StreamCtor('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch {
      // macOS WebView support is uneven; fall through to the local inflater.
    }
  }

  return inflateRawDeflate(payload, expectedSize);
}

async function decodeZipPayload(payload: Uint8Array, method: number, uncompressedSize: number): Promise<Uint8Array> {
  if (method === ZIP_STORED) return payload;
  if (method === ZIP_DEFLATED) return inflateRawZipPayload(payload, uncompressedSize);
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
      const textBytes = await decodeZipPayload(payload, method, uncompressedSize);
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
