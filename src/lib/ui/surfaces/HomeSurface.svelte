<script lang="ts">
  // 홈 — 다음 작업 센터. 설명 화면이 아니라 실행 화면이다.
  // 상태에서 계산된 CTA 하나를 크게 보여주고, 보조 정보는 작은 카드로만 둔다.
  import {
    ctx, mode, currentEpisode, pendingProposals, progress, episodes, withBusy,
    busy, activeRun, intentNote, autopilotKick, clearRunFeed, toast, project, refreshAll
  } from '$lib/stores/app';
  import { loadWorkflowSnapshot, computeNextStep, type NextStep } from '$lib/harness/workflow';
  import {
    runProjectStarterAutopilot, adoptStarterIdea, ensureStoryFoundation,
    ensureEpisodeScaffold, type FoundationResult
  } from '$lib/harness/autopilot';
  import { nextEpisode } from '$lib/harness/episode';
  import type { IdeaFile } from '$lib/harness/ideas';
  import LiveRunPanel from '../LiveRunPanel.svelte';

  let step = $state<NextStep | null>(null);
  let starterIdeas = $state<IdeaFile[]>([]);
  const running = $derived(Boolean($busy || $activeRun));

  $effect(() => {
    void $progress;
    void $episodes;
    void $pendingProposals;
    void refresh();
  });

  async function refresh() {
    try {
      step = computeNextStep(await loadWorkflowSnapshot(ctx()));
    } catch {
      step = null;
    }
  }

  async function go() {
    if (!step) return;
    if (step.action === 'startProject') {
      clearRunFeed();
      const r = await withBusy('기획 후보 생성', () => runProjectStarterAutopilot(ctx(), $intentNote.trim()), false);
      if (!r) return;
      if (r.error) {
        toast(r.error, 'warn');
        return;
      }
      starterIdeas = r.ideas;
      intentNote.set('');
      if (r.ideas.every((i) => i.seed.source === 'local')) {
        toast('AI 실행기가 연결되지 않아 뼈대만 만들었습니다. 설정을 확인하세요.', 'warn');
      }
      return;
    }
    if (step.action === 'prepareStoryFoundation') {
      await prepareThenWrite();
      return;
    }
    if (step.episode) currentEpisode.set(step.episode);
    if (step.action === 'writeNextEpisode') autopilotKick.set('write');
    else if (step.action === 'reviseCurrentDraft') autopilotKick.set('revise');
    else if (step.action === 'closeEpisode') autopilotKick.set('close');
    else if (step.action === 'applyCandidate') autopilotKick.set('candidates');
    mode.set('write');
  }

  async function adopt(idea: IdeaFile) {
    clearRunFeed();
    const r = await withBusy('작품 기본 구성', () => adoptStarterIdea(ctx(), idea, $project?.title ?? '작품'));
    if (!r) return;
    starterIdeas = [];
    const bible = r.bibleSource === 'agent' ? 'AI 바이블' : r.bibleSource === 'fallback' ? '로컬 바이블' : '바이블 없음';
    toast(`기획 채택됨 — 세계관 자산 ${r.assets}건 → ${bible} → 플롯 초안 ${r.plotEpisodes}화가 준비됐습니다.`, 'ok');
    await refreshAll();
    await refresh();
  }

  function foundationLabel(r: FoundationResult): string {
    const bible =
      r.bibleSource === 'existing' ? '기존 바이블' :
      r.bibleSource === 'agent' ? 'AI 바이블' :
      r.bibleSource === 'fallback' ? '로컬 바이블' : '바이블 없음';
    const plot =
      r.plotSource === 'existing' ? '기존 플롯' :
      r.plotSource === 'agent' ? 'AI 플롯' :
      r.plotSource === 'fallback' ? '로컬 플롯' : '플롯 없음';
    return `${bible} → ${plot} ${r.plotEpisodes}화`;
  }

  async function prepareThenWrite() {
    if (!step?.episode) return;
    clearRunFeed();
    currentEpisode.set(step.episode);
    const r = await withBusy('작품 기준 준비', () =>
      ensureStoryFoundation(ctx(), {
        title: $project?.title ?? '작품',
        notes: $intentNote.trim(),
        episode: step?.episode ?? undefined
      }), false
    );
    if (!r) return;
    toast(`작품 기준 준비됨: 자산 ${r.assets}건, ${foundationLabel(r)}.`, r.bibleSource === 'fallback' || r.plotSource === 'fallback' ? 'warn' : 'ok');
    await refreshAll();
    await refresh();
    autopilotKick.set('writeFresh');
    mode.set('write');
  }

  const lastFixed = $derived([...$episodes].reverse().find((e) => $progress[e]?.status === 'fixed') ?? null);
  // CTA 문구에 이미 실행 의미가 있으므로 홈은 버튼 하나만 크게 둔다.
  const showIntent = $derived(step?.action === 'startProject' || step?.action === 'writeNextEpisode' || step?.action === 'prepareStoryFoundation');
  const freshEpisode = $derived.by(() => {
    if (step?.episode && ['prepareStoryFoundation', 'writeNextEpisode', 'applyCandidate'].includes(step.action)) return step.episode;
    return nextEpisode($episodes[$episodes.length - 1] ?? 'ep000');
  });

  async function startFreshEpisode() {
    if (running) return;
    const target = freshEpisode;
    clearRunFeed();
    currentEpisode.set(target);
    const r = await withBusy('새 회차 준비', async () => {
      await ensureEpisodeScaffold(ctx(), target);
      return ensureStoryFoundation(ctx(), {
        title: $project?.title ?? '작품',
        notes: $intentNote.trim(),
        episode: target
      });
    }, false);
    if (!r) return;
    toast(`${target} 새로 시작: ${foundationLabel(r)} 준비됨. 초안 후보를 만듭니다.`, r.bibleSource === 'fallback' || r.plotSource === 'fallback' ? 'warn' : 'ok');
    await refreshAll();
    currentEpisode.set(target);
    autopilotKick.set('writeFresh');
    mode.set('write');
  }
</script>

<div class="surface">
  <div class="col">
    {#if running}
      <LiveRunPanel title="작업 실행 중" />
    {:else if starterIdeas.length}
      <span class="kicker">기획 후보 — 하나를 고르면 세계관·플롯 기본 구성이 자동으로 만들어집니다</span>
      <div class="ideas">
        {#each starterIdeas as idea (idea.seed.id)}
          <article class="idea">
            <h3>{idea.seed.title}
              {#if idea.seed.source === 'agent'}<span class="chip ok">AI</span>{:else}<span class="chip warn">뼈대</span>{/if}
            </h3>
            <div class="row act">
              <button class="primary" onclick={() => adopt(idea)}>이 기획으로 시작</button>
            </div>
            <p class="hook">{idea.seed.hook}</p>
            <p class="dim">약속: {idea.seed.reader_promise || '(미정)'}</p>
            {#if idea.seed.risks.length}<p class="risk">위험: {idea.seed.risks.join(' · ')}</p>{/if}
          </article>
        {/each}
      </div>
      <div class="row">
        <button class="quiet" onclick={() => (starterIdeas = [])}>취소</button>
        <button class="quiet" onclick={go}>다시 만들기</button>
      </div>
    {:else if step}
      <span class="kicker">다음 작업</span>
      <h1>{step.title}</h1>
      <p class="lead">{step.detail}</p>
      <div class="row ctarow">
        {#if showIntent}
          <input class="grow" bind:value={$intentNote} placeholder="원하는 방향이 있으면 한 줄로 (선택)" onkeydown={(e) => e.key === 'Enter' && go()} />
        {/if}
        <button class="primary big" onclick={go}>{step.cta}</button>
      </div>

      <div class="aux">
        {#if $pendingProposals > 0}
          <button class="card" onclick={() => mode.set('pending')}>
            설정 변경 후보 <b>{$pendingProposals}건</b>이 보류 중입니다 <span class="go">검토 →</span>
          </button>
        {/if}
        {#if lastFixed}
          <button class="card" onclick={() => { currentEpisode.set(lastFixed!); mode.set('write'); }}>
            마지막 픽스 <b>{lastFixed}</b> <span class="go">열기 →</span>
          </button>
        {/if}
        <button class="card" onclick={() => mode.set('notes')}>
          작품노트 <span class="go">인물 · 세계 · 플롯 · 떡밥 →</span>
        </button>
        {#if step.action !== 'startProject'}
          <button class="card" onclick={startFreshEpisode} disabled={running}>
            같은 작품에서 <b>{freshEpisode}</b> 처음부터 쓰기 <span class="go">시작 →</span>
          </button>
        {/if}
      </div>
    {:else}
      <p class="empty">프로젝트 상태를 읽는 중…</p>
    {/if}
  </div>
</div>

<style>
  .surface { padding: 56px 32px 48px; }
  .col { max-width: 680px; margin: 0 auto; display: grid; gap: 14px; align-content: start; }
  .kicker { font-size: 10px; font-weight: 800; letter-spacing: 0.09em; text-transform: uppercase; color: var(--faint); }
  h1 { margin: 0; font-size: 29px; line-height: 1.28; letter-spacing: -0.012em; font-weight: 750; }
  .lead { margin: 0; color: var(--muted); font-size: 14.5px; line-height: 1.65; max-width: 56ch; }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .ctarow { margin-top: 8px; }
  .grow { flex: 1; min-width: 220px; padding: 9px 12px; }
  .big { padding: 10px 24px; font-size: 14px; }

  .aux { display: grid; gap: 8px; margin-top: 22px; }
  .card {
    display: flex; gap: 8px; align-items: center;
    text-align: left;
    border: 1px solid var(--line); border-radius: 4px;
    background: var(--bg-1);
    padding: 11px 14px;
    color: var(--muted); font-size: 12.5px;
  }
  .card b { color: var(--text); }
  .card:hover { background: var(--accent-soft); }
  .card .go { margin-left: auto; color: var(--accent); white-space: nowrap; }

  /* 기획 후보는 좁은 카드 대신 전폭 행으로 — 훅 문장이 세로로 접히지 않고
     후보 간 차이를 줄 단위로 비교할 수 있다. */
  .ideas { display: grid; border-top: 1px solid var(--line-strong); }
  .idea {
    display: grid; gap: 5px;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    padding: 15px 2px;
    border-bottom: 1px solid var(--line);
  }
  .idea h3 { margin: 0; font-size: 15px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; grid-column: 1; }
  .idea .act { grid-column: 2; grid-row: 1; }
  .idea .hook { margin: 0; font-size: 13px; line-height: 1.6; grid-column: 1 / -1; }
  .idea .dim { margin: 0; font-size: 12px; grid-column: 1 / -1; }
  .idea .risk { margin: 0; font-size: 11.5px; color: var(--warn); grid-column: 1 / -1; }
  @media (max-width: 560px) {
    .idea { grid-template-columns: minmax(0, 1fr); }
    .idea .act { grid-column: 1; grid-row: auto; }
  }
</style>
