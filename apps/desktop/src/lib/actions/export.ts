// 내보내기 — 회차 원고를 모아 TXT/HTML 합본을 만든다.
// 데스크톱에서는 프로젝트 exports/ 폴더에 저장하고, 브라우저에서는 다운로드한다.
import { get } from 'svelte/store';
import { readFile, writeFile, writeFileHex } from '$lib/api/commands';
import { buildEpub, toHex } from '$lib/domain/epub';
import { projectStore } from '$lib/stores/projectStore';
import { fileTreeStore } from '$lib/stores/fileTreeStore';
import { editorStore } from '$lib/stores/editorStore';
import { toasts } from '$lib/stores/toastStore';
import { parseFrontmatter } from '$lib/domain/frontmatter';
import { listEpisodes } from './episodes';

export type ExportFormat = 'txt' | 'html' | 'epub';
export type ExportScope = 'all' | 'current';

function stripFrontmatter(text: string): string {
  const fm = parseFrontmatter(text);
  return fm.present ? text.slice(fm.end).trim() : text.trim();
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

function download(filename: string, content: string | Uint8Array, mime: string) {
  const blob = typeof content === 'string' ? new Blob([content], { type: `${mime};charset=utf-8` }) : new Blob([content as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toHtml(title: string, author: string, chapters: Array<{ id: string; body: string }>): string {
  const sections = chapters
    .map((c) => {
      const paras = c.body
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => (p.startsWith('#') ? `<h3>${escapeHtml(p.replace(/^#+\s*/, ''))}</h3>` : `<p>${escapeHtml(p).replace(/\n/g, '<br />')}</p>`))
        .join('\n');
      return `<section class="chapter">\n<h2>${c.id.toUpperCase()}</h2>\n${paras}\n</section>`;
    })
    .join('\n\n');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { max-width: 680px; margin: 0 auto; padding: 48px 24px; font-family: 'Noto Serif KR', serif; line-height: 2.0; color: #2f2b26; background: #fdfcfa; }
  h1 { font-size: 28px; } h2 { margin-top: 64px; font-size: 20px; } h3 { font-size: 16px; }
  .author { color: #6f6a61; margin-bottom: 48px; }
  p { margin: 0 0 1.2em; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<div class="author">${escapeHtml(author || '')}</div>
${sections}
</body>
</html>
`;
}

function toTxt(title: string, chapters: Array<{ id: string; body: string }>): string {
  const parts = [title, ''];
  for (const c of chapters) {
    parts.push('', `====== ${c.id.toUpperCase()} ======`, '', c.body);
  }
  return parts.join('\n');
}

export async function exportCompilation(format: ExportFormat, scope: ExportScope): Promise<string | null> {
  const project = get(projectStore).current;
  const root = project?.rootPath || 'sample-project';
  const title = project?.title || '무제';
  const episodes = listEpisodes(get(fileTreeStore).nodes);
  const currentPath = get(editorStore).path;

  const targets = scope === 'current' ? episodes.filter((e) => e.manuscriptPath === currentPath || currentPath?.includes(`/${e.id}/`)) : episodes;
  if (targets.length === 0) {
    toasts.push('내보낼 회차가 없습니다', 'warn');
    return null;
  }

  const chapters: Array<{ id: string; body: string }> = [];
  for (const ep of targets) {
    try {
      const raw = ep.manuscriptPath === currentPath ? get(editorStore).content : await readFile(root, ep.manuscriptPath);
      chapters.push({ id: ep.id, body: stripFrontmatter(raw) });
    } catch {
      toasts.push(`${ep.id} 원고를 읽지 못해 건너뜁니다`, 'warn');
    }
  }
  if (chapters.length === 0) return null;

  const ts = new Date().toISOString().slice(0, 10);
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'bindery';
  const filename = `${safeTitle}-${scope === 'current' ? chapters[0].id : '전체'}-${ts}.${format}`;
  const rel = `exports/${filename}`;

  if (format === 'epub') {
    const bytes = buildEpub(
      title,
      '',
      chapters.map((c) => ({ id: c.id, title: c.id.toUpperCase(), paragraphs: c.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) }))
    );
    if (isTauri()) {
      await writeFileHex(root, rel, toHex(bytes));
      toasts.push(`내보내기 완료: ${rel} (회차 ${chapters.length}개)`, 'ok');
    } else {
      download(filename, bytes, 'application/epub+zip');
      toasts.push(`다운로드 시작: ${filename}`, 'ok');
    }
    return rel;
  }

  const content = format === 'txt' ? toTxt(title, chapters) : toHtml(title, '', chapters);
  if (isTauri()) {
    await writeFile(root, rel, content);
    toasts.push(`내보내기 완료: ${rel} (회차 ${chapters.length}개)`, 'ok');
  } else {
    download(filename, content, format === 'txt' ? 'text/plain' : 'text/html');
    toasts.push(`다운로드 시작: ${filename}`, 'ok');
  }
  return rel;
}
