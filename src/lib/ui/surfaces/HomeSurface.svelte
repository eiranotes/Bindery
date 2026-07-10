<script lang="ts">
  // 홈 - 다음 작업 센터. 설명 화면이 아니라 실행 화면이다.
  // 상태에서 계산된 CTA 하나를 크게 보여주고, 보조 정보는 작은 카드로만 둔다.
  import {
    ctx, mode, currentEpisode, pendingProposals, progress, episodes, withBusy,
    busy, activeRun, intentNote, autopilotKick, clearRunFeed, toast, project, refreshAll,
    projectRefreshing, settings, usageSummary
  } from '$lib/stores/app';
  import { loadWorkflowSnapshot, computeNextStep, type NextStep } from '$lib/harness/workflow';
  import {
    runProjectStarterAutopilot, adoptStarterIdea, ensureStoryFoundation,
    ensureEpisodeScaffold, type FoundationResult
  } from '$lib/harness/autopilot';
  import { nextEpisode } from '$lib/harness/episode';
  import { clip, nowIso } from '$lib/core/text';
  import {
    SOURCE_FILE_ACCEPT, SOURCE_UPLOAD_MAX_TOTAL_CHARS,
    formatSourceBytes, readSourceUploads
  } from '$lib/harness/sourceUploads';
  import type { SourceUpload, SourceUploadProgress } from '$lib/harness/sourceUploads';
  import { detectPlanningPackage, importPlanningPackage } from '$lib/harness/sourcePackage';
  import type { IdeaFile } from '$lib/harness/ideas';
  import LiveRunPanel from '../LiveRunPanel.svelte';

  const SOURCE_PROMPT_MAX_CHARS = 18_000;

  let step = $state<NextStep | null>(null);
  let starterIdeas = $state<IdeaFile[]>([]);
  let sourceUploads = $state<SourceUpload[]>([]);
  let sourceInput = $state<HTMLInputElement | null>(null);
  let sourceReading = $state(false);
  let sourceProgress = $state<SourceUploadProgress | null>(null);
  let sourceAbort: AbortController | null = null;
  let workflowRefreshToken = 0;
  const running = $derived(Boolean($busy || $activeRun));
  const planningPackage = $derived(detectPlanningPackage(sourceUploads));
  const sourceSummary = $derived.by(() => {
    if (!sourceUploads.length) return '선택한 자료 없음';
    const chars = sourceUploads.reduce((sum, file) => sum + file.chars, 0);
    return `${sourceUploads.length}개 · ${chars.toLocaleString()}자`;
  });

  $effect(() => {
    void $progress;
    void $episodes;
    void $pendingProposals;
    void $projectRefreshing;
    const token = ++workflowRefreshToken;
    if ($projectRefreshing) return;
    queueMicrotask(() => {
      if (token === workflowRefreshToken) void refresh();
    });
  });

  async function refresh() {
    try {
      step = computeNextStep(await loadWorkflowSnapshot(ctx()));
    } catch {
      step = null;
    }
  }

  async function go() {
    if (!step || sourceReading) return;
    if (step.action === 'startProject') {
      clearRunFeed();
      const starterNote = [$intentNote.trim(), sourcePromptText()].filter(Boolean).join('\n\n');
      const sourceCount = sourceUploads.length;
      const r = await withBusy('기획 후보 생성', async () => {
        await saveSourceRawIfNeeded();
        return runProjectStarterAutopilot(ctx(), starterNote);
      }, false);
      if (!r) return;
      if (r.error) {
        toast(r.error, 'warn');
        return;
      }
      starterIdeas = r.ideas;
      intentNote.set('');
      if (sourceCount) toast('업로드 자료 저장됨: notes/source-raw.md', 'ok');
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
    sourceUploads = [];
    const bible = r.bibleSource === 'agent' ? 'AI 바이블' : r.bibleSource === 'fallback' ? '로컬 바이블' : '바이블 없음';
    toast(`기획 채택됨 - 세계관 자산 ${r.assets}건 → ${bible} → 플롯 초안 ${r.plotEpisodes}화가 준비됐습니다.`, 'ok');
    await refreshAll();
    await refresh();
  }

  async function importStructuredPackage() {
    const pkg = planningPackage;
    if (!pkg || sourceReading) return;
    clearRunFeed();
    const r = await withBusy('구조화 기획 가져오기', async () => {
      await saveSourceRawIfNeeded();
      const imported = await importPlanningPackage(ctx(), pkg);
      const foundation = await ensureStoryFoundation(ctx(), {
        title: $project?.title ?? '작품',
        notes: imported.plotPrompt,
        episode: 'ep001',
        forcePlot: true
      });
      return { imported, foundation };
    }, false);
    if (!r) return;
    sourceUploads = [];
    toast(
      `기획 패키지 적용: 기준 파일 ${r.imported.writtenPaths.length}개, ${foundationLabel(r.foundation)}.`,
      r.foundation.plotSource === 'fallback' ? 'warn' : 'ok'
    );
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
  const foundationReady = $derived(Boolean(step && !['startProject', 'prepareStoryFoundation'].includes(step.action)));
  const agentStatus = $derived($settings.offline ? '오프라인' : $settings.command ? '연결됨' : '미설정');
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

  function sourcePromptText(): string {
    if (!sourceUploads.length) return '';
    // 경로 역할이 뚜렷한 문서를 먼저 넣고, 파일별 예산을 공평하게 나눈다.
    const priority = (file: SourceUpload) => /\/(canon|plot|world|status|active)\//i.test(file.name) ? 0 : 1;
    const selected = [...sourceUploads]
      .sort((a, b) => priority(a) - priority(b))
      .slice(0, 40);
    const metadataBudget = selected.length * 150;
    const perFileBudget = Math.max(80, Math.floor(Math.max(0, SOURCE_PROMPT_MAX_CHARS - 1200 - metadataBudget) / selected.length));
    const body = selected.map((file) => [
      `## ${file.name}`,
      `크기: ${formatSourceBytes(file.size)}, 읽은 글자: ${file.chars.toLocaleString()}자${file.truncated ? ', 앱 입력 한도에서 잘림' : ''}`,
      '',
      clip(file.content, perFileBudget)
    ].join('\n')).join('\n\n');
    return clip([
      '[업로드 기획 자료]',
      '아래 자료를 우선 근거로 삼아 기획 후보를 만들어라. 원문 저장 위치: notes/source-raw.md.',
      `프롬프트 포함: ${selected.length}/${sourceUploads.length}개 파일, 파일당 최대 ${perFileBudget.toLocaleString()}자.`,
      '',
      body
    ].join('\n'), SOURCE_PROMPT_MAX_CHARS);
  }

  function renderIndented(content: string): string {
    const source = content.trimEnd() || '(빈 파일)';
    return source.split('\n').map((line) => `    ${line}`).join('\n');
  }

  function renderSourceRaw(): string {
    const sections = sourceUploads.flatMap((file) => [
      `## ${file.name}`,
      '',
      `- 크기: ${formatSourceBytes(file.size)}`,
      `- 읽은 글자: ${file.chars.toLocaleString()}자${file.truncated ? ' (앱 입력 한도에서 잘림)' : ''}`,
      '',
      renderIndented(file.content),
      ''
    ]);
    return [
      '# 업로드 기획 자료',
      '',
      `- 저장: ${nowIso()}`,
      `- 파일 수: ${sourceUploads.length}`,
      '',
      ...sections
    ].join('\n');
  }

  async function saveSourceRawIfNeeded(): Promise<void> {
    if (!sourceUploads.length) return;
    const c = ctx();
    await c.bridge.writeFile(c.root, 'notes/source-raw.md', renderSourceRaw());
  }

  async function chooseSourceFiles(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;

    sourceAbort?.abort();
    sourceAbort = new AbortController();
    sourceReading = true;
    sourceProgress = { phase: 'reading', name: files[0].name, current: 0, total: files.length };
    try {
      const { uploads, skipped, zipEntries } = await readSourceUploads(files, {
        signal: sourceAbort.signal,
        onProgress: (progress) => (sourceProgress = progress)
      });
      const combined = [...sourceUploads, ...uploads];
      const seen = new Set<string>();
      let keptChars = 0;
      let limitDropped = 0;
      sourceUploads = combined.filter((file) => {
        const key = `${file.name}\0${file.chars}\0${file.content.slice(0, 120)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        if (keptChars + file.chars > SOURCE_UPLOAD_MAX_TOTAL_CHARS) {
          limitDropped++;
          return false;
        }
        keptChars += file.chars;
        return true;
      });

      if (uploads.length > 0) {
        const zipPart = zipEntries > 0 ? ` (zip에서 ${zipEntries}개 펼침)` : '';
        toast(`자료 파일 ${uploads.length}개를 불러왔습니다${zipPart}`, 'ok');
      }
      if (skipped.length > 0) {
        const safety = skipped.filter((item) => item.reason.includes('limit') || item.reason.includes('large')).length;
        toast(`자료 ${skipped.length}개를 건너뛰었습니다${safety ? ` (안전 제한 ${safety}개)` : ''}`, 'warn');
      }
      if (limitDropped) toast(`전체 자료 안전 한도를 넘어 ${limitDropped}개를 추가하지 않았습니다`, 'warn');
    } catch (error) {
      if (sourceAbort?.signal.aborted) toast('자료 읽기를 취소했습니다', 'info');
      else toast(`자료 읽기 실패: ${error instanceof Error ? error.message : String(error)}`, 'bad');
    } finally {
      sourceReading = false;
      sourceProgress = null;
      sourceAbort = null;
    }
  }

  function cancelSourceRead() {
    sourceAbort?.abort();
  }

  function removeSourceFile(id: string) {
    sourceUploads = sourceUploads.filter((file) => file.id !== id);
  }
</script>

<div class="surface surface-frame">
  <section class="workbench" aria-label="다음 작업">
    <div class="col">
    {#if running}
      <LiveRunPanel title="작업 실행 중" />
    {:else if starterIdeas.length}
      <span class="kicker">기획안 확인</span>
      <p class="section-note">이 기획으로 세계관과 플롯 기본 구성을 시작합니다.</p>
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
      <div class="cta-stack">
        {#if showIntent}
          <label class="intent-field">
            <span>방향 메모</span>
            <input class="grow" bind:value={$intentNote} placeholder="원하는 방향이 있으면 한 줄로" onkeydown={(e) => e.key === 'Enter' && go()} />
          </label>
        {/if}
        <button class="primary big" onclick={go} disabled={sourceReading}>{sourceReading ? '자료 읽는 중...' : step.cta}</button>
      </div>

      {#if step.action === 'startProject'}
        <section class="source-intake" aria-label="기획 자료 업로드">
          <div class="source-head">
            <div>
              <strong>자료 파일</strong>
              <span>{sourceSummary}</span>
            </div>
            <div class="row source-actions">
              {#if sourceReading}
                <button class="quiet danger" onclick={cancelSourceRead}>읽기 취소</button>
              {/if}
              {#if sourceUploads.length}
                <button class="quiet" onclick={() => (sourceUploads = [])} disabled={sourceReading}>비우기</button>
              {/if}
              <button class="quiet" onclick={() => sourceInput?.click()} disabled={sourceReading}>파일 추가</button>
              <input
                bind:this={sourceInput}
                class="file-input"
                type="file"
                multiple
                accept={SOURCE_FILE_ACCEPT}
                onchange={chooseSourceFiles}
              />
            </div>
          </div>
          {#if sourceProgress}
            <div class="source-progress" role="status" aria-live="polite">
              <span>{sourceProgress.phase === 'expanding' ? 'ZIP 펼치는 중' : '파일 읽는 중'}</span>
              <b>{sourceProgress.current}/{sourceProgress.total}</b>
              <span class="source-progress-name" title={sourceProgress.name}>{sourceProgress.name}</span>
            </div>
          {/if}
          {#if planningPackage}
            <div class="package-ready">
              <div>
                <b>구조화 기획 패키지 감지</b>
                <span>{planningPackage.archiveName} / {planningPackage.files.length}개 문서 / {planningPackage.totalChars.toLocaleString()}자</span>
                <span>설정, 인물, 세계, 플롯, 재개 문서를 보존하고 플롯 구조만 정리합니다.</span>
              </div>
              <button class="primary" onclick={importStructuredPackage} disabled={running || sourceReading}>이 구조로 바로 시작</button>
            </div>
          {/if}
          {#if sourceUploads.length}
            <div class="source-list">
              {#each sourceUploads as file (file.id)}
                <div class="source-row">
                  <div class="source-meta">
                    <b>{file.name}</b>
                    <span>{formatSourceBytes(file.size)} / {file.chars.toLocaleString()}자{file.truncated ? ' / 잘림' : ''}</span>
                  </div>
                  <button class="quiet danger" onclick={() => removeSourceFile(file.id)}>삭제</button>
                </div>
              {/each}
            </div>
          {/if}
          <p>원문은 notes/source-raw.md에 모두 저장됩니다. 일반 기획 후보에는 최대 40개 파일, 총 18,000자만 공평하게 발췌합니다.</p>
        </section>
      {/if}

      <nav class="aux" aria-label="보조 작업">
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
      </nav>
    {:else}
      <p class="empty">프로젝트 상태를 읽는 중…</p>
    {/if}
    </div>
  </section>

  <aside class="project-ledger" aria-label="프로젝트 상태">
    <div class="ledger-head">
      <h2>프로젝트 상태</h2>
      {#if $projectRefreshing}<span class="chip muted">읽는 중</span>{/if}
    </div>
    <dl>
      <div>
        <dt>AI 실행기</dt>
        <dd class:warn={agentStatus !== '연결됨'}>{agentStatus}</dd>
      </div>
      <div>
        <dt>설정 바이블</dt>
        <dd>{foundationReady ? '준비됨' : '준비 전'}</dd>
      </div>
      <div>
        <dt>플롯</dt>
        <dd>{foundationReady ? '준비됨' : '준비 전'}</dd>
      </div>
      <div>
        <dt>현재 회차</dt>
        <dd class="mono accent">{$currentEpisode}</dd>
      </div>
      <div>
        <dt>보류</dt>
        <dd>{$pendingProposals}건</dd>
      </div>
      <div>
        <dt>이번 달 사용량</dt>
        <dd class="mono">${$usageSummary.thisMonth.costUsd.toFixed(2)}</dd>
      </div>
    </dl>
    <div class="ledger-actions">
      <button class="ledger-link" onclick={() => mode.set('notes')}>
        <span><b>작품노트</b><small>인물, 세계, 플롯, 떡밥</small></span><i>열기</i>
      </button>
      <button class="ledger-link" onclick={() => mode.set('settings')}>
        <span><b>실행기 설정</b><small>{$settings.command || '연결 필요'}</small></span><i>열기</i>
      </button>
    </div>
  </aside>
</div>

<style>
  .surface { display: grid; grid-template-columns: minmax(0, 1fr) 304px; gap: var(--space-7); align-items: start; }
  .workbench { min-width: 0; }
  .col { display: grid; gap: var(--space-3); align-content: start; }
  .kicker { color: var(--faint); font-size: 11px; font-weight: 800; letter-spacing: .04em; }
  .section-note { margin: calc(var(--space-2) * -1) 0 0; color: var(--muted); font-size: 12px; }
  h1 { margin: 0; font-size: 26px; line-height: 1.28; letter-spacing: -0.012em; font-weight: 750; }
  .lead { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.65; max-width: 56ch; }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .cta-stack { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-2); align-items: end; margin-top: var(--space-2); }
  .intent-field { display: grid; gap: var(--space-1); color: var(--muted); font-size: 11px; }
  .grow { width: 100%; min-width: 220px; padding: var(--space-2) var(--space-3); }
  .big { min-height: 40px; padding: var(--space-2) var(--space-6); font-size: 13.5px; }

  .source-intake {
    display: grid;
    gap: var(--space-2);
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    padding: var(--space-3) 0;
  }
  .source-head {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  }
  .source-head > div:first-child { display: grid; gap: 4px; }
  .source-head strong { font-size: 13px; }
  .source-head span,
  .source-intake p,
  .source-meta span {
    color: var(--muted);
    font-size: 11.5px;
  }
  .source-actions { justify-content: flex-end; }
  .file-input { display: none; }
  .source-list { display: grid; gap: 8px; }
  .source-progress,
  .package-ready {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: var(--space-2) var(--space-3);
    background: var(--bg-1);
    font-size: 12px;
  }
  .source-progress-name {
    min-width: 0;
    overflow: hidden;
    color: var(--muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .package-ready { justify-content: space-between; align-items: flex-start; }
  .package-ready > div { display: grid; gap: var(--space-1); min-width: 0; }
  .package-ready b { color: var(--accent); }
  .package-ready span { color: var(--muted); font-size: 11.5px; }
  .package-ready button { flex: 0 0 auto; }
  .source-row {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    justify-content: space-between;
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 8px 8px;
    background: var(--bg-1);
  }
  .source-meta {
    display: grid;
    gap: 4px;
    min-width: 0;
  }
  .source-meta b {
    overflow: hidden;
    color: var(--text);
    font-size: 12.5px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .danger { color: var(--bad); }

  .aux { display: grid; gap: 0; margin-top: var(--space-4); border-top: 1px solid var(--line); }
  .card {
    display: flex; gap: 8px; align-items: center;
    text-align: left;
    border: 0; border-bottom: 1px solid var(--line); border-radius: 0;
    background: transparent;
    padding: var(--space-3) var(--space-2);
    color: var(--muted); font-size: 12.5px;
  }
  .card b { color: var(--text); }
  .card:hover { background: var(--accent-soft); }
  .card .go { margin-left: auto; color: var(--accent); white-space: nowrap; }

  /* 기획 후보는 좁은 카드 대신 전폭 행으로 - 훅 문장이 세로로 접히지 않고
     후보 간 차이를 줄 단위로 비교할 수 있다. */
  .ideas { display: grid; border-top: 1px solid var(--line-strong); }
  .idea {
    display: grid; gap: 4px;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    padding: 16px 4px;
    border-bottom: 1px solid var(--line);
  }
  .idea h3 { margin: 0; font-size: 15px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; grid-column: 1; }
  .idea .act { grid-column: 2; grid-row: 1; }
  .idea .hook { margin: 0; font-size: 13px; line-height: 1.6; grid-column: 1 / -1; }
  .idea .dim { margin: 0; font-size: 12px; grid-column: 1 / -1; }
  .idea .risk { margin: 0; font-size: 11.5px; color: var(--warn); grid-column: 1 / -1; }

  .project-ledger { min-width: 0; border-left: 1px solid var(--line); padding-left: var(--space-5); }
  .ledger-head { display: flex; align-items: center; justify-content: space-between; min-height: 36px; border-bottom: 1px solid var(--line-strong); }
  .ledger-head h2 { margin: 0; font-size: 16px; }
  dl { margin: 0; }
  dl > div { min-height: 52px; display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); border-bottom: 1px solid var(--line); }
  dt { color: var(--muted); font-size: 12px; }
  dd { margin: 0; color: var(--text); font-size: 12.5px; font-weight: 700; text-align: right; }
  dd.warn { color: var(--warn); }
  dd.accent { color: var(--accent); }
  .ledger-actions { display: grid; margin-top: var(--space-5); border-top: 1px solid var(--line); }
  .ledger-link { min-height: 64px; display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); border: 0; border-bottom: 1px solid var(--line); border-radius: 0; padding: var(--space-2) 0; text-align: left; }
  .ledger-link span { min-width: 0; display: grid; gap: var(--space-1); }
  .ledger-link b { color: var(--text); font-size: 12.5px; }
  .ledger-link small { overflow: hidden; color: var(--faint); font-size: 10.5px; text-overflow: ellipsis; white-space: nowrap; }
  .ledger-link i { color: var(--accent); font-size: 11px; font-style: normal; }

  @media (max-width: 1120px) {
    .surface { grid-template-columns: minmax(0, 1fr) 264px; gap: var(--space-5); }
  }
  @media (max-width: 820px) {
    .surface { grid-template-columns: minmax(0, 1fr); }
    .project-ledger { border-top: 1px solid var(--line-strong); border-left: 0; padding-top: var(--space-4); padding-left: 0; }
    .ledger-actions { grid-template-columns: 1fr 1fr; gap: var(--space-4); }
  }
  @media (max-width: 560px) {
    .idea { grid-template-columns: minmax(0, 1fr); }
    .idea .act { grid-column: 1; grid-row: auto; }
    .package-ready { display: grid; }
    .package-ready button { width: 100%; }
    .cta-stack, .ledger-actions { grid-template-columns: minmax(0, 1fr); }
    .big { width: 100%; }
  }
</style>
