<script lang="ts">
  import { codexStore } from '$lib/stores/codexStore';
  import { editorStore } from '$lib/stores/editorStore';
  import { projectStore } from '$lib/stores/projectStore';
  import { fileTreeStore } from '$lib/stores/fileTreeStore';
  import { loadCodexAction, scanCodexAction } from '$lib/actions/pipeline';
  import { gotoLine } from '$lib/stores/editorNavStore';
  import { writeFile, listTree } from '$lib/api/commands';
  import { toasts } from '$lib/stores/toastStore';
  import type { CodexType } from '$lib/domain/codex';

  const ICON: Record<CodexType, string> = { character: '◆', location: '⌂', faction: '⚑', system: '⚙', item: '✦', term: '§', event: '✳' };
  const TYPE_LABEL: Record<CodexType, string> = {
    character: '인물',
    location: '장소',
    faction: '세력',
    system: '규칙',
    item: '물건',
    term: '용어',
    event: '사건'
  };
  const STATUS_LABEL: Record<string, string> = { active: '활성', open: '열림', locked: '고정', draft: '초안' };

  function jumpToOffset(offset: number) {
    const line = $editorStore.content.slice(0, offset).split('\n').length;
    gotoLine(line);
  }
  function insertLink(from: number, to: number) {
    editorStore.update((s) => {
      const c = s.content;
      if (c.slice(Math.max(0, from - 2), from) === '[[') return s; // already linked
      const next = c.slice(0, from) + '[[' + c.slice(from, to) + ']]' + c.slice(to);
      return { ...s, content: next, dirty: next !== s.savedContent };
    });
    scanCodexAction();
  }
  // 새 항목 생성 — 유형별 디렉터리에 템플릿 파일을 만든다 (list_codex가 스캔하는 경로).
  const TYPE_DIR: Partial<Record<CodexType, string>> = { character: 'characters', location: 'world', term: 'canon', event: 'lore' };
  const typeOptions = Object.keys(TYPE_LABEL) as CodexType[];
  let addOpen = false;
  let newName = '';
  let newType: CodexType = 'character';
  let newSummary = '';
  let creatingItem = false;

  function slugify(name: string): string {
    const s = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9가-힣-]/g, '');
    return s || `item-${Date.now()}`;
  }

  async function createItem() {
    if (!newName.trim()) {
      toasts.push('항목 이름을 입력하세요', 'warn');
      return;
    }
    const root = $projectStore.current?.rootPath || 'sample-project';
    const dir = TYPE_DIR[newType] ?? 'canon';
    const rel = `${dir}/${slugify(newName)}.md`;
    creatingItem = true;
    try {
      await writeFile(root, rel, `# ${newName.trim()}\n\n${newSummary.trim() || '(요약을 적어주세요)'}\n\n## 메모\n\n- \n`);
      const nodes = await listTree(root);
      fileTreeStore.update((s) => ({ ...s, nodes }));
      await loadCodexAction();
      toasts.push(`설정 항목 생성됨: ${rel}`, 'ok');
      addOpen = false;
      newName = '';
      newSummary = '';
    } catch (e) {
      toasts.push(`항목 생성 실패: ${e instanceof Error ? e.message : String(e)}`, 'bad');
    } finally {
      creatingItem = false;
    }
  }

  $: report = $codexStore.mentionReport;
  $: mentionCountByItem = (() => {
    const m = new Map<string, number>();
    for (const men of report?.mentions ?? []) m.set(men.itemId, (m.get(men.itemId) ?? 0) + 1);
    return m;
  })();
</script>

<div class="codex-wrap">
  <div class="codex-toolbar">
    <div class="ct-left"><strong>설정집</strong><span class="muted">{$codexStore.items.length}개</span></div>
    <div class="ct-right">
      <button class="ghost tiny" on:click={() => (addOpen = !addOpen)}>{addOpen ? '닫기' : '+ 새 항목'}</button>
      <button class="ghost tiny" on:click={loadCodexAction}>새로고침</button>
      <button class="tiny" on:click={scanCodexAction} disabled={$codexStore.loading}>{$codexStore.loading ? '…' : '링크 스캔'}</button>
    </div>
  </div>

  {#if addOpen}
    <form class="add-form" on:submit|preventDefault={createItem}>
      <div class="add-row">
        <select bind:value={newType}>
          {#each typeOptions as t}<option value={t}>{TYPE_LABEL[t]}</option>{/each}
        </select>
        <input bind:value={newName} placeholder="이름 (예: 에이라)" />
      </div>
      <input bind:value={newSummary} placeholder="한 줄 요약 (선택)" />
      <div class="add-actions">
        <button class="primary tiny" type="submit" disabled={creatingItem}>{creatingItem ? '생성 중…' : '항목 만들기'}</button>
        <span class="add-hint">유형별 폴더(characters/world/canon/lore)에 Markdown 파일로 저장됩니다.</span>
      </div>
    </form>
  {/if}

  {#if $codexStore.items.length === 0}
    <div class="empty">설정집을 불러오면 인물·장소·떡밥이 표시됩니다.</div>
  {:else}
    <div class="codex-list">
      {#each $codexStore.items as item}
        <div class="entry">
          <div class="entry-head">
            <span class="icon" data-type={item.type}>{ICON[item.type]}</span>
            <span class="name">{item.name}</span>
            <span class="status">{TYPE_LABEL[item.type]}</span>
            {#if item.status}<span class="status">{STATUS_LABEL[item.status] ?? item.status}</span>{/if}
            {#if mentionCountByItem.get(item.id)}<span class="hits">{mentionCountByItem.get(item.id)}×</span>{/if}
          </div>
          {#if item.summary}<div class="summary">{item.summary}</div>{/if}
          {#if item.progressions?.length}
            <details class="prog">
              <summary>변화 {item.progressions.length}건</summary>
              <div class="prog-list">
                {#each item.progressions as pr}
                  <div class="prog-row"><span class="prog-ep">{pr.episode}</span><span class="prog-note">{pr.note}</span></div>
                {/each}
              </div>
            </details>
          {/if}
          <div class="aliases">
            {#each item.aliases as a}<span class="alias" class:off={!a.autoLink}>{a.value}</span>{/each}
          </div>
        </div>
      {/each}
    </div>

    {#if report}
      <div class="scan">
        <div class="scan-head">본문 링크 {report.mentions.length}건</div>
        {#if report.missing.length}
          <div class="missing">미등장: {report.missing.join(', ')}</div>
        {/if}
        <div class="mentions">
          {#each report.mentions.slice(0, 30) as m}
            <span class="mention">
              <button class="m-jump" title="본문으로 이동" on:click={() => jumpToOffset(m.from)}>
                <span class="m-surface">{m.surface}</span>
                <span class="m-conf" class:low={m.confidence < 0.7}>{(m.confidence * 100) | 0}%</span>
              </button>
              {#if !m.alreadyLinked}
                <button class="m-link" title="[[링크]] 삽입" on:click={() => insertLink(m.from, m.to)}>⊕</button>
              {/if}
            </span>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .codex-wrap { display: flex; flex-direction: column; min-height: 0; height: 100%; }
  .codex-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 4px 2px 10px; }
  .ct-left { display: flex; gap: 8px; align-items: baseline; }
  .ct-right { display: flex; gap: 6px; }
  .muted { color: var(--muted); font-size: 12px; }
  .tiny { padding: 5px 9px; font-size: 11.5px; }
  .empty { color: var(--muted); padding: 16px 4px; font-size: 13px; }
  .codex-list { display: flex; flex-direction: column; gap: 8px; overflow: auto; }
  .entry { border: 1px solid var(--line); border-radius: 11px; padding: 9px 11px; background: var(--hover); }
  .entry-head { display: flex; align-items: center; gap: 8px; }
  .icon { color: var(--accent); }
  .icon[data-type="location"] { color: var(--accent-2); }
  .icon[data-type="event"] { color: var(--bad); }
  .name { font-weight: 650; font-size: 13.5px; flex: 1; }
  .status { font-size: 10px; text-transform: uppercase; color: var(--faint); border: 1px solid var(--line); border-radius: 999px; padding: 1px 7px; }
  .hits { font-size: 11px; color: var(--accent-2); font-variant-numeric: tabular-nums; }
  .summary { font-size: 12px; color: var(--muted); margin-top: 5px; line-height: 1.5; }
  .prog { margin-top: 7px; }
  .prog summary { cursor: pointer; font-size: 11px; color: var(--accent-2); list-style: none; }
  .prog summary::before { content: '▸ '; }
  .prog[open] summary::before { content: '▾ '; }
  .prog-list { margin-top: 6px; display: flex; flex-direction: column; gap: 5px; border-left: 2px solid var(--line); padding-left: 10px; }
  .prog-row { display: flex; gap: 8px; font-size: 12px; }
  .prog-ep { color: var(--faint); font-family: ui-monospace, monospace; font-size: 10.5px; flex-shrink: 0; padding-top: 1px; }
  .prog-note { color: var(--muted); line-height: 1.45; }
  .aliases { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 7px; }
  .alias { font-size: 10.5px; padding: 2px 7px; border-radius: 6px; background: var(--accent-soft); color: var(--accent); }
  .alias.off { background: var(--chip); color: var(--faint); text-decoration: line-through; }
  .scan { margin-top: 12px; border-top: 1px solid var(--line); padding-top: 10px; }
  .scan-head { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--faint); }
  .missing { font-size: 11.5px; color: var(--warn); margin-top: 6px; }
  .mentions { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
  .mention { display: inline-flex; align-items: stretch; border-radius: 8px; background: var(--hover); border: 1px solid var(--line); font-size: 11.5px; overflow: hidden; }
  .mention:hover { border-color: var(--accent-2); }
  .m-jump { display: inline-flex; gap: 5px; align-items: center; padding: 3px 8px; background: transparent; border: 0; color: inherit; }
  .m-link { padding: 3px 7px; border: 0; border-left: 1px solid var(--line); background: transparent; color: var(--accent-2); }
  .m-link:hover { background: var(--accent-2-soft); }
  .m-conf { font-size: 9.5px; color: var(--ok); }
  .m-conf.low { color: var(--warn); }
  .add-form { display: grid; gap: 7px; border-bottom: 1px solid var(--line); padding: 2px 2px 12px; margin-bottom: 10px; }
  .add-row { display: grid; grid-template-columns: 100px minmax(0, 1fr); gap: 7px; }
  .add-actions { display: flex; align-items: center; gap: 10px; }
  .add-hint { color: var(--faint); font-size: 11px; line-height: 1.4; }
</style>
