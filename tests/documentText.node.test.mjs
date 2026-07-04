import assert from 'node:assert/strict';

import { extractDocxText } from '../apps/desktop/src/lib/domain/documentText.ts';

const encoder = new TextEncoder();

function le16(value) {
  return [value & 0xff, (value >> 8) & 0xff];
}

function le32(value) {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
}

function bytes(...chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function minimalDocx(documentXml) {
  const name = encoder.encode('word/document.xml');
  const body = encoder.encode(documentXml);
  const local = bytes(
    new Uint8Array(le32(0x04034b50)),
    new Uint8Array(le16(20)),
    new Uint8Array(le16(0)),
    new Uint8Array(le16(0)),
    new Uint8Array(le16(0)),
    new Uint8Array(le16(0)),
    new Uint8Array(le32(0)),
    new Uint8Array(le32(body.length)),
    new Uint8Array(le32(body.length)),
    new Uint8Array(le16(name.length)),
    new Uint8Array(le16(0)),
    name,
    body
  );
  const centralOffset = local.length;
  const central = bytes(
    new Uint8Array(le32(0x02014b50)),
    new Uint8Array(le16(20)),
    new Uint8Array(le16(20)),
    new Uint8Array(le16(0)),
    new Uint8Array(le16(0)),
    new Uint8Array(le16(0)),
    new Uint8Array(le16(0)),
    new Uint8Array(le32(0)),
    new Uint8Array(le32(body.length)),
    new Uint8Array(le32(body.length)),
    new Uint8Array(le16(name.length)),
    new Uint8Array(le16(0)),
    new Uint8Array(le16(0)),
    new Uint8Array(le16(0)),
    new Uint8Array(le16(0)),
    new Uint8Array(le32(0)),
    new Uint8Array(le32(0)),
    name
  );
  const eocd = bytes(
    new Uint8Array(le32(0x06054b50)),
    new Uint8Array(le16(0)),
    new Uint8Array(le16(0)),
    new Uint8Array(le16(1)),
    new Uint8Array(le16(1)),
    new Uint8Array(le32(central.length)),
    new Uint8Array(le32(centralOffset)),
    new Uint8Array(le16(0))
  );
  return bytes(local, central, eocd).buffer;
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>MEDALLION</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>1. 기본 세계관</w:t></w:r></w:p>
    <w:p><w:r><w:t>배경 : 아르카나 대륙.</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>현대 수준의 문명.</w:t></w:r></w:p>
  </w:body>
</w:document>`;

const text = await extractDocxText(minimalDocx(xml));
assert.match(text, /^MEDALLION/);
assert.match(text, /# 1\. 기본 세계관/);
assert.match(text, /아르카나 대륙\.\t현대 수준의 문명\./);

console.log('document text smoke tests ok');
