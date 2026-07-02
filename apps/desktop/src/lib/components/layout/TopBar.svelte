<script lang="ts">
  import { projectStore } from '$lib/stores/projectStore';
  import { mainViews, uiStore } from '$lib/stores/uiStore';
  import { themeStore, toggleTheme } from '$lib/stores/themeStore';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { gotoStage } from '$lib/stores/pipelineStore';

  const providerLabel: Record<string, string> = {
    codex: 'Codex',
    antigravity: 'Antigravity',
    gemini: 'Gemini',
    custom: '직접 설정'
  };

  $: agentReady = Boolean($settingsStore.agentCliPath);
  $: agentName = providerLabel[$settingsStore.agentProvider] ?? $settingsStore.agentProvider;

  function backToBooks() {
    projectStore.update((s) => ({ ...s, current: null }));
    uiStore.update((s) => ({ ...s, centerView: 'write', binderTab: 'episodes' }));
  }
  function openAIConnect() {
    gotoStage('connect');
    uiStore.update((s) => ({ ...s, centerView: 'ai' }));
  }
</script>

<header class="topbar studio-topbar" data-tauri-drag-region>
  <button class="logo logo-button" on:click={backToBooks} title="시작 화면">
    <span class="logo-mark"></span><span>Bindery</span>
  </button>

  <div class="project-zone">
    <button class="project-chip" on:click={backToBooks} title={$projectStore.current?.rootPath}>
      <span>작품</span>
      <b>{$projectStore.current?.title}</b>
    </button>
    <nav class="main-tabs" aria-label="주요 화면">
      {#each mainViews as view}
        <button class:on={$uiStore.centerView === view.id} title={view.hint} on:click={() => uiStore.update((s) => ({ ...s, centerView: view.id }))}>{view.label}</button>
      {/each}
    </nav>
  </div>

  <div class="topbar-right">
    <button class="agent-state" class:ready={agentReady} title="AI 연결 상태 — 누르면 연결 설정으로 이동" on:click={openAIConnect}>
      <span class="dot" class:ok={agentReady}></span>{agentName} {agentReady ? '연결됨' : '미설정'}
    </button>
    {#if $settingsStore.mockMode}<span class="mock-pill">데모</span>{/if}
    <button class="ghost quiet-action" class:on={$uiStore.centerView === 'help'} on:click={() => uiStore.update((s) => ({ ...s, centerView: 'help' }))}>도움말</button>
    <button class="ghost quiet-action" on:click={() => uiStore.update((s) => ({ ...s, prefsOpen: true }))}>환경설정</button>
    <button class="ghost icon theme-toggle" title={$themeStore === 'light' ? '다크 모드' : '라이트 모드'} on:click={toggleTheme} aria-label={$themeStore === 'light' ? '다크 모드' : '라이트 모드'}>
      <span class:dark-dot={$themeStore === 'light'} class:light-dot={$themeStore !== 'light'}></span>
    </button>
  </div>
</header>
