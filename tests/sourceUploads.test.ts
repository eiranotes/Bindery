import { describe, expect, it } from 'vitest';
import { readSourceUploads } from '../src/lib/harness/sourceUploads';
import { SOURCE_ZIP_MAX_ENTRIES } from '../src/lib/harness/sourceUploads';

const textEncoder = new TextEncoder();

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function writeBytes(target: Uint8Array, offset: number, bytes: Uint8Array): void {
  target.set(bytes, offset);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([toArrayBuffer(bytes)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function makeZip(entries: Array<{ name: string; content: string; method?: 'stored' | 'deflated' }>): Promise<Uint8Array> {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.name);
    const payload = textEncoder.encode(entry.content);
    const method = entry.method === 'stored' ? 0 : 8;
    const compressed = method === 0 ? payload : await deflateRaw(payload);

    const local = new Uint8Array(30 + nameBytes.length + compressed.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, method, true);
    localView.setUint32(18, compressed.length, true);
    localView.setUint32(22, payload.length, true);
    localView.setUint16(26, nameBytes.length, true);
    writeBytes(local, 30, nameBytes);
    writeBytes(local, 30 + nameBytes.length, compressed);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, method, true);
    centralView.setUint32(20, compressed.length, true);
    centralView.setUint32(24, payload.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, localOffset, true);
    writeBytes(central, 46, nameBytes);
    centralParts.push(central);

    localOffset += local.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(8, entries.length, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, centralDirectory.length, true);
  eocdView.setUint32(16, localOffset, true);

  return concatBytes([...localParts, centralDirectory, eocd]);
}

describe('source uploads', () => {
  it('does not impose an app-level file count limit', async () => {
    const files = Array.from({ length: 5 }, (_, index) =>
      new File([`자료 ${index + 1}`], `source-${index + 1}.md`, { type: 'text/markdown' })
    );

    const result = await readSourceUploads(files);

    expect(result.uploads).toHaveLength(5);
    expect(result.skipped).toHaveLength(0);
    expect(result.uploads.map((file) => file.name)).toEqual([
      'source-1.md',
      'source-2.md',
      'source-3.md',
      'source-4.md',
      'source-5.md'
    ]);
  });

  it('expands readable text entries from a zip file', async () => {
    const zip = await makeZip([
      { name: 'planning/idea.md', content: '# 아이디어\n던전 운영물', method: 'deflated' },
      { name: 'planning/notes.txt', content: '톤: 유쾌하지만 장기 떡밥 유지', method: 'stored' },
      { name: 'art/cover.png', content: 'not-really-png', method: 'stored' }
    ]);

    const result = await readSourceUploads([
      new File([toArrayBuffer(zip)], 'planning.zip', { type: 'application/zip' })
    ]);

    expect(result.zipFiles).toBe(1);
    expect(result.zipEntries).toBe(2);
    expect(result.uploads.map((file) => file.name)).toEqual([
      'planning.zip/planning/idea.md',
      'planning.zip/planning/notes.txt'
    ]);
    expect(result.uploads[0].content).toContain('던전 운영물');
    expect(result.uploads[1].content).toContain('장기 떡밥');
    expect(result.skipped.some((skip) => skip.name === 'art/cover.png')).toBe(true);
  });

  it('expands deflated zip entries without DecompressionStream', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'DecompressionStream');
    const zip = await makeZip([
      { name: 'planning/idea.md', content: '# 아이디어\nWebView fallback', method: 'deflated' },
      { name: 'planning/notes.md', content: '압축 해제 API 없이도 읽는다', method: 'deflated' }
    ]);

    Object.defineProperty(globalThis, 'DecompressionStream', {
      configurable: true,
      value: undefined
    });
    try {
      const result = await readSourceUploads([
        new File([toArrayBuffer(zip)], 'webview.zip', { type: 'application/zip' })
      ]);

      expect(result.zipEntries).toBe(2);
      expect(result.skipped).toHaveLength(0);
      expect(result.uploads.map((file) => file.name)).toEqual([
        'webview.zip/planning/idea.md',
        'webview.zip/planning/notes.md'
      ]);
      expect(result.uploads[1].content).toContain('API 없이도');
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'DecompressionStream', descriptor);
      } else {
        delete (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
      }
    }
  });

  it('skips unsafe and metadata zip paths', async () => {
    const zip = await makeZip([
      { name: '../escape.md', content: 'bad', method: 'stored' },
      { name: '__MACOSX/._idea.md', content: 'metadata', method: 'stored' },
      { name: 'safe/idea.md', content: '살릴 자료', method: 'stored' }
    ]);

    const result = await readSourceUploads([
      new File([toArrayBuffer(zip)], 'mixed.zip', { type: 'application/zip' })
    ]);

    expect(result.uploads.map((file) => file.name)).toEqual(['mixed.zip/safe/idea.md']);
    expect(result.skipped.length).toBeGreaterThanOrEqual(2);
  });

  it('reports progress and cancels a long zip read', async () => {
    const zip = await makeZip(Array.from({ length: 12 }, (_, index) => ({
      name: `planning/${index}.md`, content: `자료 ${index}`, method: 'stored' as const
    })));
    const controller = new AbortController();
    const seen: number[] = [];

    await expect(readSourceUploads(
      [new File([toArrayBuffer(zip)], 'cancel.zip', { type: 'application/zip' })],
      {
        signal: controller.signal,
        onProgress(progress) {
          if (progress.phase === 'expanding') {
            seen.push(progress.current);
            if (progress.current === 3) controller.abort();
          }
        }
      }
    )).rejects.toThrow('cancelled');
    expect(seen).toEqual([1, 2, 3]);
  });

  it('rejects zip archives over the entry-count safety limit', async () => {
    const zip = await makeZip(Array.from({ length: SOURCE_ZIP_MAX_ENTRIES + 1 }, (_, index) => ({
      name: `planning/${index}.md`, content: 'x', method: 'stored' as const
    })));
    const result = await readSourceUploads([
      new File([toArrayBuffer(zip)], 'too-many.zip', { type: 'application/zip' })
    ]);
    expect(result.uploads).toHaveLength(0);
    expect(result.skipped).toContainEqual({ name: 'too-many.zip', reason: 'zip-entry-limit' });
  });
});
