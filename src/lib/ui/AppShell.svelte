<script lang="ts">
  import type { Component } from 'svelte';
  import {
    activeRun, busy, clearExternalChanges, externalChanges, modes, mode, pendingProposals,
    persistSettings, project, projectRefreshError, projectRefreshing, refreshAll,
    providerUsage, returnToProjectPicker, runDockOpen, runlog, settings, uiMode, usageSummary
  } from '$lib/stores/app';
  import { formatUsd, isAgyCommand, summarizeProviderQuota } from '$lib/harness/usage';
  import RunDock from './RunDock.svelte';
  import StatusBar from './StatusBar.svelte';
  import HomeSurface from './surfaces/HomeSurface.svelte';
  import type { Mode, ModeEntry } from '$lib/stores/app';

  let { bridgeKind }: { bridgeKind: string } = $props();

  type SurfaceModule = { default: Component };
  type NavigationGroup = { id: string; label: string; items: ModeEntry[] };

  const surfaceLoaders: Record<Mode, () => Promise<SurfaceModule>> = {
    home: async () => ({ default: HomeSurface }),
    write: () => import('./surfaces/WriteSurface.svelte'),
    notes: () => import('./surfaces/NotesSurface.svelte'),
    style: () => import('./surfaces/StyleSurface.svelte'),
    export: () => import('./surfaces/ExportSurface.svelte'),
    pending: () => import('./surfaces/PendingSurface.svelte'),
    ideas: () => import('./surfaces/IdeasSurface.svelte'),
    world: () => import('./surfaces/WorldSurface.svelte'),
    plot: () => import('./surfaces/PlotSurface.svelte'),
    episode: () => import('./surfaces/EpisodeSurface.svelte'),
    canon: () => import('./surfaces/CanonSurface.svelte'),
    files: () => import('./surfaces/FilesSurface.svelte'),
    settings: () => import('./surfaces/SettingsSurface.svelte')
  };

  const navigationDefinition = [
    { id: 'workflow', label: '진행', modes: ['home', 'write', 'notes', 'style', 'export', 'pending'] as Mode[] },
    { id: 'design', label: '설계', modes: ['ideas', 'world', 'plot', 'episode', 'canon'] as Mode[] },
    { id: 'project', label: '프로젝트', modes: ['files', 'settings'] as Mode[] }
  ];
  const advancedOnly = new Set<Mode>(['ideas', 'world', 'plot', 'episode', 'canon']);

  let Surface: Component = $state(HomeSurface);
  let surfaceLoading = $state(false);
  let surfaceError = $state('');
  let surfaceLoadSequence = 0;

  const agentLabel = $derived(
    $settings.offline ? '오프라인' : $settings.command ? `${$settings.command}${$settings.model ? ` · ${$settings.model}` : ''}` : '실행기 미설정'
  );
  const agyQuota = $derived.by(() => {
    if (!isAgyCommand($settings.command) || !$providerUsage?.ok) return { fiveHour: null, weekly: null };
    return summarizeProviderQuota($providerUsage.groups);
  });
  const agyQuotaFloor = $derived.by(() => {
    const values = [agyQuota.fiveHour, agyQuota.weekly].filter((value): value is number => value != null);
    return values.length ? Math.min(...values) : null;
  });
  const canSwitchProject = $derived(!$busy && !$activeRun);
  const switchProjectTitle = $derived(
    canSwitchProject ? '작품 선택 화면으로 돌아가기' : '실행 중인 작업이 끝난 뒤 작품을 바꿀 수 있습니다'
  );
  const activeMode = $derived($modes.find((entry) => entry.id === $mode) ?? $modes[0]);
  const navigationGroups = $derived.by((): NavigationGroup[] => {
    const available = new Map($modes.map((entry) => [entry.id, entry]));
    return navigationDefinition
      .map((group) => ({
        id: group.id,
        label: group.label,
        items: group.modes.flatMap((id) => {
          const entry = available.get(id);
          return entry ? [entry] : [];
        })
      }))
      .filter((group) => group.items.length > 0);
  });

  async function activateSurface(target: Mode): Promise<void> {
    const sequence = ++surfaceLoadSequence;
    surfaceLoading = target !== 'home';
    surfaceError = '';
    try {
      const loaded = await surfaceLoaders[target]();
      if (sequence !== surfaceLoadSequence) return;
      Surface = loaded.default;
    } catch (error) {
      if (sequence !== surfaceLoadSequence) return;
      surfaceError = error instanceof Error ? error.message : String(error);
    } finally {
      if (sequence === surfaceLoadSequence) surfaceLoading = false;
    }
  }

  function preloadSurface(target: Mode): void {
    void surfaceLoaders[target]().catch(() => {
      /* 실제 전환 시 오류 상태에서 다시 안내한다. */
    });
  }

  async function setUiMode(next: 'simple' | 'advanced'): Promise<void> {
    if ($uiMode === next) return;
    if (next === 'simple' && advancedOnly.has($mode)) mode.set('home');
    settings.update((current) => ({ ...current, uiMode: next }));
    await persistSettings();
  }

  $effect(() => {
    void activateSurface($mode);
  });
</script>

<div class="shell" class:dock-open={$runDockOpen} class:showStatus={$settings.showStatusBar}>
  <aside class="rail" aria-label="Bindery 작업 탐색">
    <div class="rail-project">
      <b class="brand">Bindery</b>
      <span class="project-title" title={$project?.root}>{$project?.title}</span>
      <span class="project-path mono" title={$project?.root}>{$project?.root}</span>
    </div>

    <nav class="rail-nav" aria-label="작업 화면">
      {#each navigationGroups as group (group.id)}
        <section class="nav-group" aria-label={group.label}>
          <span class="nav-label">{group.label}</span>
          <div class="nav-items">
            {#each group.items as entry (entry.id)}
              <button
                class="nav-item"
                class:on={$mode === entry.id}
                aria-current={$mode === entry.id ? 'page' : undefined}
                title={entry.hint}
                data-mode={entry.id}
                onclick={() => mode.set(entry.id)}
                onpointerenter={() => preloadSurface(entry.id)}
              >
                <span>{entry.label}</span>
                {#if (entry.id === 'pending' || entry.id === 'canon') && $pendingProposals > 0}
                  <i class="badge" aria-label={`보류 ${$pendingProposals}건`}>{$pendingProposals}</i>
                {/if}
              </button>
            {/each}
          </div>
        </section>
      {/each}
    </nav>

    <div class="rail-footer">
      <div class="mode-switch" aria-label="작업 모드">
        <button class:on={$uiMode === 'simple'} onclick={() => setUiMode('simple')}>간단</button>
        <button class:on={$uiMode === 'advanced'} onclick={() => setUiMode('advanced')}>설계자</button>
      </div>
      <button
        class="project-switch"
        onclick={returnToProjectPicker}
        disabled={!canSwitchProject}
        title={switchProjectTitle}
      >
        작품 바꾸기
      </button>
    </div>
  </aside>

  <header class="topbar">
    <b class="mobile-brand">Bindery</b>
    <div class="context-copy">
      <span class="context-label">{activeMode?.label ?? '홈'}</span>
      <span class="context-hint">{activeMode?.hint ?? '다음 할 일'}</span>
    </div>
    <span class="topbar-project" title={$project?.root}>{$project?.title}</span>
    <div class="topbar-actions">
      {#if bridgeKind === 'memory'}<span class="chip warn">데모</span>{/if}
      {#if $projectRefreshing}<span class="chip muted">새로고침 중</span>{/if}
      {#if $externalChanges.length}
        <button
          class="quiet changes"
          onclick={clearExternalChanges}
          title={$externalChanges.slice(0, 8).map((change) => `${change.kind}: ${change.path}`).join('\n')}
        >
          외부 변경 {$externalChanges.length}건
        </button>
      {/if}
      {#if !$settings.offline && isAgyCommand($settings.command)}
        <button
          class="quiet quota-pair"
          class:over={agyQuotaFloor != null && agyQuotaFloor <= 10}
          class:near={agyQuotaFloor != null && agyQuotaFloor > 10 && agyQuotaFloor <= 25}
          onclick={() => mode.set('settings')}
          title={`Agy 잔여 한도 · 5h ${agyQuota.fiveHour == null ? '조회 필요' : `${Math.round(agyQuota.fiveHour)}%`} · 1주 ${agyQuota.weekly == null ? '조회 필요' : `${Math.round(agyQuota.weekly)}%`}`}
        >
          <span><small>5h</small><b>{agyQuota.fiveHour == null ? '--' : `${Math.round(agyQuota.fiveHour)}%`}</b></span>
          <span><small>1주</small><b>{agyQuota.weekly == null ? '--' : `${Math.round(agyQuota.weekly)}%`}</b></span>
        </button>
      {:else if !$settings.offline && !isAgyCommand($settings.command) && $usageSummary.thisMonth.costUsd > 0}
        <button
          class="quiet cost"
          class:over={$usageSummary.budgetUsd > 0 && $usageSummary.budgetRatio >= 1}
          class:near={$usageSummary.budgetUsd > 0 && $usageSummary.budgetRatio >= 0.8 && $usageSummary.budgetRatio < 1}
          onclick={() => mode.set('settings')}
          title="이번 달 추정 AI 요금"
        >
          ~{formatUsd($usageSummary.thisMonth.costUsd)}{#if $usageSummary.budgetUsd > 0}/{formatUsd($usageSummary.budgetUsd)}{/if}
        </button>
      {/if}
      <button class="quiet agent" class:warn={$settings.offline || !$settings.command} onclick={() => mode.set('settings')} title="AI 실행기 설정">{agentLabel}</button>
      {#if $uiMode === 'advanced'}
        <button class="quiet runs" onclick={() => runDockOpen.update((value) => !value)} title="실행 기록">기록 {$runlog.length}</button>
      {/if}
    </div>
  </header>

  <main class="center">
    {#if $projectRefreshError}
      <div class="refresh-error" role="alert">
        <span><b>프로젝트를 다시 읽지 못했습니다.</b> {$projectRefreshError}</span>
        <button class="quiet" onclick={() => refreshAll({ deferDigest: true })}>다시 시도</button>
      </div>
    {/if}
    <div class="surface-host" aria-busy={surfaceLoading}>
      {#if surfaceError}
        <div class="surface-state" role="alert">
          <b>화면을 불러오지 못했습니다.</b>
          <span>{surfaceError}</span>
          <button onclick={() => activateSurface($mode)}>다시 시도</button>
        </div>
      {:else if surfaceLoading}
        <div class="surface-state loading" role="status">{activeMode?.label ?? '화면'} 불러오는 중</div>
      {:else}
        <Surface />
      {/if}
    </div>
  </main>

  {#if $runDockOpen}<RunDock />{/if}
  {#if $settings.showStatusBar}<StatusBar />{/if}
</div>

<style>
  .shell {
    height: 100%;
    min-width: 0;
    display: grid;
    grid-template-columns: var(--rail-width) minmax(0, 1fr);
    grid-template-rows: var(--topbar-height) minmax(0, 1fr);
    grid-template-areas: 'rail top' 'rail center';
    background: var(--bg);
  }
  .shell.dock-open {
    grid-template-rows: var(--topbar-height) minmax(0, 1fr) 200px;
    grid-template-areas: 'rail top' 'rail center' 'rail dock';
  }
  .shell.showStatus {
    grid-template-rows: var(--topbar-height) minmax(0, 1fr) var(--status-height);
    grid-template-areas: 'rail top' 'rail center' 'rail status';
  }
  .shell.dock-open.showStatus {
    grid-template-rows: var(--topbar-height) minmax(0, 1fr) 200px var(--status-height);
    grid-template-areas: 'rail top' 'rail center' 'rail dock' 'rail status';
  }
  .rail {
    grid-area: rail;
    min-width: 0;
    min-height: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    background: var(--bg-rail);
    border-right: 1px solid var(--line);
  }
  .rail-project {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-4) var(--space-4) var(--space-3);
    border-bottom: 1px solid var(--line);
  }
  .brand { color: var(--accent); font-size: 17px; line-height: 1.2; }
  .project-title { overflow: hidden; color: var(--text); font-size: 12.5px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
  .project-path { overflow: hidden; color: var(--faint); font-size: 9.5px; text-overflow: ellipsis; white-space: nowrap; }
  .rail-nav { min-height: 0; overflow: auto; padding: var(--space-3) var(--space-2); }
  .nav-group { display: grid; gap: var(--space-1); padding-bottom: var(--space-3); }
  .nav-group + .nav-group { padding-top: var(--space-2); border-top: 1px solid var(--line); }
  .nav-label { padding: 0 var(--space-2); color: var(--faint); font-size: 10px; font-weight: 800; letter-spacing: .07em; }
  .nav-items { display: grid; gap: var(--space-1); }
  .nav-item {
    width: 100%;
    min-height: var(--control-height);
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 0;
    padding: var(--space-1) var(--space-2);
    color: var(--muted);
    text-align: left;
  }
  .nav-item:hover:not(:disabled) { background: var(--bg-1); }
  .nav-item.on { background: var(--accent-soft); color: var(--text); font-weight: 700; }
  .nav-item.on::before { content: ''; width: 2px; align-self: stretch; margin: 0 var(--space-1) 0 calc(var(--space-1) * -1); background: var(--accent); }
  .badge {
    min-width: 18px;
    padding: 0 var(--space-1);
    border-radius: 3px;
    background: var(--warn-soft);
    color: var(--warn);
    font-size: 10px;
    font-style: normal;
    text-align: center;
  }
  .rail-footer { display: grid; gap: var(--space-2); padding: var(--space-3); border-top: 1px solid var(--line); }
  .mode-switch { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--line); border-radius: 4px; background: var(--bg-1); }
  .mode-switch button { min-height: 28px; border: 0; border-radius: 3px; padding: var(--space-1) var(--space-2); font-size: 11px; }
  .mode-switch button.on { background: var(--accent); color: var(--on-accent); }
  .project-switch { width: 100%; color: var(--accent); font-size: 11.5px; font-weight: 650; }
  .topbar {
    grid-area: top;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: 0 var(--space-4);
    background: var(--bg-1);
    border-bottom: 1px solid var(--line);
  }
  .mobile-brand { display: none; color: var(--accent); }
  .context-copy { min-width: 0; display: flex; align-items: baseline; gap: var(--space-2); }
  .context-label { color: var(--text); font-weight: 750; white-space: nowrap; }
  .context-hint { overflow: hidden; color: var(--faint); font-size: 11.5px; text-overflow: ellipsis; white-space: nowrap; }
  .topbar-project { overflow: hidden; margin-left: auto; color: var(--muted); font-size: 11.5px; text-overflow: ellipsis; white-space: nowrap; }
  .topbar-actions { min-width: 0; display: flex; align-items: center; gap: var(--space-1); }
  .topbar-actions button { min-height: 28px; white-space: nowrap; }
  .cost { font-size: 11px; font-variant-numeric: tabular-nums; }
  .cost.near { color: var(--warn); }
  .cost.over { color: var(--bad); background: var(--bad-soft); }
  .quota-pair { display: flex; align-items: center; gap: var(--space-2); font-variant-numeric: tabular-nums; }
  .quota-pair span { display: flex; align-items: baseline; gap: var(--space-1); }
  .quota-pair small { color: var(--faint); font-size: 9.5px; font-weight: 700; }
  .quota-pair b { color: var(--text); font-size: 10.5px; }
  .quota-pair.near small,
  .quota-pair.near b { color: var(--warn); }
  .quota-pair.over { background: var(--bad-soft); }
  .quota-pair.over small,
  .quota-pair.over b { color: var(--bad); }
  .agent { max-width: 220px; overflow: hidden; font-family: var(--mono); font-size: 10.5px; text-overflow: ellipsis; }
  .agent.warn { color: var(--warn); }
  .changes { color: var(--accent); background: var(--accent-soft); font-size: 11px; }
  .center {
    grid-area: center;
    min-width: 0;
    min-height: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
    background: var(--bg-desk);
  }
  .surface-host { min-width: 0; min-height: 0; overflow: auto; }
  .surface-state { min-height: 240px; display: grid; place-content: center; justify-items: center; gap: var(--space-2); padding: var(--space-6); color: var(--muted); text-align: center; }
  .surface-state.loading { color: var(--faint); font-size: 12px; }
  .refresh-error { display: flex; gap: var(--space-3); align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-4); border-bottom: 1px solid var(--bad); background: var(--bad-soft); color: var(--text); font-size: 12px; }

  @media (max-width: 980px) {
    .shell,
    .shell.dock-open,
    .shell.showStatus,
    .shell.dock-open.showStatus {
      grid-template-columns: minmax(0, 1fr);
    }
    .shell { grid-template-rows: var(--topbar-height) auto minmax(0, 1fr); grid-template-areas: 'top' 'rail' 'center'; }
    .shell.dock-open { grid-template-rows: var(--topbar-height) auto minmax(0, 1fr) 200px; grid-template-areas: 'top' 'rail' 'center' 'dock'; }
    .shell.showStatus { grid-template-rows: var(--topbar-height) auto minmax(0, 1fr) var(--status-height); grid-template-areas: 'top' 'rail' 'center' 'status'; }
    .shell.dock-open.showStatus { grid-template-rows: var(--topbar-height) auto minmax(0, 1fr) 200px var(--status-height); grid-template-areas: 'top' 'rail' 'center' 'dock' 'status'; }
    .rail { display: flex; align-items: center; border-right: 0; border-bottom: 1px solid var(--line); }
    .rail-project { display: none; }
    .rail-nav { flex: 1; display: flex; overflow-x: auto; padding: var(--space-1) var(--space-2); }
    .nav-group { display: contents; }
    .nav-label { display: none; }
    .nav-items { display: flex; gap: var(--space-1); }
    .nav-item { width: auto; white-space: nowrap; }
    .nav-item.on::before { display: none; }
    .rail-footer { display: flex; flex: 0 0 auto; padding: var(--space-1) var(--space-2); border-top: 0; border-left: 1px solid var(--line); }
    .mode-switch { width: 112px; }
    .project-switch { display: block; width: auto; flex: 0 0 auto; }
    .mobile-brand { display: inline; }
    .topbar-project { display: none; }
  }

  @media (max-width: 700px) {
    .topbar { gap: var(--space-2); padding: 0 var(--space-2); }
    .context-hint, .runs, .cost, .changes { display: none; }
    .topbar-actions { margin-left: auto; }
    .agent { max-width: 96px; }
    .quota-pair { gap: var(--space-1); padding-inline: var(--space-1); }
  }
</style>
