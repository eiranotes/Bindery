<script lang="ts">
  // 내보내기 - 흩어진 회차 원고를 하나의 완성물로. (제품화 점검 P0-2)
  // 합본 .md / .txt는 프로젝트 exports/에 저장, EPUB/DOCX는 브라우저 다운로드.
  // 회차별 복사는 연재 플랫폼 붙여넣기용.
  import { ctx, progress, project, withBusy, toast, refreshAll } from '$lib/stores/app';
  import {
    collectChapters, buildMarkdown, buildPlainText, buildEpub, buildDocx, chapterPlainText,
    saveTextExport, exportBaseName, totalChars, type ExportChapter, type ExportMeta
  } from '$lib/harness/exportManuscript';
  import {
    buildProjectBackup, backupFileName, previewProjectRestore, restoreProjectBackup, rollbackProjectRestore,
    type ProjectRestorePoint, type RestorePreview
  } from '$lib/harness/backup';

  let fixedOnly = $state(false);
  let chapters = $state<ExportChapter[]>([]);
  let loaded = $state(false);
  let restoreInput = $state<HTMLInputElement | null>(null);
  let pendingRestore = $state<{ name: string; bytes: Uint8Array; preview: RestorePreview } | null>(null);
  let lastRestorePoint = $state<ProjectRestorePoint | null>(null);

  const meta = $derived<ExportMeta>({ title: $project?.title ?? '작품', author: $project?.author ?? '' });
  const chars = $derived(totalChars(chapters));

  $effect(() => {
    void fixedOnly;
    void reload();
  });

  async function reload() {
    try {
      chapters = await collectChapters(ctx(), $progress, { fixedOnly });
    } catch {
      chapters = [];
    }
    loaded = true;
  }

  function download(name: string, data: Uint8Array | string, mime: string) {
    const blob = data instanceof Uint8Array
      ? new Blob([data as unknown as BlobPart], { type: mime })
      : new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function exportMarkdown() {
    if (!chapters.length) return;
    const content = buildMarkdown(meta, chapters);
    const name = `${exportBaseName(meta)}-합본.md`;
    const path = await withBusy('합본 저장', () => saveTextExport(ctx(), name, content), false);
    download(name, content, 'text/markdown');
    if (path) toast(`합본 저장 + 다운로드: ${path}`, 'ok');
  }

  async function exportTxt() {
    if (!chapters.length) return;
    const content = buildPlainText(meta, chapters);
    const name = `${exportBaseName(meta)}.txt`;
    const path = await withBusy('TXT 저장', () => saveTextExport(ctx(), name, content), false);
    download(name, content, 'text/plain');
    if (path) toast(`TXT 저장 + 다운로드: ${path}`, 'ok');
  }

  function exportEpub() {
    if (!chapters.length) return;
    const bytes = buildEpub(meta, chapters);
    download(`${exportBaseName(meta)}.epub`, bytes, 'application/epub+zip');
    toast('EPUB 다운로드를 시작했습니다.', 'ok');
  }

  function exportDocx() {
    if (!chapters.length) return;
    const bytes = buildDocx(meta, chapters);
    download(
      `${exportBaseName(meta)}.docx`,
      bytes,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    toast('DOCX 다운로드를 시작했습니다.', 'ok');
  }

  async function copyChapter(c: ExportChapter) {
    try {
      await navigator.clipboard.writeText(chapterPlainText(c));
      toast(`${c.title} 복사됨 - 연재 플랫폼에 붙여넣으세요.`, 'ok');
    } catch {
      toast('클립보드 복사에 실패했습니다.', 'bad');
    }
  }

  async function backupProject() {
    const r = await withBusy('프로젝트 백업', () => buildProjectBackup(ctx()), false);
    if (!r) return;
    download(backupFileName(meta.title), r.bytes, 'application/zip');
    toast(`프로젝트 백업 다운로드 - 텍스트 파일 ${r.fileCount}개 (재생성 캐시 제외).`, 'ok');
  }

  async function prepareRestore(file: File | null) {
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (restoreInput) restoreInput.value = '';
    const preview = await withBusy('복원 미리보기', () => previewProjectRestore(ctx(), bytes), false);
    if (!preview) return;
    pendingRestore = { name: file.name, bytes, preview };
  }

  async function runRestore() {
    if (!pendingRestore) return;
    const restore = pendingRestore;
    const r = await withBusy('프로젝트 복원', () => restoreProjectBackup(ctx(), restore.bytes), false);
    if (!r) return;
    pendingRestore = null;
    lastRestorePoint = r.restorePoint;
    await refreshAll();
    await reload();
    toast(`프로젝트 복원 완료 · 변경 ${r.restored}개, 동일 ${r.unchanged}개, 건너뜀 ${r.skipped}개`, 'ok');
  }

  async function rollbackLastRestore() {
    if (!lastRestorePoint) return;
    const r = await withBusy('복원 되돌리기', () => rollbackProjectRestore(ctx(), lastRestorePoint!), false);
    if (!r) return;
    lastRestorePoint = null;
    await refreshAll();
    await reload();
    toast(`복원 되돌림 · 복구 ${r.restored}개, 삭제 ${r.deleted}개, 실패 ${r.skipped}개`, r.skipped ? 'warn' : 'ok');
  }
</script>

<div class="surface">
  <div class="col">
    <header class="head">
      <h1>내보내기</h1>
      <p class="lead">회차별로 흩어진 원고를 하나의 완성물로 묶습니다. 합본과 TXT는 프로젝트
        <code>exports/</code> 폴더에 저장되며 동시에 다운로드됩니다.</p>
    </header>

    <div class="row toolbar">
      <label class="inline-check"><input type="checkbox" bind:checked={fixedOnly} /> 픽스된 회차만 (완결분)</label>
      <span class="grow"></span>
      {#if loaded}
        <span class="dim">{chapters.length}화 · 공백 제외 {chars.toLocaleString()}자</span>
      {/if}
    </div>

    {#if loaded && !chapters.length}
      <p class="empty">{fixedOnly ? '픽스된 회차가 없습니다. 회차를 마감(픽스)하거나 위 체크를 해제하세요.' : '내보낼 원고가 없습니다. 집필에서 초안을 원고로 반영하면 여기 모입니다.'}</p>
    {:else if chapters.length}
      <section class="block">
        <span class="kicker">전체 내보내기 - {meta.title}{meta.author ? ` · ${meta.author}` : ''}</span>
        <div class="row formats">
          <button class="primary big" onclick={exportMarkdown}>Markdown 합본 (.md)</button>
          <button class="big" onclick={exportTxt}>플레인 텍스트 (.txt)</button>
          <button class="big" onclick={exportEpub}>EPUB (.epub)</button>
          <button class="big" onclick={exportDocx}>Word 문서 (.docx)</button>
        </div>
        <p class="dim small">Markdown 합본은 Scrivener·Ulysses·옵시디언 가져오기에, TXT는 범용 붙여넣기에,
          EPUB은 리더기 미리보기에, DOCX는 워드프로세서 제출본에 적합합니다.</p>
      </section>

      <section class="block">
        <span class="kicker">프로젝트 백업 · 복원</span>
        <div class="row">
          <button class="big" onclick={backupProject}>전체 백업 (.zip)</button>
          <button class="big" onclick={() => restoreInput?.click()}>백업 복원 (.zip)</button>
          <input
            class="restore-input"
            bind:this={restoreInput}
            type="file"
            accept=".zip,application/zip"
            onchange={(event) => prepareRestore((event.currentTarget as HTMLInputElement).files?.[0] ?? null)}
          />
          <span class="dim">원고·설정·바이블 텍스트를 묶고 복원합니다. 실행 기록·스냅샷 캐시는 제외됩니다.</span>
        </div>
        {#if pendingRestore}
          <div class="restore-plan">
            <span class="dim mono">{pendingRestore.name}</span>
            <div class="restore-counts">
              <span class="chip info">새 파일 {pendingRestore.preview.createCount}</span>
              <span class="chip warn">덮어쓰기 {pendingRestore.preview.overwriteCount}</span>
              <span class="chip muted">동일 {pendingRestore.preview.unchangedCount}</span>
              {#if pendingRestore.preview.skipped}<span class="chip bad">건너뜀 {pendingRestore.preview.skipped}</span>{/if}
            </div>
            <ul class="restore-list">
              {#each pendingRestore.preview.entries.filter((entry) => entry.status !== 'unchanged').slice(0, 6) as entry}
                <li><span class="chip {entry.status === 'create' ? 'info' : 'warn'}">{entry.status === 'create' ? '새 파일' : '덮어쓰기'}</span><span class="mono">{entry.path}</span></li>
              {/each}
            </ul>
            <div class="row">
              <button class="primary" onclick={runRestore}>복원 실행</button>
              <button class="quiet" onclick={() => (pendingRestore = null)}>취소</button>
              <span class="dim">덮어쓰기 전 현재 파일은 스냅샷으로 보존됩니다.</span>
            </div>
          </div>
        {/if}
        {#if lastRestorePoint}
          <div class="restore-plan">
            <span class="dim">최근 복원 지점: {lastRestorePoint.id}</span>
            <div class="row">
              <button class="quiet" onclick={rollbackLastRestore}>방금 복원 되돌리기</button>
              <span class="dim">덮어쓴 파일은 스냅샷에서 복구하고, 새로 생긴 파일은 삭제합니다.</span>
            </div>
          </div>
        {/if}
      </section>

      <section class="block">
        <span class="kicker">회차별 복사 - 연재 플랫폼 붙여넣기용</span>
        <div class="chapters">
          {#each chapters as c (c.episode)}
            <div class="chapter">
              <span class="cmeta">
                <b>{c.title}</b>
                <span class="dim">{c.episode} · {c.chars.toLocaleString()}자{#if c.fixed} · <span class="chip ok">픽스</span>{/if}</span>
              </span>
              <button class="quiet" onclick={() => copyChapter(c)}>본문 복사</button>
            </div>
          {/each}
        </div>
      </section>
    {:else}
      <p class="empty">원고를 읽는 중…</p>
    {/if}
  </div>
</div>

<style>
  .surface { padding: 26px 32px 40px; overflow-x: hidden; }
  .col {
    width: min(100%, 820px); min-width: 0; margin: 0 auto;
    display: grid; gap: 16px; align-content: start;
  }
  .head h1 { margin: 0; font-size: 22px; }
  .lead { margin: 4px 0 0; color: var(--muted); max-width: 60ch; line-height: 1.65; overflow-wrap: anywhere; }
  .toolbar { border-top: 1px solid var(--line-strong); padding-top: 12px; }
  .inline-check { display: flex; gap: 6px; align-items: center; font-size: 12.5px; color: var(--muted); }
  .grow { flex: 1; }
  .kicker { font-size: 10px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: var(--faint); }
  .block { display: grid; gap: 10px; border-top: 1px solid var(--line); padding-top: 14px; min-width: 0; }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; min-width: 0; }
  .row > .dim { min-width: 220px; flex: 1 1 240px; }
  .formats { gap: 10px; }
  .formats .big { flex: 1 1 180px; }
  .big { padding: 9px 18px; font-size: 13.5px; min-width: 0; white-space: normal; text-align: center; }
  .small { margin: 0; font-size: 11.5px; overflow-wrap: anywhere; }
  .restore-input { display: none; }
  .restore-plan {
    display: grid; gap: 8px; min-width: 0;
    border-top: 1px solid var(--line); padding-top: 10px;
  }
  .restore-counts { display: flex; gap: 6px; flex-wrap: wrap; }
  .restore-list { list-style: none; margin: 0; padding: 0; display: grid; border-top: 1px solid var(--line); }
  .restore-list li {
    display: flex; align-items: center; gap: 8px; min-width: 0;
    padding: 6px 0; border-bottom: 1px solid var(--line);
  }
  .restore-list .mono { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; color: var(--muted); }

  .chapters { display: grid; border-top: 1px solid var(--line); }
  .chapter {
    display: flex; gap: 10px; align-items: center;
    padding: 9px 2px; border-bottom: 1px solid var(--line);
  }
  .cmeta { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; min-width: 0; flex: 1; }
  .cmeta b { font-size: 13.5px; }

  @media (max-width: 560px) {
    .surface { padding: 22px 16px 32px; }
    .row > .dim { min-width: 0; flex-basis: 100%; }
    .formats .big, .row .big { flex: 1 1 100%; }
    .chapter { align-items: flex-start; }
  }
</style>
