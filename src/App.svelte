<script lang="ts">
  import { onMount } from 'svelte';
  import { detectBridge } from '$lib/bridge';
  import { project, toasts } from '$lib/stores/app';
  import ProjectPicker from '$lib/ui/ProjectPicker.svelte';
  import AppShell from '$lib/ui/AppShell.svelte';

  let ready = $state(false);
  let bridgeKind = $state('');

  onMount(async () => {
    const b = await detectBridge();
    bridgeKind = b.kind;
    ready = true;
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
    display: grid; gap: 6px; max-width: min(380px, calc(100vw - (var(--space-4) * 2)));
  }
  .toast {
    padding: 8px 12px; border-radius: 6px; font-size: 12.5px;
    background: var(--bg-2); border: 1px solid var(--line-strong); color: var(--text);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  }
  .toast.ok { border-left: 3px solid var(--ok); }
  .toast.warn { border-left: 3px solid var(--warn); }
  .toast.bad { border-left: 3px solid var(--bad); }
  .toast.info { border-left: 3px solid var(--accent); }
  @media (max-width: 480px) {
    .toast-host {
      left: var(--space-2);
      right: var(--space-2);
      bottom: var(--space-2);
      max-width: none;
    }
  }
</style>
