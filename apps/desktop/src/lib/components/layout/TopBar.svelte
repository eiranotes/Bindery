<script lang="ts">
  import { projectStore } from '$lib/stores/projectStore';
  import { primaryViews, isStudioView, toggleSidebar, uiStore } from '$lib/stores/uiStore';
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
  // 작업실 탭 — 문체/AI/내보내기 도구면. 이미 도구면이면 그대로 두고, 아니면 파이프라인으로 진입.
  $: studioActive = isStudioView($uiStore.centerView);
  function openStudio() {
    uiStore.update((s) => (isStudioView(s.centerView) ? s : { ...s, centerView: 'ai' }));
  }
</script>

<header class="topbar studio-topbar" data-tauri-drag-region>
  <button class="logo logo-button" on:click={backToBooks} title="시작 화면">
    <span class="logo-mark"></span><span>Bindery</span>
  </button>

  <div class="project-zone">
    {#if $uiStore.centerView === 'write'}
      <button
        class="ghost icon sidebar-toggle"
        on:click={toggleSidebar}
        title={$uiStore.sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
        aria-label={$uiStore.sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
        aria-pressed={$uiStore.sidebarCollapsed}
      >
        <span>{$uiStore.sidebarCollapsed ? '›' : '‹'}</span>
      </button>
    {/if}
    <button class="project-chip" on:click={backToBooks} title={$projectStore.current?.rootPath}>
      <span>작품</span>
      <b>{$projectStore.current?.title}</b>
    </button>
    <nav class="main-tabs" aria-label="주요 화면">
      {#each primaryViews as view}
        <button class:on={$uiStore.centerView === view.id} title={view.hint} on:click={() => uiStore.update((s) => ({ ...s, centerView: view.id }))}>{view.label}</button>
      {/each}
      <button class:on={studioActive} title="문체·AI·내보내기 작업실" on:click={openStudio}>작업실</button>
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
