<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { detectBridge } from '$lib/bridge';
  import { project, toasts, busy, activeRun, projectRefreshing, refreshAll } from '$lib/stores/app';
  import ProjectPicker from '$lib/ui/ProjectPicker.svelte';
  import AppShell from '$lib/ui/AppShell.svelte';

  let ready = $state(false);
  let bridgeKind = $state('');

  // 파일 watch 대체: 창으로 돌아올 때 프로젝트 상태를 다시 읽는다.
  // 사용자가 파인더·다른 에디터로 파일을 고쳐도 앱 상태가 어긋나지 않게. (제품화 §2.4)
  let lastFocusRefresh = 0;
  function onFocus() {
    if (!get(project) || get(busy) || get(activeRun) || get(projectRefreshing)) return;
    const now = Date.now();
    if (now - lastFocusRefresh < 1500) return; // 과도한 재읽기 방지
    lastFocusRefresh = now;
    void refreshAll({ reportExternalChanges: true });
  }

  onMount(() => {
    window.addEventListener('focus', onFocus);
    void (async () => {
      const b = await detectBridge();
      bridgeKind = b.kind;
      ready = true;
    })();
    return () => window.removeEventListener('focus', onFocus);
  });
</script>

{#if !ready}
  <div class="boot">Bindery 시작 중...</div>
{:else if !$project}
  <ProjectPicker {bridgeKind} />
{:else}
  <AppShell {bridgeKind} />
{/if}

<div class="toast-host" aria-live="polite">
  {#each $toasts as t (t.id)}
    <div class="toast {t.tone}">{t.text}</div>
  {/each}
</div>

<style>
  .boot { display: grid; place-items: center; height: 100%; color: var(--faint); }
  .toast-host {
    position: fixed; right: var(--space-4); bottom: var(--space-4); z-index: 200;
    display: grid; gap: 8px; max-width: min(380px, calc(100vw - (var(--space-4) * 2)));
  }
  .toast {
    padding: 8px 12px; border-radius: 8px; font-size: 12.5px;
    background: var(--bg-2); border: 1px solid var(--line-strong); color: var(--text);
  }
  .toast.ok { border-left: 4px solid var(--ok); }
  .toast.warn { border-left: 4px solid var(--warn); }
  .toast.bad { border-left: 4px solid var(--bad); }
  .toast.info { border-left: 4px solid var(--accent); }
  @media (max-width: 480px) {
    .toast-host {
      left: var(--space-2);
      right: var(--space-2);
      bottom: var(--space-2);
      max-width: none;
    }
  }
</style>
