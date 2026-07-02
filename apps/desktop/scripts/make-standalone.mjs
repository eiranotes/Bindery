import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';

const appDir = process.cwd();
const tauriDir = path.join(appDir, 'src-tauri');
const confPath = path.join(tauriDir, 'tauri.conf.json');
const cargoPath = path.join(tauriDir, 'Cargo.toml');

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function readCargoField(name) {
  const raw = readFileSync(cargoPath, 'utf8');
  const re = new RegExp(`^${name}\\s*=\\s*"([^"]+)"`, 'm');
  const match = raw.match(re);
  if (!match) throw new Error(`Cargo.toml package.${name} not found`);
  return match[1];
}

function archLabel() {
  switch (process.arch) {
    case 'x64': return 'x64';
    case 'arm64': return 'arm64';
    case 'ia32': return 'x86';
    default: return process.arch;
  }
}

function targetTriple() {
  if (process.env.TAURI_TARGET_TRIPLE) return process.env.TAURI_TARGET_TRIPLE;
  if (process.platform === 'win32' && process.arch === 'x64') return 'x86_64-pc-windows-msvc';
  if (process.platform === 'win32' && process.arch === 'arm64') return 'aarch64-pc-windows-msvc';
  return '';
}

const conf = readJson(confPath);
const cargoName = readCargoField('name');
const version = conf.version || readCargoField('version');
const productName = conf.productName || cargoName;
const exeName = process.platform === 'win32' ? `${cargoName}.exe` : cargoName;
const triple = targetTriple();

const candidates = [
  path.join(tauriDir, 'target', 'release', exeName),
  triple ? path.join(tauriDir, 'target', triple, 'release', exeName) : null,
  process.env.CARGO_TARGET_DIR ? path.join(process.env.CARGO_TARGET_DIR, 'release', exeName) : null,
  process.env.CARGO_TARGET_DIR && triple ? path.join(process.env.CARGO_TARGET_DIR, triple, 'release', exeName) : null,
].filter(Boolean);

const source = candidates.find((file) => existsSync(file));
if (!source) {
  throw new Error(`Release executable not found. Checked:\n${candidates.map((c) => `- ${c}`).join('\n')}`);
}

const outDir = path.join(appDir, 'dist-standalone');
mkdirSync(outDir, { recursive: true });
const safeProduct = String(productName).replace(/[^a-zA-Z0-9._-]+/g, '_');
const outName = process.platform === 'win32'
  ? `${safeProduct}_${version}_${archLabel()}-standalone.exe`
  : `${safeProduct}_${version}_${archLabel()}-standalone`;
const dest = path.join(outDir, outName);
copyFileSync(source, dest);

const buf = readFileSync(dest);
const sha256 = createHash('sha256').update(buf).digest('hex');
const sizeBytes = statSync(dest).size;
const sizeMiB = (sizeBytes / 1024 / 1024).toFixed(2);

const notes = [];
if (conf.bundle?.externalBin?.length) {
  notes.push('This project declares bundle.externalBin. A single copied exe may not include sidecar binaries.');
}
if (conf.bundle?.resources?.length) {
  notes.push('This project declares bundle.resources. A single copied exe may not include resource files.');
}
if (process.platform === 'win32') {
  notes.push('Windows WebView2 Runtime is still required by Tauri. It is built into most current Windows 10/11 environments, but this standalone exe does not install it.');
}

const manifest = {
  productName,
  version,
  source,
  output: dest,
  sha256,
  sizeBytes,
  sizeMiB,
  notes,
  generatedAt: new Date().toISOString(),
};
writeFileSync(path.join(outDir, 'standalone-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(path.join(outDir, 'SHA256SUMS.txt'), `${sha256}  ${outName}\n`);

console.log(`Standalone executable written:`);
console.log(`  ${dest}`);
console.log(`Size: ${sizeMiB} MiB`);
console.log(`SHA-256: ${sha256}`);
if (notes.length) {
  console.log('\nNotes:');
  for (const note of notes) console.log(`- ${note}`);
}
