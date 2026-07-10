import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { parse } from 'svelte/compiler';

const root = new URL('../', import.meta.url);
const sourceRoot = new URL('../src/', import.meta.url);

async function collectSvelteFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectSvelteFiles(path));
    else if (extname(entry.name) === '.svelte') files.push(path);
  }
  return files.sort();
}

function lineAt(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

function literalAttribute(attribute, expected) {
  if (attribute.type !== 'Attribute' || attribute.name !== expected) return '';
  if (attribute.value === true) return 'true';
  return attribute.value?.map((part) => part.data ?? '').join('') ?? '';
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'metadata' || key === 'parent') continue;
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}

const files = await collectSvelteFiles(sourceRoot.pathname);
const result = { files: files.length, buttons: 0, bound: 0, submit: 0, unbound: [] };

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const ast = parse(source, { filename: file, modern: true });
  walk(ast.fragment, (node) => {
    if (node.type !== 'RegularElement' || node.name !== 'button') return;
    result.buttons++;
    const attributes = node.attributes ?? [];
    const hasClick = attributes.some((attribute) =>
      (attribute.type === 'Attribute' && attribute.name === 'onclick') ||
      (attribute.type === 'OnDirective' && attribute.name === 'click')
    );
    const isSubmit = attributes.some((attribute) => literalAttribute(attribute, 'type') === 'submit');
    if (hasClick) result.bound++;
    else if (isSubmit) result.submit++;
    else {
      result.unbound.push({
        file: relative(root.pathname, file),
        line: lineAt(source, node.start)
      });
    }
  });
}

console.log(JSON.stringify(result, null, 2));
if (result.unbound.length > 0) process.exitCode = 1;
