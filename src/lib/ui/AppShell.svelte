<script lang="ts">
  // 앱 셸 - 최대 2단 구조: 상단바(전역 크롬) + 중앙 작업면.
  // 좌측 사이드바는 제거했다 (OD 와이어프레임 autopilot-shell.html 기준).
  // 간단 모드: 홈|집필|작품노트|보류함|파일|설정. 설계자 모드에서 파이프라인 화면이 추가된다.
  import {
    activeRun, busy, clearExternalChanges, externalChanges, modes, mode, project, pendingProposals,
    projectRefreshError, projectRefreshing, refreshAll, returnToProjectPicker,
    runDockOpen, runlog, settings, uiMode, usageSummary
  } from '$lib/stores/app';
  import { formatUsd } from '$lib/harness/usage';
  import RunDock from './RunDock.svelte';
  import StatusBar from './StatusBar.svelte';
  import HomeSurface from './surfaces/HomeSurface.svelte';
  import WriteSurface from './surfaces/WriteSurface.svelte';
  import NotesSurface from './surfaces/NotesSurface.svelte';
  import StyleSurface from './surfaces/StyleSurface.svelte';
  import ExportSurface from './surfaces/ExportSurface.svelte';
  import PendingSurface from './surfaces/PendingSurface.svelte';
  import IdeasSurface from './surfaces/IdeasSurface.svelte';
  import WorldSurface from './surfaces/WorldSurface.svelte';
  import PlotSurface from './surfaces/PlotSurface.svelte';
  import EpisodeSurface from './surfaces/EpisodeSurface.svelte';
  import CanonSurface from './surfaces/CanonSurface.svelte';
  import FilesSurface from './surfaces/FilesSurface.svelte';
  import SettingsSurface from './surfaces/SettingsSurface.svelte';
  import type { Mode } from '$lib/stores/app';

  let { bridgeKind }: { bridgeKind: string } = $props();

  const surfaces: Record<Mode, typeof HomeSurface> = {
    home: HomeSurface,
    write: WriteSurface,
    notes: NotesSurface,
    style: StyleSurface,
    export: ExportSurface,
    pending: PendingSurface,
    ideas: IdeasSurface,
    world: WorldSurface,
    plot: PlotSurface,
    episode: EpisodeSurface,
    canon: CanonSurface,
    files: FilesSurface,
    settings: SettingsSurface
  };

  const Surface = $derived(surfaces[$mode] ?? HomeSurface);
  const agentLabel = $derived(
    $settings.offline ? '오프라인' : $settings.command ? `${$settings.command}${$settings.model ? ` · ${$settings.model}` : ''}` : '실행기 미설정'
  );
  const canSwitchProject = $derived(!$busy && !$activeRun);
  const switchProjectTitle = $derived(
    canSwitchProject ? '작품 선택 화면으로 돌아가기' : '실행 중인 작업이 끝난 뒤 작품을 바꿀 수 있습니다'
  );
</script>

<div class="shell" class:dock-open={$runDockOpen} class:showStatus={$settings.showStatusBar}>
  <header class="topbar">
    <b class="brand">Bindery</b>
    <span class="proj" title={$project?.root}>{$project?.title}</span>
    <button
      class="project-switch"
      onclick={returnToProjectPicker}
      disabled={!canSwitchProject}
      title={switchProjectTitle}
    >
      작품 선택
    </button>
    <nav class="tabs" aria-label="작업 화면">
      {#each $modes as m (m.id)}
        <button class="quiet" class:on={$mode === m.id} title={m.hint} onclick={() => mode.set(m.id)}>
          {m.label}{#if (m.id === 'pending' || m.id === 'canon') && $pendingProposals > 0}<i class="badge">{$pendingProposals}</i>{/if}
        </button>
      {/each}
    </nav>
    <span class="right">
      {#if bridgeKind === 'memory'}<span class="chip warn">데모(비영속)</span>{/if}
      {#if $projectRefreshing}<span class="chip muted">새로고침 중</span>{/if}
      {#if $externalChanges.length}
        <button
          class="quiet changes"
          onclick={clearExternalChanges}
          title={$externalChanges.slice(0, 8).map((c) => `${c.kind}: ${c.path}`).join('\n')}
        >
          외부 변경 {$externalChanges.length}건
        </button>
      {/if}
      {#if !$settings.offline && $usageSummary.thisMonth.costUsd > 0}
        <button
          class="quiet cost"
          class:over={$usageSummary.budgetUsd > 0 && $usageSummary.budgetRatio >= 1}
          class:near={$usageSummary.budgetUsd > 0 && $usageSummary.budgetRatio >= 0.8 && $usageSummary.budgetRatio < 1}
          onclick={() => mode.set('settings')}
          title="이번 달 추정 AI 요금 (설정에서 단가·예산 조정)"
        >
          이번 달 ~{formatUsd($usageSummary.thisMonth.costUsd)}{#if $usageSummary.budgetUsd > 0}/{formatUsd($usageSummary.budgetUsd)}{/if}
        </button>
      {/if}
      <button class="quiet agent" class:warn={$settings.offline || !$settings.command} onclick={() => mode.set('settings')} title="AI 실행기 설정">{agentLabel}</button>
      {#if $uiMode === 'advanced'}
        <button class="quiet" onclick={() => runDockOpen.update((v) => !v)} title="실행 기록">run {$runlog.length}</button>
      {/if}
    </span>
  </header>

  <main class="center">
    {#if $projectRefreshError}
      <div class="refresh-error" role="alert">
        <span><b>프로젝트를 다시 읽지 못했습니다.</b> {$projectRefreshError}</span>
        <button class="quiet" onclick={() => refreshAll({ deferDigest: true })}>다시 시도</button>
      </div>
    {/if}
    <div class="surface-host"><Surface /></div>
  </main>

  {#if $runDockOpen}
    <RunDock />
  {/if}

  {#if $settings.showStatusBar}
    <StatusBar />
  {/if}
</div>

<style>
  .shell {
    height: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas: 'top' 'center';
    background: var(--bg);
  }
  .shell.dock-open {
    grid-template-rows: auto minmax(0, 1fr) 200px;
    grid-template-areas: 'top' 'center' 'dock';
  }
  .shell.showStatus {
    grid-template-rows: auto minmax(0, 1fr) 28px;
    grid-template-areas: 'top' 'center' 'status';
  }
  .shell.dock-open.showStatus {
    grid-template-rows: auto minmax(0, 1fr) 200px 28px;
    grid-template-areas: 'top' 'center' 'dock' 'status';
  }
  .topbar {
    grid-area: top;
    display: flex; align-items: center; gap: 12px;
    padding: 8px 16px;
    background: var(--bg-1);
    border-bottom: 1px solid var(--line);
    min-width: 0;
    overflow: hidden;
  }
  .brand { font-size: 14px; font-weight: 800; color: var(--accent); }
  .proj { font-size: 12.5px; color: var(--muted); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cost { font-size: 11.5px; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .cost.near { color: var(--warn); border-color: var(--warn-soft); }
  .cost.over { color: var(--bad); border-color: var(--bad-soft); background: var(--bad-soft); }
  .project-switch {
    flex: 0 0 auto;
    padding: var(--space-1) var(--space-2);
    background: var(--bg-rail);
    border-color: var(--line);
    color: var(--accent);
    font-size: 12px;
    font-weight: 650;
    white-space: nowrap;
  }
  .project-switch:hover:not(:disabled) {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--text);
  }
  .project-switch:disabled { color: var(--faint); }
  .tabs { display: flex; flex: 1 1 0; gap: 4px; min-width: 0; overflow-x: auto; }
  .tabs button { font-size: 12.5px; padding: 4px 12px; border-radius: 4px; position: relative; white-space: nowrap; }
  .tabs button.on { background: var(--accent-soft); color: var(--text); font-weight: 650; }
  .badge {
    font-style: normal; margin-left: 4px; padding: 0 4px; border-radius: 8px;
    background: var(--warn); color: var(--on-accent); font-size: 10px; font-weight: 800;
  }
  .right { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; min-width: 0; }
  .right button { white-space: nowrap; }
  .agent { font-family: var(--mono); font-size: 11px; }
  .agent.warn { color: var(--warn); }
  .changes {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--accent-soft);
    font-size: 11.5px;
  }
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
  .refresh-error {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-4);
    border-bottom: 1px solid var(--bad);
    background: var(--bad-soft);
    color: var(--text);
    font-size: 12px;
  }
  @media (max-width: 900px) {
    .topbar {
      flex-wrap: wrap;
      row-gap: 4px;
      overflow: visible;
    }
    .tabs {
      order: 3;
      flex: 1 0 100%;
      width: 100%;
    }
    .right {
      margin-left: auto;
    }
  }
  @media (max-width: 700px) {
    .topbar { gap: 8px; padding: 8px 8px; }
    .proj { display: none; }
    .right .agent { display: none; }
  }
</style>
