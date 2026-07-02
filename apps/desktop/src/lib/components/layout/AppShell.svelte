<script lang="ts">
  import TopBar from './TopBar.svelte';
  import ToastHost from './ToastHost.svelte';
  import CommandPalette from './CommandPalette.svelte';
  import BinderPanel from '$lib/components/binder/BinderPanel.svelte';
  import MainSurface from './MainSurface.svelte';
  import MyBooks from './MyBooks.svelte';
  import { writingModeStore } from '$lib/stores/writingModeStore';
  import { projectStore } from '$lib/stores/projectStore';
</script>

{#if !$projectStore.current}
  <div class="app app-landing">
    <MyBooks />
    <ToastHost />
  </div>
{:else}
  <div class="app" class:zen={$writingModeStore.zen}>
    <TopBar />
    <main class="studio-grid" class:zen={$writingModeStore.zen}>
      {#if !$writingModeStore.zen}<BinderPanel />{/if}
      <MainSurface />
    </main>
    <ToastHost />
    <CommandPalette />
  </div>
{/if}
