<script lang="ts">
  // AI 파이프라인 워크벤치 — 아웃라인→회차 실행→검토→픽스를 한 화면에서.
  // 온보딩 스테이지(연결/바이블)는 상단 배너로 축약되고, 실행 자체는 좌측 단계
  // 테이블에서 하며 중앙은 산출물/프롬프트/컨텍스트/작품 플롯/검토 뷰어다.
  import { onMount } from 'svelte';
  import MarkdownPreview from '$lib/components/editor/MarkdownPreview.svelte';
  import CandidateDiffPanel from '$lib/components/candidates/CandidateDiffPanel.svelte';
  import QADashboard from '$lib/components/qa/QADashboard.svelte';
  import RevisionPanel from '$lib/components/revision/RevisionPanel.svelte';
  import RepetitionPanel from '$lib/components/analysis/RepetitionPanel.svelte';
  import OutlineTable from '$lib/components/pipeline/OutlineTable.svelte';
  import { pipelineStore, setStepStatus, resetPipeline } from '$lib/stores/pipelineStore';
  import type { StepExecMode } from '$lib/stores/pipelineStore';
  import { runStore, ensureRun, startRun, recordRunStep, recordHumanDecision, finishRun } from '$lib/stores/runStore';
  import type { PipelineRun } from '$lib/stores/runStore';
  import { latestArtifact, artifactStore, artifactsForEpisode } from '$lib/stores/artifactStore';
  import type { Artifact, ArtifactStep } from '$lib/stores/artifactStore';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { projectStore } from '$lib/stores/projectStore';
  import { editorStore } from '$lib/stores/editorStore';
  import { episodeStore } from '$lib/stores/episodeStore';
  import { fileTreeStore } from '$lib/stores/fileTreeStore';
  import { codexStore } from '$lib/stores/codexStore';
  import { candidateStore } from '$lib/stores/candidateStore';
  import { qaStore } from '$lib/stores/qaStore';
  import { plotStore } from '$lib/stores/plotStore';
  import { outlineStore } from '$lib/stores/outlineStore';
  import { episodeProgressStore, EPISODE_PROGRESS_LABEL } from '$lib/stores/episodeProgressStore';
  import { aiCommandContextStore } from '$lib/stores/aiCommandContextStore';
  import { uiStore, gotoView, gotoPipeline } from '$lib/stores/uiStore';
  import type { PipelineTab } from '$lib/stores/uiStore';
  import { styleStore } from '$lib/stores/styleStore';
  import { draftParamsStore, CREATIVITY_LABEL } from '$lib/stores/draftParamsStore';
  import type { Creativity } from '$lib/stores/draftParamsStore';
  import { toasts } from '$lib/stores/toastStore';
  import { testAgentCli, writeFile, listTree } from '$lib/api/commands';
  import {
    runQAAction,
    runRevisionAction,
    runDraftAction,
    runAnalyzeAction,
    runContextAction,
    runSummarizeAction,
    runCommitAction,
    runEpisodeBriefAction,
    runScenePlanAction
  } from '$lib/actions/pipeline';
  import { openFileInEditor } from '$lib/actions/project';
  import { buildGuidanceText, collectGuidance } from '$lib/domain/guidance';
  import { assemblePrompt, STEP_META, STEP_EXEC_LABEL } from '$lib/domain/prompt';
  import type { PipelineStep } from '$lib/domain/prompt';
  import { shortHash } from '$lib/domain/hash';
  import { outlineRowFor } from '$lib/domain/outline';
  import type { FileNode } from '$lib/types';

  const steps = Object.keys(STEP_META) as PipelineStep[];
  const statusLabel = { idle: '대기', running: '실행 중', done: '완료', failed: '실패' } as const;
  const providerLabel: Record<string, string> = { codex: 'Codex CLI', antigravity: 'Antigravity CLI', gemini: 'Gemini CLI', custom: '직접 설정' };
  const modeLabel: Record<StepExecMode, string> = { agent: '→ AI', fallback: '→ 로컬', static: '' };
  const lengthOptions: Array<[number, string]> = [[0, '자동'], [1500, '약 1,500자'], [3000, '약 3,000자'], [5000, '약 5,000자'], [8000, '약 8,000자']];
  const creativityOptions = Object.keys(CREATIVITY_LABEL) as Creativity[];
  type DraftKind = 'draft' | 'continue' | 'rewrite';
  const draftKinds: Array<[DraftKind, string]> = [['draft', '초안'], ['continue', '이어쓰기'], ['rewrite', '다시쓰기']];
  let draftKind: DraftKind = 'draft';
  let running: PipelineStep | null = null;
  let previewStep: PipelineStep | null = null;
  let previewText = '';
  let creatingBible = false;
  let testing = false;
  let testMessage = '';
  let testOk: boolean | null = null;

  $: providerHasDefault = ['codex', 'gemini', 'antigravity'].includes($settingsStore.agentProvider);
  $: agentReady = !$settingsStore.mockMode && (Boolean($settingsStore.agentCliPath?.trim()) || providerHasDefault);
  $: bibleFiles = collectBibleFiles($fileTreeStore.nodes);
  $: hasBible = bibleFiles.length > 0 || $codexStore.items.length > 0;
  $: episode = currentEpisode();
  $: manuscriptChars = $editorStore.content.replace(/\s/g, '').length;
  $: episodeArtifacts = artifactsForEpisode($artifactStore, episode);
  $: workArtifacts = $artifactStore.filter((a) => a.episode === 'work').slice(0, 6);
  $: episodePlotRows = $plotStore.grid?.rows.filter((row) => row.episode === episode) ?? [];
  $: outlineRow = outlineRowFor($outlineStore.outline, episode);
  $: previousEp = previousEpisode(episode);
  $: previousSummary = previousEp ? $artifactStore.find((a) => a.step === 'summarize' && a.episode === previousEp) ?? null : null;
  $: previousFixed = previousEp ? $episodeProgressStore[previousEp]?.status === 'fixed' : true;
  $: episodeProgress = $episodeProgressStore[episode]?.status ?? 'planned';
  $: activeRun = $runStore.active;
  $: doneCount = steps.filter((s) => $pipelineStore.stepStatus[s] === 'done').length;
  $: failedSteps = steps.filter((s) => $pipelineStore.stepStatus[s] === 'failed');
  $: qaIssues = $qaStore.report?.issues ?? [];
  $: qaFailCount = qaIssues.filter((i) => i.severity === 'fail').length;
  $: qaWarnCount = qaIssues.filter((i) => i.severity === 'warn').length;
  $: decisions = (activeRun?.humanDecisions ?? []).slice(-6).reverse();
  $: pipelineTab = $uiStore.pipelineTab;
  $: totalTokenEstimate = activeRun ? sumTokenEstimate(activeRun) : 0;
  $: outlineNeeded = !$outlineStore.outline && episodeProgress === 'planned';

  let selectedArtifactId = '';
  $: selectedArtifact = selectedArtifactId
    ? $artifactStore.find((a) => a.id === selectedArtifactId) ?? null
    : episodeArtifacts[0] ?? null;
  $: guidanceSections = pipelineTab === 'context' ? collectGuidance(episode) : [];

  const runners: Record<PipelineStep, () => void | boolean | Promise<void | boolean>> = {
    'episode-brief': runEpisodeBriefAction,
    'scene-plan': runScenePlanAction,
    context: runContextAction,
    draft: () => runDraftAction(draftKind, $aiCommandContextStore ?? undefined),
    analyze: () => runAnalyzeAction(),
    qa: () => runQAAction('current-editor'),
    revise: runRevisionAction,
    summarize: runSummarizeAction,
    commit: runCommitAction
  };

  function collectBibleFiles(nodes: FileNode[]): FileNode[] {
    const out: FileNode[] = [];
    const walk = (list: FileNode[]) => {
      for (const n of list) {
        if (n.kind === 'file' && /(bible|canon|설정)/i.test(n.path) && n.path.endsWith('.md')) out.push(n);
        if (n.children) walk(n.children);
      }
    };
    walk(nodes);
    return out;
  }

  function currentEpisode(): string {
    const path = $editorStore.path || '';
    const m = /story\/chapters\/(ep\d+)/.exec(path);
    return m?.[1] || $episodeStore.currentEpisode || 'ep001';
  }
  function previousEpisode(ep: string): string | null {
    const n = parseInt(ep.replace(/\D/g, ''), 10);
    return Number.isFinite(n) && n > 1 ? `ep${String(n - 1).padStart(3, '0')}` : null;
  }

  function runSettingsSnapshot(): PipelineRun['settings'] {
    return {
      provider: $settingsStore.agentProvider,
      model: $settingsStore.agentModel?.trim() || 'cli-default',
      mockMode: $settingsStore.mockMode,
      draftKind,
      lengthTarget: $draftParamsStore.lengthTarget,
      creativity: $draftParamsStore.creativity,
      styleStrictness: $styleStore.strictness,
      candidateCount: $settingsStore.aiDefaultCandidateCount,
      outlineApproved: $outlineStore.outline?.rows.filter((r) => r.status === 'approved').length ?? 0
    };
  }

  async function run(step: PipelineStep): Promise<boolean> {
    running = step;
    setStepStatus(step, 'running');
    ensureRun(episode, runSettingsSnapshot());
    recordRunStep(step, { status: 'running', startedAt: new Date().toISOString() });
    try {
      const ok = await runners[step]();
      if (ok === false) {
        setStepStatus(step, 'failed');
        recordRunStep(step, { status: 'failed', finishedAt: new Date().toISOString(), error: 'step returned failure' });
        return false;
      }
      setStepStatus(step, 'done');
      const artifact = latestArtifact(step, episode);
      recordRunStep(step, {
        status: 'done',
        finishedAt: new Date().toISOString(),
        artifactId: artifact?.id,
        artifactTitle: artifact?.title
      });
      return true;
    } catch {
      setStepStatus(step, 'failed');
      recordRunStep(step, { status: 'failed', finishedAt: new Date().toISOString(), error: 'step threw' });
      return false;
    } finally {
      running = null;
    }
  }

  async function runAll() {
    toasts.push(`${episode} 파이프라인 전체 실행: ${steps.length}단계`, 'info');
    startRun(episode, runSettingsSnapshot());
    recordHumanDecision('run-all', episode);
    for (const step of steps) {
      const ok = await run(step);
      if (!ok) {
        toasts.push(`${STEP_META[step].label} 단계에서 중단됨 · 산출물을 확인하세요`, 'bad');
        finishRun('failed');
        gotoPipeline('review');
        return;
      }
    }
    finishRun($candidateStore.candidates.length ? 'waiting_for_review' : 'done');
    gotoPipeline('review');
  }

  function resetRunState() {
    recordHumanDecision('reset-pipeline');
    finishRun('done');
    resetPipeline();
  }

  function preview(step: PipelineStep) {
    previewStep = step;
    const guidance = step === 'draft' || step === 'revise' ? buildGuidanceText(episode) : undefined;
    previewText = assemblePrompt(step, $editorStore.content, $codexStore.items, guidance);
  }

  function selectArtifact(id: string) {
    selectedArtifactId = id;
    gotoPipeline('artifact');
  }

  function stepArtifact(step: ArtifactStep): Artifact | null {
    return episodeArtifacts.find((a) => a.step === step) ?? null;
  }

  function formatDuration(ms?: number): string {
    if (!ms || ms < 0) return '';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60_000).toFixed(1)}m`;
  }

  function stepModeLabel(step: PipelineStep): string {
    const kind = STEP_META[step].exec;
    const mode = $pipelineStore.stepModes[step];
    return mode && kind === 'hybrid' ? `${STEP_EXEC_LABEL[kind]}${modeLabel[mode] ?? ''}` : STEP_EXEC_LABEL[kind];
  }

  function sumTokenEstimate(run: PipelineRun): number {
    return Object.values(run.steps).reduce((sum, s) => sum + (s?.tokenEstimate ?? 0), 0);
  }

  async function test() {
    testing = true;
    const r = await testAgentCli($settingsStore.agentCliPath, $settingsStore.agentProvider, $settingsStore.agentOutputMode);
    testMessage = r.ok ? r.stdout : r.stderr || '응답 없음';
    testOk = r.ok;
    testing = false;
    toasts.push(r.ok ? 'AI 실행기 응답 확인' : 'AI 실행기 연결 실패', r.ok ? 'ok' : 'bad');
  }

  function openRunnerPrefs() {
    uiStore.update((s) => ({ ...s, prefsOpen: true, prefsSection: 'aiRunner' }));
  }

  const BIBLE_TEMPLATE = `# 설정집 (바이블)\n\n## 세계관\n- (확정된 세계 규칙을 적습니다)\n\n## 인물\n- 주인공:\n- 조연:\n\n## 규칙\n- (마법/기술/사회 규칙 등 어기면 안 되는 것)\n\n## 열린 떡밥\n- (회수해야 할 복선)\n`;

  async function createBible() {
    const root = $projectStore.current?.rootPath || 'sample-project';
    creatingBible = true;
    try {
      await writeFile(root, 'canon/setting-bible.md', BIBLE_TEMPLATE);
      const nodes = await listTree(root);
      fileTreeStore.update((s) => ({ ...s, nodes }));
      pipelineStore.update((s) => ({ ...s, bibleSkipped: false }));
      toasts.push('설정집 템플릿 생성됨: canon/setting-bible.md', 'ok');
      await openFileInEditor('canon/setting-bible.md');
    } catch (e) {
      toasts.push(`설정집 생성 실패: ${e instanceof Error ? e.message : String(e)}`, 'bad');
    } finally {
      creatingBible = false;
    }
  }
  function skipBible() {
    pipelineStore.update((s) => ({ ...s, bibleSkipped: true }));
    toasts.push('바이블 없이 진행합니다. 프롬프트에는 원고와 회차 메타데이터만 포함됩니다.', 'info');
  }

  onMount(() => {
    if (!$outlineStore.outline && !episodePlotRows.length) gotoPipeline('outline');
  });

  $: if ($aiCommandContextStore?.command === 'continue') draftKind = 'continue';
  $: if ($aiCommandContextStore?.command === 'rewrite') draftKind = 'rewrite';
</script>

<section class="wb" aria-label="AI 파이프라인 워크벤치">
  <!-- 타깃 밴드: 이번 실행이 무엇을 대상으로 하는지 항상 한 눈에 -->
  <header class="target">
    <div class="target-kv">
      <span class="label">회차</span>
      <b class="mono">{episode}</b>
      <span class="ep-status {episodeProgress}">{EPISODE_PROGRESS_LABEL[episodeProgress]}</span>
    </div>
    <div class="target-kv">
      <span class="label">원고</span>
      <b class="mono">{$editorStore.path ?? '미선택'}</b>
      <span class="dim">· {manuscriptChars.toLocaleString()}자</span>
    </div>
    <div class="target-kv">
      <span class="label">baseline</span>
      <b class="mono">{$candidateStore.session?.baselineHash?.slice(0, 8) ?? shortHash($editorStore.content)}</b>
    </div>
    <div class="target-kv">
      <span class="label">실행기</span>
      <b>{providerLabel[$settingsStore.agentProvider] ?? $settingsStore.agentProvider}</b>
      <span class="dim">· {$settingsStore.agentModel?.trim() || 'CLI 기본'}</span>
    </div>
    <div class="target-actions">
      <button class="primary" on:click={runAll} disabled={running !== null}>{episode} 전체 실행</button>
      <button class="ghost" on:click={resetRunState} disabled={running !== null}>상태 초기화</button>
    </div>
  </header>

  <!-- 온보딩 배너: 예전 스테이지 대신 필요한 것만 한 줄로 -->
  {#if !agentReady || !hasBible && !$pipelineStore.bibleSkipped}
    <div class="banners">
      {#if !agentReady}
        <div class="banner warn">
          <div>
            <b>AI 실행기 미연결</b>
            <span>파이프라인은 로컬 폴백으로 돌지만, 브리프·초안·QA·요약이 약해집니다.</span>
          </div>
          <div class="banner-actions">
            <button class="ghost tiny" on:click={test} disabled={testing}>{testing ? '확인 중…' : '연결 테스트'}</button>
            <button class="ghost tiny" on:click={openRunnerPrefs}>실행기 설정</button>
            {#if testOk !== null}<span class="test-state" class:ok={testOk} class:bad={!testOk}>{testOk ? '응답 확인됨' : '실패'}</span>{/if}
          </div>
        </div>
      {/if}
      {#if !hasBible && !$pipelineStore.bibleSkipped}
        <div class="banner info">
          <div>
            <b>설정집(바이블) 없음</b>
            <span>바이블이 있으면 아웃라인·브리프의 근거가 강해집니다.</span>
          </div>
          <div class="banner-actions">
            <button class="ghost tiny" on:click={createBible} disabled={creatingBible}>{creatingBible ? '생성 중…' : '템플릿 만들기'}</button>
            <button class="ghost tiny" on:click={skipBible}>없이 진행</button>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  {#if !previousFixed}
    <p class="notice">이전 회차({previousEp})가 아직 픽스되지 않았습니다. 픽스한 원고가 다음 회차 계획의 연속성 근거가 됩니다.</p>
  {/if}
  {#if outlineNeeded}
    <p class="notice">작품 아웃라인이 없습니다. 「작품 플롯」 탭에서 회별 아웃라인을 먼저 승인하세요.</p>
  {/if}

  <div class="grid">
    <!-- 좌 레일: 단계 테이블 -->
    <aside class="rail" aria-label="파이프라인 단계">
      <div class="rail-section">
        <span class="label">작품 플롯</span>
        {#if $outlineStore.outline}
          <button class="row" on:click={() => gotoPipeline('outline')}>
            <b>{$outlineStore.outline.rows.length}화 아웃라인</b>
            <span>승인 {$outlineStore.outline.rows.filter((r) => r.status === 'approved').length}</span>
          </button>
        {:else}
          <button class="row muted" on:click={() => gotoPipeline('outline')}>
            <b>아웃라인 없음</b>
            <span>바이블에서 회별 계획 만들기</span>
          </button>
        {/if}
      </div>

      <div class="rail-section">
        <span class="label">회차 파이프라인 · {episode}</span>
        <table class="step-table">
          <tbody>
          {#each steps as step, i}
            {@const st = $pipelineStore.stepStatus[step]}
            {@const record = activeRun?.steps[step]}
            {@const artifact = stepArtifact(step)}
            <tr class:on={running === step} class:done={st === 'done'} class:failed={st === 'failed'}>
              <td class="num">{i + 1}</td>
              <td class="name">
                <b>{STEP_META[step].label}</b>
                <span class="exec-badge {STEP_META[step].exec}">{stepModeLabel(step)}</span>
              </td>
              <td class="state">
                {#if running === step}
                  <span class="st run">실행 중</span>
                {:else}
                  <span class="st {st}">{statusLabel[st]}</span>
                  {#if record?.durationMs}<span class="dur">{formatDuration(record.durationMs)}</span>{/if}
                {/if}
              </td>
              <td class="act">
                {#if step === 'draft'}
                  <select class="kind" bind:value={draftKind} title="후보 종류">
                    {#each draftKinds as [k, label]}<option value={k}>{label}</option>{/each}
                  </select>
                {/if}
                {#if artifact}
                  <button class="row-btn" on:click={() => selectArtifact(artifact.id)} title="산출물 보기">산출물</button>
                {/if}
                <button class="row-btn" on:click={() => preview(step)} title="프롬프트 미리보기">프롬프트</button>
                <button class="row-btn" on:click={() => run(step)} disabled={running !== null}>실행</button>
              </td>
            </tr>
          {/each}
          </tbody>
        </table>
      </div>

      <div class="rail-section">
        <span class="label">Run 히스토리</span>
        {#if $runStore.history.length === 0}
          <p class="empty-line">완료된 run이 없습니다.</p>
        {:else}
          <table class="history">
            <tbody>
            {#each $runStore.history.slice(0, 6) as run}
              <tr>
                <td class="mono">{run.runId.replace(/^run_/, '').slice(0, 15)}</td>
                <td>{run.episode}</td>
                <td class="st {run.status === 'failed' ? 'failed' : run.status === 'done' ? 'done' : 'idle'}">{run.status}</td>
              </tr>
            {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </aside>

    <!-- 중앙: 뷰어 (탭 전환) -->
    <section class="center">
      <nav class="ctabs" aria-label="뷰어 전환">
        <button class:on={pipelineTab === 'artifact'} on:click={() => gotoPipeline('artifact')}>산출물</button>
        <button class:on={pipelineTab === 'prompt'} on:click={() => gotoPipeline('prompt')}>프롬프트</button>
        <button class:on={pipelineTab === 'context'} on:click={() => gotoPipeline('context')}>컨텍스트</button>
        <button class:on={pipelineTab === 'outline'} on:click={() => gotoPipeline('outline')}>작품 플롯</button>
        <button class:on={pipelineTab === 'review'} on:click={() => gotoPipeline('review')}>검토</button>
      </nav>

      <div class="viewer">
        {#if pipelineTab === 'outline'}
          <OutlineTable />
        {:else if pipelineTab === 'artifact'}
          <div class="artifact-view">
            <div class="artifact-strip">
              {#if workArtifacts.length}
                <span class="strip-label">작품 단위</span>
                {#each workArtifacts as a}
                  <button class:on={selectedArtifact?.id === a.id} on:click={() => selectArtifact(a.id)}>
                    <b>{a.step === 'outline' ? '아웃라인' : STEP_META[a.step as PipelineStep]?.label ?? a.step}</b>
                    <span>{a.title}</span>
                  </button>
                {/each}
              {/if}
              <span class="strip-label">{episode} 산출물</span>
              {#each episodeArtifacts as a}
                <button class:on={selectedArtifact?.id === a.id} on:click={() => selectArtifact(a.id)}>
                  <b>{STEP_META[a.step as PipelineStep]?.label ?? a.step}</b>
                  <span>{a.title}</span>
                </button>
              {/each}
              {#if !episodeArtifacts.length && !workArtifacts.length}
                <p class="empty-viewer">아직 산출물이 없습니다. 좌측에서 단계를 실행하면 여기에 남습니다.</p>
              {/if}
            </div>
            {#if selectedArtifact}
              <div class="artifact-head">
                <b>{selectedArtifact.title}</b>
                <span>{new Date(selectedArtifact.createdAt).toLocaleString()}{selectedArtifact.previewOnly ? ' · 미리보기 (전체는 프로젝트 파일)' : ''}</span>
                {#if selectedArtifact.latestPath}<code class="mono">{selectedArtifact.latestPath}</code>{/if}
              </div>
              <div class="reading"><MarkdownPreview content={selectedArtifact.content} /></div>
            {/if}
          </div>
        {:else if pipelineTab === 'prompt'}
          <div class="prompt-view">
            <div class="prompt-tabs">
              {#each steps as s}
                <button class:on={previewStep === s} on:click={() => preview(s)}>{STEP_META[s].label}</button>
              {/each}
            </div>
            {#if previewStep}
              <pre class="pre">{previewText}</pre>
            {:else}
              <p class="empty-viewer">단계를 선택하면 실제로 전송될 프롬프트가 여기에 표시됩니다.</p>
            {/if}
          </div>
        {:else if pipelineTab === 'context'}
          <div class="context-head">
            <b>초안·수정 프롬프트에 들어갈 참고 블록</b>
            <span>{guidanceSections.length}개 섹션 · 추정 {guidanceSections.reduce((sum, s) => sum + s.tokenEstimate, 0).toLocaleString()} tok</span>
          </div>
          {#if guidanceSections.length === 0}
            <p class="empty-viewer">아직 조립될 컨텍스트가 없습니다. 브리프·장면계획·컨텍스트 단계를 실행하거나 문체 지침을 확정하세요.</p>
          {:else}
            <ul class="context-list">
              {#each guidanceSections as sec}
                <li>
                  <details>
                    <summary>
                      <span class="hardness {sec.hardness}">{sec.hardness === 'hard' ? '규칙' : sec.hardness === 'soft' ? '지향' : '참고'}</span>
                      <b>{sec.label}</b>
                      <span class="dim">{sec.source} · ≈{sec.tokenEstimate.toLocaleString()}t</span>
                    </summary>
                    <pre class="pre inline">{sec.content}</pre>
                  </details>
                </li>
              {/each}
            </ul>
          {/if}
        {:else}
          <div class="review">
            <section class="review-main"><CandidateDiffPanel /></section>
            <section class="review-side">
              <QADashboard />
              <RevisionPanel />
              <RepetitionPanel />
            </section>
          </div>
        {/if}
      </div>
    </section>

    <!-- 우 인스펙터 -->
    <aside class="inspector" aria-label="실행 정보">
      <div class="rail-section">
        <span class="label">입력 기준</span>
        <dl class="kv">
          <div><dt>아웃라인</dt><dd class:warn={!outlineRow || outlineRow.status !== 'approved'}>{outlineRow ? `${outlineRow.status === 'approved' ? '승인' : '검토'} · ${outlineRow.title}` : '없음'}</dd></div>
          <div><dt>회차 플롯</dt><dd class:warn={episodePlotRows.length === 0}>{episodePlotRows.length ? `${episodePlotRows.length}개 장면` : 'row 없음'}</dd></div>
          <div><dt>설정 자료</dt><dd>{bibleFiles.length}개 문서 · {$codexStore.items.length}개 항목</dd></div>
          <div><dt>이전 회차</dt><dd>{previousEp ? `${previousEp} · ${previousSummary ? '요약 있음' : '요약 없음'}${previousFixed ? '' : ' · 미픽스'}` : '첫 회차'}</dd></div>
        </dl>
      </div>

      <div class="rail-section">
        <span class="label">집필 파라미터</span>
        <dl class="kv">
          <div><dt>분량</dt><dd>
            <select bind:value={$draftParamsStore.lengthTarget}>
              {#each lengthOptions as [v, label]}<option value={v}>{label}</option>{/each}
            </select>
          </dd></div>
          <div><dt>창의성</dt><dd>
            <select bind:value={$draftParamsStore.creativity}>
              {#each creativityOptions as c}<option value={c}>{CREATIVITY_LABEL[c]}</option>{/each}
            </select>
          </dd></div>
          <div><dt>후보 수</dt><dd>{$settingsStore.aiDefaultCandidateCount}개</dd></div>
          <div><dt>추가 지시</dt><dd><input bind:value={$draftParamsStore.notes} placeholder="예: 에이라 시점 유지" /></dd></div>
        </dl>
      </div>

      <div class="rail-section">
        <span class="label">사용량 · 이번 run</span>
        {#if activeRun && Object.keys(activeRun.steps).length}
          <dl class="kv">
            {#each Object.entries(activeRun.steps) as [step, rec]}
              {#if rec && (rec.tokenEstimate || rec.durationMs)}
                <div><dt>{STEP_META[step as PipelineStep]?.label ?? step}</dt><dd>
                  {#if rec.tokenEstimate}<span class="est">≈{rec.tokenEstimate.toLocaleString()}t</span>{/if}
                  {#if rec.durationMs}<span class="dim">· {formatDuration(rec.durationMs)}</span>{/if}
                  {#if rec.mode === 'fallback'}<span class="fallback-tag">폴백</span>{/if}
                </dd></div>
              {/if}
            {/each}
            <div><dt>합계</dt><dd><span class="est">≈{totalTokenEstimate.toLocaleString()}t (추정)</span></dd></div>
          </dl>
        {:else}
          <p class="empty-line">아직 실행 기록이 없습니다.</p>
        {/if}
      </div>

      <div class="rail-section">
        <span class="label">위험 · 결정</span>
        <dl class="kv">
          <div><dt>QA</dt><dd class:bad={$qaStore.report?.verdict === 'fail'} class:warn={$qaStore.report?.verdict === 'warn'}>
            {$qaStore.report ? `${$qaStore.report.verdict} (${$qaStore.report.score ?? '-'})` : '미실행'}
            {#if qaIssues.length}· fail {qaFailCount} / warn {qaWarnCount}{/if}
          </dd></div>
          <div><dt>실패 단계</dt><dd class:bad={failedSteps.length > 0}>{failedSteps.length ? failedSteps.map((s) => STEP_META[s].label).join(', ') : '없음'}</dd></div>
          <div><dt>후보</dt><dd>{$candidateStore.candidates.length}개{$candidateStore.session ? ` · baseline ${$candidateStore.session.baselineHash.slice(0, 8)}` : ''}</dd></div>
          <div><dt>완료</dt><dd>{doneCount}/{steps.length}</dd></div>
        </dl>
        {#if decisions.length}
          <ul class="decisions">
            {#each decisions as d}
              <li><b>{d.action}</b><span>{new Date(d.at).toLocaleTimeString()}{d.detail ? ` · ${d.detail}` : ''}</span></li>
            {/each}
          </ul>
        {/if}
      </div>
    </aside>
  </div>
</section>

{#if previewStep && pipelineTab !== 'prompt'}
  <div class="pv-backdrop">
    <button class="pv-close-area" aria-label="닫기" on:click={() => (previewStep = null)}></button>
    <div class="pv" role="dialog" aria-modal="true">
      <div class="pv-head">
        <span class="label">프롬프트 미리보기 · {STEP_META[previewStep].label}</span>
        <button class="ghost" on:click={() => (previewStep = null)}>닫기</button>
      </div>
      <pre class="pv-body">{previewText}</pre>
      <div class="pv-foot">
        <button class="primary" on:click={() => { const s = previewStep; previewStep = null; if (s) run(s); }}>이 프롬프트로 실행</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .wb { min-height: 0; display: grid; grid-template-rows: auto auto auto minmax(0, 1fr); background: var(--bg-1); }

  /* 타깃 밴드 */
  .target {
    display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
    padding: 10px 18px; border-bottom: 1px solid var(--line);
    background: var(--bg-2);
  }
  .target-kv { display: grid; gap: 1px; min-width: 0; }
  .target-kv b { font-size: 13px; font-weight: 650; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 320px; }
  .target-kv .dim { color: var(--faint); font-size: 11px; }
  .target-actions { margin-left: auto; display: flex; gap: 8px; }
  .ep-status { display: inline-block; margin-left: 8px; padding: 1px 7px; border-radius: 3px; font-size: 10.5px; font-weight: 700; }
  .ep-status.planned { color: var(--muted); background: var(--chip, var(--accent-soft)); }
  .ep-status.drafting { color: var(--accent); background: var(--accent-soft); }
  .ep-status.fixed { color: var(--ok); background: var(--ok-soft); }

  .banners { display: grid; gap: 0; padding: 8px 18px; border-bottom: 1px solid var(--line); background: var(--bg-1); }
  .banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0; }
  .banner + .banner { border-top: 1px dashed var(--line); }
  .banner b { color: var(--text); font-size: 12.5px; margin-right: 8px; }
  .banner span { color: var(--muted); font-size: 12px; }
  .banner.warn b { color: var(--warn); }
  .banner-actions { display: flex; gap: 6px; align-items: center; }
  .test-state { font-size: 11px; }
  .test-state.ok { color: var(--ok); } .test-state.bad { color: var(--bad); }

  .notice { margin: 0; padding: 6px 18px; border-bottom: 1px solid var(--line); color: var(--warn); font-size: 12px; background: var(--warn-soft); }

  .grid { display: grid; grid-template-columns: 320px minmax(0, 1fr) 280px; min-height: 0; }
  .rail, .inspector {
    min-height: 0; overflow: auto; padding: 12px 14px;
    background: var(--bg-1); display: grid; gap: 14px; align-content: start;
  }
  .rail { border-right: 1px solid var(--line); }
  .inspector { border-left: 1px solid var(--line); }
  .rail-section { display: grid; gap: 6px; }
  .label { color: var(--faint); font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

  .row { display: grid; gap: 1px; text-align: left; padding: 6px 4px; border: 0; border-radius: 4px; background: transparent; }
  .row:hover { background: var(--accent-soft); }
  .row b { color: var(--text); font-size: 12.5px; font-weight: 650; }
  .row span { color: var(--muted); font-size: 11.5px; }
  .row.muted b { color: var(--muted); }

  .step-table { border-collapse: collapse; width: 100%; }
  .step-table tr { border-bottom: 1px solid var(--line); }
  .step-table tr.done .num { color: var(--ok); }
  .step-table tr.failed .num { color: var(--bad); }
  .step-table tr.on .num { color: var(--accent); }
  .step-table td { padding: 5px 3px; font-size: 12px; vertical-align: middle; }
  .num { width: 20px; color: var(--faint); font-family: ui-monospace, monospace; font-weight: 700; text-align: right; padding-right: 6px; }
  .name b { display: block; color: var(--text); font-size: 12px; font-weight: 650; }
  .exec-badge { display: inline-block; margin-top: 2px; padding: 0 5px; border: 1px solid var(--line-strong); border-radius: 3px; color: var(--muted); font-size: 9.5px; font-weight: 700; text-transform: none; }
  .exec-badge.static { color: var(--faint); }
  .exec-badge.hybrid { color: var(--accent-2); border-color: var(--accent-2); }
  .state { text-align: left; white-space: nowrap; }
  .st { font-size: 11px; }
  .st.done { color: var(--ok); }
  .st.failed { color: var(--bad); }
  .st.run { color: var(--accent); }
  .st.idle { color: var(--faint); }
  .dur { margin-left: 4px; color: var(--faint); font-variant-numeric: tabular-nums; font-size: 10.5px; }
  .act { text-align: right; white-space: nowrap; }
  .row-btn { border: 1px solid var(--line); background: transparent; border-radius: 3px; padding: 2px 6px; font-size: 10.5px; color: var(--muted); margin-left: 2px; }
  .row-btn:hover:not(:disabled) { color: var(--text); border-color: var(--line-strong); }
  .kind { font-size: 11px; padding: 2px 4px; margin-right: 2px; }

  .history { border-collapse: collapse; width: 100%; }
  .history td { padding: 4px 4px; border-bottom: 1px solid var(--line); font-size: 11px; }
  .history .mono { color: var(--muted); }

  .center { min-width: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); background: var(--bg-desk); }
  .ctabs { display: flex; gap: 2px; padding: 6px 14px; border-bottom: 1px solid var(--line); background: var(--bg-1); }
  .ctabs button { padding: 5px 12px; border-radius: 4px; color: var(--muted); font-size: 12.5px; background: transparent; border: 0; }
  .ctabs button.on { background: var(--accent-soft); color: var(--text); font-weight: 650; }
  .viewer { min-height: 0; overflow: auto; padding: 14px 20px; display: grid; align-content: start; gap: 12px; }

  .artifact-view { display: grid; gap: 12px; }
  .artifact-strip { display: grid; border-top: 1px solid var(--line); }
  .artifact-strip .strip-label { padding: 8px 2px 4px; color: var(--faint); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .07em; }
  .artifact-strip button {
    display: grid; grid-template-columns: 140px minmax(0, 1fr); gap: 10px;
    text-align: left; padding: 6px 4px; border: 0; border-radius: 0; border-bottom: 1px solid var(--line); background: transparent;
  }
  .artifact-strip button.on { background: var(--accent-soft); }
  .artifact-strip b { color: var(--text); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .artifact-strip span { color: var(--muted); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .artifact-head { display: grid; gap: 3px; padding: 8px 0; border-bottom: 1px solid var(--line); }
  .artifact-head b { color: var(--text); font-size: 13.5px; }
  .artifact-head span { color: var(--muted); font-size: 11.5px; }
  .artifact-head code.mono { width: fit-content; color: var(--faint); background: var(--accent-soft); border-radius: 3px; padding: 1px 6px; font-size: 10.5px; }
  .reading { max-width: 860px; }
  .reading :global(.preview) { border-left: 0; padding: 8px 0 24px; font-size: 14.5px; line-height: 1.9; background: transparent; }

  .prompt-view { display: grid; gap: 8px; }
  .prompt-tabs { display: flex; gap: 4px; flex-wrap: wrap; padding-bottom: 6px; border-bottom: 1px solid var(--line); }
  .prompt-tabs button { padding: 3px 9px; border: 1px solid var(--line); background: transparent; border-radius: 3px; color: var(--muted); font-size: 11.5px; }
  .prompt-tabs button.on { background: var(--accent-soft); color: var(--text); border-color: var(--accent); }

  .pre { margin: 0; white-space: pre-wrap; color: var(--text); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 1.7; max-width: 920px; }
  .pre.inline { color: var(--muted); padding: 8px 0; }

  .context-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding-bottom: 6px; border-bottom: 1px solid var(--line); }
  .context-head b { color: var(--text); font-size: 13px; }
  .context-head span { color: var(--faint); font-size: 11.5px; }
  .context-list { list-style: none; margin: 0; padding: 0; }
  .context-list li { border-bottom: 1px solid var(--line); }
  .context-list summary { display: flex; align-items: center; gap: 10px; padding: 8px 2px; cursor: pointer; }
  .context-list summary b { color: var(--text); font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dim { margin-left: auto; color: var(--faint); font-size: 10.5px; }
  .hardness { padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 800; }
  .hardness.hard { color: var(--bad); background: var(--bad-soft); }
  .hardness.soft { color: var(--accent); background: var(--accent-soft); }
  .hardness.reference { color: var(--muted); background: var(--accent-soft); }

  .review { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(280px, .8fr); gap: 14px; align-items: start; }
  .review-main { min-width: 0; border: 1px solid var(--line); background: var(--bg-2); overflow: hidden; min-height: 400px; }
  .review-side { min-width: 0; display: grid; gap: 12px; align-content: start; }

  .kv { display: grid; margin: 0; border-top: 1px solid var(--line); }
  .kv > div { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 12px; }
  .kv dt { color: var(--faint); font-size: 11px; }
  .kv dd { margin: 0; color: var(--text); font-size: 12px; overflow-wrap: anywhere; }
  .kv dd.bad { color: var(--bad); }
  .kv dd.warn { color: var(--warn); }
  .kv select, .kv input { width: 100%; font-size: 12px; }
  .est { color: var(--accent); font-variant-numeric: tabular-nums; }
  .fallback-tag { color: var(--warn); background: var(--warn-soft); padding: 0 5px; border-radius: 3px; font-size: 10px; margin-left: 6px; }

  .decisions { list-style: none; margin: 6px 0 0; padding: 0; border-top: 1px solid var(--line); }
  .decisions li { display: grid; gap: 1px; padding: 5px 0; border-bottom: 1px solid var(--line); font-size: 11px; }
  .decisions b { color: var(--text); font-family: ui-monospace, monospace; }
  .decisions span { color: var(--faint); }

  .empty-line, .empty-viewer { margin: 6px 0; color: var(--faint); font-size: 12px; line-height: 1.6; }
  .empty-viewer { padding: 32px 0; text-align: center; }

  .pv-backdrop { position: fixed; inset: 0; background: color-mix(in srgb, var(--bg) 34%, transparent); z-index: 150; display: flex; align-items: center; justify-content: center; }
  .pv-close-area { position: absolute; inset: 0; border: 0; background: transparent; }
  .pv { position: relative; width: min(720px, 92vw); max-height: 82vh; display: flex; flex-direction: column; background: var(--bg-2); border: 1px solid var(--line-strong); box-shadow: var(--shadow-pop, 0 12px 32px rgba(0,0,0,.15)); }
  .pv-head { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--line); }
  .pv-body { margin: 0; padding: 16px; overflow: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 1.65; color: var(--text); white-space: pre-wrap; }
  .pv-foot { padding: 10px 16px; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; }

  @media (max-width: 1200px) {
    .grid { grid-template-columns: minmax(0, 1fr); }
    .rail, .inspector { border-right: 0; border-left: 0; border-bottom: 1px solid var(--line); }
    .review { grid-template-columns: 1fr; }
  }
</style>
