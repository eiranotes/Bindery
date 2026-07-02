<script lang="ts">
  import { onMount } from 'svelte';
  import { runQAAction, runRevisionAction, runDraftAction, runAnalyzeAction, scanCodexAction, loadPlotAction } from '$lib/actions/pipeline';
  import { uiStore } from '$lib/stores/uiStore';
  import { writingModeStore } from '$lib/stores/writingModeStore';
  import { editorStore } from '$lib/stores/editorStore';

  type Cmd = { id: string; label: string; hint?: string; run: () => void };
  const commands: Cmd[] = [
    { id: 'write', label: '작성 화면 열기', hint: '화면', run: () => uiStore.update((s) => ({ ...s, centerView: 'write' })) },
    { id: 'pipeline', label: 'AI 작업 화면 열기', hint: '화면', run: () => uiStore.update((s) => ({ ...s, centerView: 'pipeline' })) },
    { id: 'draft', label: '초안 후보 생성', hint: 'AI', run: () => runDraftAction('draft') },
    { id: 'analyze', label: '반복 표현 분석', hint: 'AI', run: () => runAnalyzeAction() },
    { id: 'qa', label: 'QA 게이트 검사', hint: 'AI', run: runQAAction },
    { id: 'revise', label: '수정 계획 생성', hint: 'AI', run: runRevisionAction },
    { id: 'scan', label: '설정집 링크 스캔', hint: '자료', run: scanCodexAction },
    { id: 'plot', label: '플롯 보드 새로고침', hint: '자료', run: loadPlotAction },
    { id: 'focus', label: '포커스 모드 전환', hint: '보기', run: () => writingModeStore.update((s) => ({ ...s, focus: !s.focus })) },
    { id: 'typewriter', label: '타자기 스크롤 전환', hint: '보기', run: () => writingModeStore.update((s) => ({ ...s, typewriter: !s.typewriter })) },
    { id: 'zen', label: '집중 모드 전환', hint: '보기', run: () => writingModeStore.update((s) => ({ ...s, zen: !s.zen })) },
    { id: 'source', label: '본문 보기', hint: '보기', run: () => editorStore.update((s) => ({ ...s, mode: 'source' })) },
    { id: 'split', label: '분할 보기', hint: '보기', run: () => editorStore.update((s) => ({ ...s, mode: 'split' })) },
    { id: 'preview', label: '미리보기', hint: '보기', run: () => editorStore.update((s) => ({ ...s, mode: 'preview' })) },
    { id: 'bible', label: '왼쪽 설정집 탭', hint: '탐색', run: () => uiStore.update((s) => ({ ...s, binderTab: 'bible' })) }
  ];

  let open = false;
  let query = '';
  let index = 0;
  let inputEl: HTMLInputElement;
  $: filtered = commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()) || (c.hint ?? '').toLowerCase().includes(query.toLowerCase()));

  function toggle(v: boolean) { open = v; query = ''; index = 0; if (v) setTimeout(() => inputEl?.focus(), 0); }
  function run(c: Cmd) { toggle(false); c.run(); }

  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); toggle(!open); return; }
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); toggle(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); index = Math.min(index + 1, filtered.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); index = Math.max(index - 1, 0); }
    else if (e.key === 'Enter' && filtered[index]) { e.preventDefault(); run(filtered[index]); }
  }
  onMount(() => { window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); });
</script>

{#if open}
  <div class="cp-backdrop">
    <button class="cp-backdrop-btn" aria-label="닫기" on:click={() => toggle(false)}></button>
    <div class="cp" role="dialog" aria-modal="true" tabindex="-1">
      <input bind:this={inputEl} bind:value={query} placeholder="명령 검색…  (⌘/Ctrl+K)" on:input={() => (index = 0)} />
      <div class="cp-list">
        {#each filtered as c, i}
          <button class="cp-item" class:on={i === index} on:click={() => run(c)} on:mouseenter={() => (index = i)}>
            <span class="cp-label">{c.label}</span>
            {#if c.hint}<span class="cp-hint">{c.hint}</span>{/if}
          </button>
        {/each}
        {#if filtered.length === 0}<div class="cp-empty">일치하는 명령 없음</div>{/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .cp-backdrop { position: fixed; inset: 0; background: rgba(20,18,14,.35); z-index: 200; display: flex; justify-content: center; align-items: flex-start; padding-top: 14vh; }
  .cp-backdrop-btn { position: absolute; inset: 0; border: 0; background: transparent; cursor: default; padding: 0; }
  .cp { position: relative; z-index: 1; width: min(560px, 92vw); background: var(--pop); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow-pop); overflow: hidden; }
  .cp input { width: 100%; border: 0; border-bottom: 1px solid var(--line); background: transparent; padding: 14px 16px; color: var(--text); font-size: 15px; outline: none; }
  .cp-list { max-height: 320px; overflow: auto; padding: 6px; }
  .cp-item { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; border: 0; background: transparent; color: var(--text); border-radius: 9px; text-align: left; }
  .cp-item.on { background: var(--accent-soft); }
  .cp-label { font-size: 13.5px; }
  .cp-hint { font-size: 10px; text-transform: uppercase; color: var(--faint); border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; }
  .cp-empty { padding: 20px; text-align: center; color: var(--muted); font-size: 13px; }
</style>
