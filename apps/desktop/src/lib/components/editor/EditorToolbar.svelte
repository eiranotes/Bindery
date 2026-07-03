<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { createSnapshot } from '$lib/api/commands';
  import { editorStore } from '$lib/stores/editorStore';
  import { projectStore } from '$lib/stores/projectStore';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { writingModeStore, goalStore } from '$lib/stores/writingModeStore';
  import { jobStore } from '$lib/stores/jobStore';
  import { toasts } from '$lib/stores/toastStore';
  import { gotoLine } from '$lib/stores/editorNavStore';
  import type { WordStats } from '$lib/editor';

  export let stats: WordStats = { words: 0, chars: 0, charsNoSpace: 0, paragraphs: 0, sentences: 0, manuscriptPages: 0 };
  const dispatch = createEventDispatcher();
  let menuOpen = false;

  async function snap() {
    if (!$editorStore.path) return;
    const info = await createSnapshot($projectStore.current?.rootPath || 'sample-project', $editorStore.path, 'manual-editor-snapshot', $editorStore.content);
    jobStore.update((jobs) => [{ id: info.id, createdAt: info.createdAt, label: 'snapshot', status: 'ok', ok: true, command: ['snapshot'], stdout: info.snapshotPath, stderr: '', exitCode: 0 }, ...jobs]);
    toasts.push('스냅샷 생성됨', 'ok');
    menuOpen = false;
  }
  const views: Array<['source' | 'split' | 'preview', string]> = [['source', '본문'], ['split', '분할'], ['preview', '미리보기']];

  function setGoal() {
    goalStore.set({ target: $goalStore.target, startWords: stats.charsNoSpace, startedAt: new Date().toISOString() });
    toasts.push(`세션 목표 ${$goalStore.target}자 시작`, 'info');
    menuOpen = false;
  }
  $: written = $goalStore.startedAt ? Math.max(0, stats.charsNoSpace - $goalStore.startWords) : 0;
  $: pct = $goalStore.startedAt ? Math.min(100, Math.round((written / Math.max(1, $goalStore.target)) * 100)) : 0;

  // 장면(헤딩·*** 구분자) 목록 — 긴 원고에서 장면 단위 이동용
  type Scene = { line: number; label: string };
  function extractScenes(content: string): Scene[] {
    const out: Scene[] = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      const h = /^(#{1,3})\s+(.+)$/.exec(t);
      if (h) out.push({ line: i + 1, label: h[2].slice(0, 30) });
      else if (/^(\*\s*){3,}$/.test(t)) out.push({ line: i + 1, label: `⁂ 장면 전환 (L${i + 1})` });
      if (out.length >= 40) break;
    }
    return out;
  }
  $: scenes = extractScenes($editorStore.content);
  function jumpScene(e: Event) {
    const el = e.currentTarget as HTMLSelectElement;
    if (el.value) gotoLine(parseInt(el.value, 10));
    el.value = '';
  }
</script>

<div class="editor-toolbar">
  <div class="seg">
    {#each views as [m, label]}
      <button class="seg-btn" class:on={$editorStore.mode === m} on:click={() => editorStore.update((s) => ({ ...s, mode: m }))}>{label}</button>
    {/each}
  </div>

  {#if scenes.length > 1}
    <select class="scene-jump" title="장면으로 이동" on:change={jumpScene}>
      <option value="">장면 이동…</option>
      {#each scenes as sc}<option value={sc.line}>{sc.label}</option>{/each}
    </select>
  {/if}

  <span class="wc" title={`${stats.words.toLocaleString()} 공백 단위 · 문장 ${stats.sentences.toLocaleString()}개 · 원고지 ${stats.manuscriptPages.toLocaleString()}매`}>
    {stats.charsNoSpace.toLocaleString()}자 · 문장 {stats.sentences.toLocaleString()}개
  </span>
  {#if $goalStore.startedAt}
    <span class="goal-mini" title={`세션 목표 ${written}/${$goalStore.target}`}>
      <i style={`width:${pct}%`}></i>
    </span>
  {/if}
  {#if $editorStore.dirty}<span class="dirty" title="저장되지 않음 (자동저장 대기)">●</span>{/if}

  <div class="right">
    <span class="fname">{$editorStore.path?.split('/').pop() || ''}</span>
    <div class="more-wrap">
      <button class="ghost icon" title="더보기" on:click={() => (menuOpen = !menuOpen)}>⋯</button>
      {#if menuOpen}
        <div class="menu" role="menu">
          <button role="menuitem" on:click={() => { dispatch('save'); menuOpen = false; }}>지금 저장 <kbd>⌘S</kbd></button>
          <button role="menuitem" on:click={snap}>스냅샷 만들기</button>
          <div class="menu-div"></div>
          <button role="menuitem" class:on={$writingModeStore.focus} on:click={() => writingModeStore.update((s) => ({ ...s, focus: !s.focus }))}>포커스 모드 {#if $writingModeStore.focus}✓{/if}</button>
          <button role="menuitem" class:on={$writingModeStore.typewriter} on:click={() => writingModeStore.update((s) => ({ ...s, typewriter: !s.typewriter }))}>타자기 스크롤 {#if $writingModeStore.typewriter}✓{/if}</button>
          <button role="menuitem" class:on={$writingModeStore.zen} on:click={() => { writingModeStore.update((s) => ({ ...s, zen: !s.zen })); menuOpen = false; }}>몰입 모드 {#if $writingModeStore.zen}✓{/if}</button>
          <button role="menuitem" class:on={$settingsStore.showLineNumbers} on:click={() => settingsStore.update((s) => ({ ...s, showLineNumbers: !s.showLineNumbers }))}>줄 번호 {#if $settingsStore.showLineNumbers}✓{/if}</button>
          <div class="menu-div"></div>
          <div class="menu-goal">
            <input type="number" min="50" step="50" bind:value={$goalStore.target} />
            <button class="ghost" on:click={setGoal}>목표 시작</button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .seg { display: inline-flex; background: var(--chip); border-radius: var(--r-sm); padding: 2px; }
  .seg-btn { border: 0; padding: 4px 11px; border-radius: 6px; font-size: 12px; }
  .seg-btn.on { background: var(--bg-2); color: var(--text); font-weight: 600; box-shadow: var(--shadow); }
  .wc { font-size: 11.5px; color: var(--faint); font-variant-numeric: tabular-nums; }
  .scene-jump { max-width: 150px; font-size: 11.5px; padding: 3px 6px; color: var(--muted); background: var(--chip); border: 1px solid var(--line); border-radius: var(--r-sm); }
  .goal-mini { width: 56px; height: 5px; background: var(--chip); border-radius: 5px; overflow: hidden; }
  .goal-mini i { display: block; height: 100%; background: var(--accent); transition: width .3s ease; }
  .dirty { color: var(--warn); font-size: 10px; }
  .right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
  .fname { font-size: 11.5px; color: var(--faint); font-family: ui-monospace, monospace; }
  .icon { padding: 3px 10px; font-size: 15px; line-height: 1; }
  .more-wrap { position: relative; }
  .menu {
    position: absolute; right: 0; top: calc(100% + 6px); z-index: 60;
    min-width: 200px; padding: 6px;
    background: var(--pop); border: 1px solid var(--line);
    border-radius: var(--r-md); box-shadow: var(--shadow-pop);
    display: flex; flex-direction: column; gap: 1px;
  }
  .menu button { justify-content: space-between; display: flex; width: 100%; text-align: left; font-size: 12.5px; padding: 7px 10px; border-radius: 7px; }
  .menu button.on { color: var(--accent); }
  .menu kbd { font-size: 10px; color: var(--faint); font-family: ui-monospace, monospace; }
  .menu-div { height: 1px; background: var(--line); margin: 5px 4px; }
  .menu-goal { display: flex; gap: 6px; padding: 4px; }
  .menu-goal input { width: 76px; font-size: 12px; }
</style>
