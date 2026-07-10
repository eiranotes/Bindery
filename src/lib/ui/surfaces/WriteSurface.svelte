<script lang="ts">
  // 집필 - 간단 모드의 메인 작업면. 단일 진행 레일 + 상황별 CTA 하나.
  // 사용자는 단계를 조작하지 않는다: 쓰기 → 후보 고르기 → (검토·수정) → 마감.
  // 중간 산출물은 전부 파일로 남고 "생성 근거 보기"에서 열람한다.
  import {
    ctx, currentEpisode, episodes, progress, candidates, withBusy, toast,
    refreshAll, refreshCandidates, busy, activeRun, intentNote, autopilotKick,
    clearRunFeed, uiMode, mode, project, settings, snapshots, usageSummary
  } from '$lib/stores/app';
  import { formatUsd, isAgyCommand } from '$lib/harness/usage';
  import {
    runEpisodeAutopilot, runRevisionAutopilot, buildRevisionCandidate,
    runCloseEpisodeAutopilot, finalizeCloseEpisode, applyCandidateToManuscript,
    ensureEpisodeScaffold, ensureStoryFoundation,
    type CloseoutCard, type EpisodeAutopilotResult, type FoundationResult
  } from '$lib/harness/autopilot';
  import {
    loadBrief, loadScenePlan, readCandidateBody, applyToManuscript,
    renderBriefMarkdown, renderScenePlanMarkdown, renderQAMarkdown,
    nextEpisode, type CandidateFile
  } from '$lib/harness/episode';
  import { readOptional } from '$lib/harness/project';
  import { episodePaths, summaryPath } from '$lib/core/layout';
  import { contentHash, parseFrontmatter } from '$lib/core/text';
  import { loadEpisodeContext, type ContextSource } from '$lib/harness/context';
  import { loadContextPackManifest, type ContextPackManifest } from '$lib/harness/contextPack';
  import { loadActiveStylePreset } from '$lib/harness/styleTransfer';
  import { restoreSnapshot, snapshotFile } from '$lib/harness/snapshots';
  import type { QAReport, RevisionPlan } from '$lib/schemas/contracts';
  import LiveRunPanel from '../LiveRunPanel.svelte';
  import DiffView from '../DiffView.svelte';
  import MarkdownEditor from '../MarkdownEditor.svelte';

  let manuscript = $state('');
  let manuscriptLoadedHash = $state('');
  let summaryText = $state('');
  let briefMd = $state('');
  let scenePlanMd = $state('');
  let lastResult = $state<EpisodeAutopilotResult | null>(null);
  let revisionPlan = $state<RevisionPlan | null>(null);
  let qaReports = $state<QAReport[]>([]);
  let closeCard = $state<CloseoutCard | null>(null);
  let closeChecks = $state<boolean[]>([]);
  let preview = $state<{ candidate: CandidateFile; body: string; showDiff: boolean } | null>(null);
  let editing = $state(false);
  let showCandidates = $state(false);
  let foundationMissing = $state<string[]>([]);
  let contextSources = $state<ContextSource[]>([]);
  let softGaps = $state<string[]>([]);
  let packManifest = $state<ContextPackManifest | null>(null);
  let activeStyleName = $state<string | null>(null);

  const ep = $derived($currentEpisode);
  const paths = $derived(episodePaths(ep));
  const body = $derived(parseFrontmatter(manuscript).body.trim());
  const hasManuscript = $derived(body.replace(/^#.*$/gm, '').replace(/\(원고가 아직 없습니다.*?\)/s, '').trim().length > 0);
  const chars = $derived(body.replace(/\s/g, '').length);
  const epStatus = $derived($progress[ep]?.status ?? 'planned');
  const draftCards = $derived($candidates.filter((c) => c.kind === 'draft'));
  const running = $derived(Boolean($busy || $activeRun));

  type Phase = 'start' | 'candidates' | 'manuscript';
  const phase = $derived.by((): Phase => {
    if (hasManuscript) return 'manuscript';
    if (draftCards.length > 0) return 'candidates';
    return 'start';
  });

  $effect(() => {
    void ep;
    void load();
  });

  async function load() {
    const c = ctx();
    summaryText = await readOptional(c, summaryPath(ep));
    const [brief, scenePlan, epContext, manifest, activeStyle] = await Promise.all([
      loadBrief(c, ep),
      loadScenePlan(c, ep),
      loadEpisodeContext(c, ep),
      loadContextPackManifest(c, ep),
      loadActiveStylePreset(c).catch(() => null)
    ]);
    manuscript = epContext.currentManuscript;
    manuscriptLoadedHash = contentHash(manuscript);
    contextSources = epContext.sources;
    packManifest = manifest;
    activeStyleName = activeStyle?.name ?? null;
    // hard gate(바이블·이번 화 플롯)와 soft gap(스타일·이전 요약 등)을 구분한다:
    // 전자는 집필을 막고 준비 CTA로, 후자는 알리되 AI 추정으로 계속 진행한다.
    foundationMissing = [
      !epContext.sources.find((s) => s.label === '설정 바이블')?.used ? '바이블' : '',
      !epContext.plotRow ? `${ep} 플롯` : ''
    ].filter(Boolean);
    softGaps = epContext.missing.filter((m) => m !== '설정 바이블' && !m.startsWith('플롯 계획'));
    briefMd = brief ? renderBriefMarkdown(brief) : '';
    scenePlanMd = scenePlan ? renderScenePlanMarkdown(scenePlan) : '';
    await refreshCandidates();
    preview = null;
    editing = false;
    showCandidates = false;
    revisionPlan = null;
    qaReports = [];
    closeCard = null;
  }

  // 홈에서 넘어온 실행 요청 소비
  $effect(() => {
    const kick = $autopilotKick;
    if (!kick) return;
    autopilotKick.set(null);
    if (kick === 'write') void write();
    else if (kick === 'writeFresh') void write(true, true);
    else if (kick === 'revise') void revise();
    else if (kick === 'close') void close();
    else if (kick === 'candidates') showCandidates = true;
  });

  async function write(regeneratePlan = false, keepFeed = false) {
    if (foundationMissing.length) {
      toast('집필 전에 바이블과 플롯 준비가 필요합니다.', 'warn');
      return;
    }
    // 월 예산 초과 시 실행 전에 알린다 (차단은 하지 않는다 - 사용자 판단).
    if (!isAgyCommand($settings.command) && $usageSummary.budgetUsd > 0 && $usageSummary.budgetRatio >= 1) {
      toast(`이번 달 추정 요금이 예산(${formatUsd($usageSummary.budgetUsd)})을 넘었습니다. 계속 진행합니다 - 설정에서 예산을 확인하세요.`, 'warn');
    }
    if (!keepFeed) clearRunFeed();
    const note = $intentNote.trim();
    const r = await withBusy('이번 화 쓰기', () =>
      runEpisodeAutopilot(ctx(), { episode: ep, userNote: note, candidateCount: 1, regeneratePlan })
    );
    if (!r) return;
    lastResult = r;
    intentNote.set('');
    if (r.error) {
      toast(r.error, 'warn');
    } else if (r.candidates.every((c) => c.source === 'fallback')) {
      toast('AI 실행기가 연결되지 않아 뼈대만 만들었습니다. 설정에서 실행기를 확인하세요.', 'warn');
    } else {
      toast(`후보 ${r.candidates.length}개가 준비됐습니다. 원고는 아직 그대로입니다.`, 'ok');
    }
    if (r.contextMissing.length) {
      toast(`비어 있는 기초자료: ${r.contextMissing.join(', ')} - 작품노트에서 채우면 품질이 좋아집니다`, 'info');
    }
    await load();
    if (hasManuscript) showCandidates = true;
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
    clearRunFeed();
    const r = await withBusy('작품 기준 준비', () =>
      ensureStoryFoundation(ctx(), {
        title: $project?.title ?? '작품',
        notes: $intentNote.trim(),
        episode: ep
      }), false
    );
    if (!r) return;
    toast(`작품 기준 준비됨: 자산 ${r.assets}건, ${foundationLabel(r)}.`, r.bibleSource === 'fallback' || r.plotSource === 'fallback' ? 'warn' : 'ok');
    await refreshAll();
    await load();
    await write(true, true);
  }

  async function openPreview(c: CandidateFile) {
    preview = { candidate: c, body: await readCandidateBody(ctx(), c), showDiff: false };
  }

  async function adopt(c: CandidateFile) {
    await withBusy('후보 적용', async () => {
      await applyCandidateToManuscript(ctx(), c);
      toast(`${c.label}을(를) 원고에 반영했습니다 (이전본 스냅샷 보존).`, 'ok');
    });
    await load();
  }

  async function applyPartial(result: string, kind: 'all' | 'partial') {
    await withBusy('후보 적용', async () => {
      await applyToManuscript(ctx(), ep, result, `${preview?.candidate.label ?? '후보'} ${kind === 'all' ? '전체' : '일부'} 적용`);
      toast(`원고에 ${kind === 'all' ? '전체' : '선택 구간만'} 반영됨 (스냅샷 보존)`, 'ok');
    });
    await load();
  }

  async function revise() {
    if (!hasManuscript) {
      toast('검토할 원고가 없습니다.', 'warn');
      return;
    }
    clearRunFeed();
    const r = await withBusy('원고 검토', () => runRevisionAutopilot(ctx(), { episode: ep, userNote: $intentNote.trim() }), false);
    if (!r) return;
    if (r.error) {
      toast(r.error, 'warn');
      return;
    }
    qaReports = r.reports;
    revisionPlan = r.plan;
    intentNote.set('');
    if (!r.plan) toast('수정 제안을 만들지 못했습니다.', 'warn');
  }

  async function applyCheckedRevisions() {
    if (!revisionPlan) return;
    const accepted = revisionPlan.items.filter((i) => i.accepted);
    if (!accepted.length) {
      toast('체크된 수정 항목이 없습니다.', 'warn');
      return;
    }
    clearRunFeed();
    const r = await withBusy('수정 적용', async () => {
      const built = await buildRevisionCandidate(ctx(), ep, revisionPlan!);
      if (!built.candidate || built.error) throw new Error(built.error ?? '수정 후보 생성 실패');
      await applyCandidateToManuscript(ctx(), built.candidate);
      return built.candidate;
    });
    if (r) {
      toast(`수정 ${accepted.length}건 반영됨 (이전본 스냅샷 보존).`, 'ok');
      revisionPlan = null;
      qaReports = [];
      await load();
    }
  }

  async function close() {
    if (!hasManuscript) {
      toast('마감할 원고가 없습니다.', 'warn');
      return;
    }
    clearRunFeed();
    const r = await withBusy('회차 마감 준비', () => runCloseEpisodeAutopilot(ctx(), ep), false);
    if (!r) return;
    closeCard = r;
    closeChecks = [...r.recommendedChecks];
    summaryText = r.summaryText;
  }

  async function confirmClose() {
    if (!closeCard) return;
    const r = await withBusy('회차 마감', () => finalizeCloseEpisode(ctx(), closeCard!, closeChecks));
    if (!r) return;
    toast(
      `${ep} 마감 완료 - 설정 변경 ${r.appliedChanges}건 반영${r.heldChanges ? `, ${r.heldChanges}건 보류함으로` : ''}. 다음: ${nextEpisode(ep)}`,
      'ok'
    );
    closeCard = null;
    await load();
  }

  function holdClose() {
    if (closeCard?.proposal) {
      toast('마감을 보류했습니다. 설정 변경 후보는 보류함에 남아 있습니다.', 'info');
    } else {
      toast('마감을 보류했습니다.', 'info');
    }
    closeCard = null;
  }

  async function saveManuscript() {
    const c = ctx();
    let diskContent: string | null = null;
    try {
      diskContent = await c.bridge.readFile(c.root, paths.manuscript);
    } catch {
      diskContent = null;
    }
    const changedOutside = diskContent == null || contentHash(diskContent) !== manuscriptLoadedHash;
    if (changedOutside && diskContent !== manuscript) {
      const ok = confirm(`${paths.manuscript} 파일이 열어둔 뒤 외부에서 변경되었습니다. 현재 편집본으로 덮어쓸까요? 외부 변경본은 스냅샷으로 남깁니다.`);
      if (!ok) {
        toast('원고 저장을 취소했습니다. 새로고침 후 다시 확인하세요.', 'warn');
        return;
      }
    }
    await withBusy('원고 저장', async () => {
      if (changedOutside && diskContent != null) {
        await snapshotFile(c, paths.manuscript, `${ep} 외부 변경 덮어쓰기 전`, ep);
      }
      await c.bridge.writeFile(c.root, paths.manuscript, manuscript);
      manuscriptLoadedHash = contentHash(manuscript);
      toast('원고 저장됨', 'ok');
    }, false);
    editing = false;
    await load();
  }

  async function addNextEpisode() {
    const next = nextEpisode($episodes[$episodes.length - 1] ?? 'ep000');
    await ensureEpisodeScaffold(ctx(), next);
    await refreshAll();
    currentEpisode.set(next);
    toast(`${next} 시작`, 'ok');
  }

  // 승인/되돌리기 명확화 - 후보·수정 적용 직후 원고를 한 번에 이전본으로 되돌린다.
  const manuscriptSnapshot = $derived($snapshots.find((s) => s.targetPath === paths.manuscript) ?? null);

  async function restorePreviousManuscript() {
    if (!manuscriptSnapshot) return;
    await withBusy('이전본 복원', async () => {
      await restoreSnapshot(ctx(), manuscriptSnapshot);
      toast(`원고를 이전본(${manuscriptSnapshot.label})으로 되돌렸습니다. 복원 전 상태도 스냅샷으로 남습니다.`, 'ok');
    });
    await load();
  }

  const aspectLabel: Record<string, string> = { canon: '설정', continuity: '연속성', style: '문체' };
  const verdictLabel: Record<string, string> = { pass: '통과', warn: '주의', fail: '수정 필요' };

  // Context Pack 요약 - "무엇을 참고했고 무엇을 대체했는가"를 산출물 옆에 한 줄로.
  const usedSources = $derived(contextSources.filter((s) => s.used));
  const replacedSources = $derived(
    contextSources.filter((s) => !s.used && !s.note.includes('해당 없음'))
  );

  const railSteps = $derived.by(() => {
    const foundation = foundationMissing.length ? '준비 필요' : '준비됨';
    const design = briefMd && scenePlanMd ? '자동 생성됨' : briefMd ? '브리프만 있음' : '-';
    const draft = hasManuscript ? '원고 반영됨' : draftCards.length ? `후보 ${draftCards.length}개` : '-';
    const review = revisionPlan ? `제안 ${revisionPlan.items.length}건` : qaReports.length ? '점검 완료' : '-';
    const closed = epStatus === 'fixed' ? '픽스됨' : summaryText ? '요약 준비됨' : '-';
    return [
      { label: '기준', value: foundation, done: foundationMissing.length === 0, now: foundationMissing.length > 0 && !hasManuscript },
      { label: '설계', value: design, done: Boolean(briefMd && scenePlanMd), now: foundationMissing.length === 0 && !briefMd && !hasManuscript },
      { label: '초안', value: draft, done: hasManuscript, now: Boolean(draftCards.length) && !hasManuscript },
      { label: '검토·수정', value: review, done: false, now: Boolean(revisionPlan) },
      { label: '마감', value: closed, done: epStatus === 'fixed', now: Boolean(closeCard) }
    ];
  });
</script>

<div class="surface">
  <div class="col">
    <header class="head">
      <div class="titleline">
        <h1>{ep}</h1>
        <span class="chip {epStatus === 'fixed' ? 'ok' : epStatus === 'drafting' ? 'info' : 'muted'}">
          {epStatus === 'fixed' ? '픽스' : epStatus === 'drafting' ? '집필 중' : '기획'}
        </span>
        {#if hasManuscript}<span class="dim">공백 제외 {chars.toLocaleString()}자</span>{/if}
      </div>
      <div class="row">
        <select bind:value={$currentEpisode}>
          {#each $episodes as e}<option value={e}>{e}</option>{/each}
        </select>
        <button class="quiet" onclick={addNextEpisode}>+ 다음 회차</button>
      </div>
    </header>

    <div class="rail" role="list" aria-label="진행 상태">
      {#each railSteps as s}
        <span class="step" class:done={s.done} class:now={s.now} role="listitem">
          <em>{s.label}</em>{s.value}
        </span>
      {/each}
    </div>

    {#if running}
      <LiveRunPanel />
    {:else if closeCard}
      <section class="block">
        <span class="kicker">회차 마감</span>
        <p class="lead">요약이 준비됐습니다{closeCard.summarySource === 'fallback' ? ' (오프라인 요약 - AI 연결 후 다시 만들 수 있습니다)' : ''}.
          {#if closeCard.proposal}설정 변경 후보 {closeCard.proposal.payload.changes.length}건을 확인하세요.{:else}이번 화에서 발견된 설정 변경 후보는 없습니다.{/if}</p>
        {#if closeCard.proposal}
          <div class="check">
            {#each closeCard.proposal.payload.changes as change, i}
              <label>
                <input type="checkbox" bind:checked={closeChecks[i]} />
                <span class="chip {change.risk === 'high' ? 'bad' : change.risk === 'medium' ? 'warn' : 'ok'}">{change.risk === 'high' ? '높음' : change.risk === 'medium' ? '중간' : '낮음'}</span>
                <span class="mono dim">{change.target_path}</span>
                {change.summary}
              </label>
            {/each}
          </div>
        {/if}
        <div class="row">
          <button class="primary big" onclick={confirmClose}>체크한 항목 반영하고 마감</button>
          <button class="quiet" onclick={holdClose}>보류</button>
        </div>
        <details>
          <summary>요약 본문 보기</summary>
          <pre class="pre panel">{closeCard.summaryText}</pre>
        </details>
      </section>
    {:else if revisionPlan}
      <section class="block">
        <span class="kicker">검토 결과 - 체크된 항목만 반영됩니다</span>
        {#if qaReports.length}
          <div class="qaline" role="list" aria-label="점검 요약">
            {#each qaReports as r (r.aspect)}
              <span class="chip {r.overall.verdict === 'pass' ? 'ok' : r.overall.verdict === 'warn' ? 'warn' : 'bad'}" role="listitem">
                {aspectLabel[r.aspect] ?? r.aspect} {verdictLabel[r.overall.verdict] ?? r.overall.verdict}
              </span>
            {/each}
            <span class="dim">근거는 아래 "생성 근거 보기"의 점검 보고서에 있습니다</span>
          </div>
        {/if}
        <div class="check">
          {#each revisionPlan.items as item (item.id)}
            <label class:off={!item.accepted}>
              <input type="checkbox" bind:checked={item.accepted} />
              <span class="sev {item.severity}">{item.severity === 'fail' ? '필수' : '권장'}</span>
              {item.instruction}
              {#if item.target}<span class="dim">({item.target})</span>{/if}
            </label>
          {/each}
        </div>
        <div class="row">
          <button class="primary big" onclick={applyCheckedRevisions}>체크한 수정 적용</button>
          <button class="quiet" onclick={() => { revisionPlan = null; }}>넘어가기</button>
        </div>
      </section>
    {:else if preview}
      <section class="block">
        <div class="row headrow">
          <span class="kicker">{preview.candidate.label} 미리보기</span>
          <button class="quiet" class:on={!preview.showDiff} onclick={() => (preview = { ...preview!, showDiff: false })}>전문</button>
          <button class="quiet" class:on={preview.showDiff} onclick={() => (preview = { ...preview!, showDiff: true })}>현재 원고와 비교</button>
          <span class="grow"></span>
          <button class="primary" onclick={() => adopt(preview!.candidate)}>이 후보 적용</button>
          <button class="quiet" onclick={() => (preview = null)}>닫기</button>
        </div>
        {#if preview.showDiff}
          <DiffView base={body} next={preview.body} onapply={applyPartial} />
        {:else}
          <div class="reader">{preview.body}</div>
        {/if}
      </section>
    {:else if foundationMissing.length}
      <section class="block start">
        <span class="kicker">작품 기준</span>
        <h2>바이블과 플롯을 먼저 준비합니다.</h2>
        <p class="lead">비어 있는 항목: {foundationMissing.join(', ')}. 준비가 끝나면 설계부터 다시 잡고 초안 후보를 만듭니다. 기존 원고는 그대로 둡니다.</p>
        <div class="row ctarow">
          <input class="grow" bind:value={$intentNote} placeholder="기준에 반영할 방향이 있으면 한 줄로 (선택)" />
          <button class="primary big" onclick={prepareThenWrite}>바이블과 플롯 준비하고 쓰기</button>
        </div>
        <div class="row">
          <button class="quiet" onclick={() => mode.set('notes')}>작품노트 보기</button>
        </div>
      </section>
    {:else if phase === 'start'}
      <section class="block start">
        <span class="kicker">다음 작업</span>
        <h2>{ep === 'ep001' && !briefMd ? '첫 화를 시작합니다.' : `${ep}를 쓸 차례입니다.`}</h2>
        <p class="lead">비워두면 플롯, 이전 회차 요약, 다음 화 메모를 기준으로 AI가 설계와 초안 후보까지 진행합니다.</p>
        <div class="row ctarow">
          <input class="grow" bind:value={$intentNote} placeholder="이번 화에 원하는 방향이 있으면 한 줄로 (선택)" />
          <button class="primary big" onclick={() => write()}>이번 화 쓰기</button>
        </div>
        <p class="dim small">원고에는 손대지 않습니다 - 후보를 보고 고르면 그때 반영됩니다.</p>
        {#if softGaps.length}
          <p class="preflight">
            비어 있는 자료: {softGaps.join(' · ')} - 그대로 진행하면 AI가 기존 원고에서 추정합니다.
            <button class="quiet inlinebtn" onclick={() => mode.set('notes')}>작품노트에서 채우기</button>
          </p>
        {/if}
      </section>
    {:else if phase === 'candidates' || showCandidates}
      <section class="block">
        <div class="row headrow">
          <span class="kicker">초안 후보 {draftCards.length}개 - 하나를 골라 반영하세요</span>
          {#if showCandidates && hasManuscript}<button class="quiet" onclick={() => (showCandidates = false)}>원고로 돌아가기</button>{/if}
        </div>
        {#if draftCards.length && draftCards.every((c) => c.source === 'fallback')}
          <div class="fallback-warn">
            <span class="chip bad">AI 아님</span>
            <span>이 후보들은 <b>AI가 아니라 로컬 뼈대</b>로 만들어졌습니다 - 실행기가 연결되지 않았습니다.
              품질이 낮은 게 정상입니다. <button class="linkbtn" onclick={() => mode.set('settings')}>설정에서 실행기 연결 →</button> 후 다시 만드세요.</span>
          </div>
        {/if}
        <div class="cands">
          {#each draftCards as c (c.id)}
            <article class="cand" class:rec={lastResult?.recommendedId === c.id}>
              <h3>
                {c.label}
                {#if lastResult?.recommendedId === c.id}<span class="chip info">추천</span>{/if}
                {#if c.source === 'agent'}<span class="chip ok">AI</span>{:else if c.source === 'web-import'}<span class="chip info">웹</span>{:else}<span class="chip warn">뼈대</span>{/if}
                {#if c.qualityStatus}<span class="chip {c.qualityStatus === 'pass' ? 'ok' : c.qualityStatus === 'warn' ? 'warn' : 'bad'}">품질 {c.qualityStatus}</span>{/if}
              </h3>
              {#if c.changeSummary}<p class="sum">{c.changeSummary}</p>{/if}
              <p class="meta dim">
                {#if c.charCount}{c.charCount.toLocaleString()}자{/if}
                {#if c.selfCheckScore}&nbsp;· 자체 점검 {c.selfCheckScore}{/if}
              </p>
              {#if c.risks?.length}
                <p class="risk">위험: {c.risks.join(' · ')}</p>
              {/if}
              {#if c.qualityIssues?.length}
                <p class="risk">품질: {c.qualityIssues.join(' · ')}</p>
              {/if}
              <div class="row">
                <button class="quiet" onclick={() => openPreview(c)}>미리보기</button>
                <button class="primary" onclick={() => adopt(c)}>이 후보 적용</button>
              </div>
            </article>
          {/each}
        </div>
        <div class="row">
          <button class="quiet" onclick={() => write()}>다시 만들기</button>
          <button class="quiet" onclick={() => write(true)}>설계부터 다시</button>
        </div>
        {#if usedSources.length}
          <p class="srcline">
            참고: {usedSources.map((s) => s.label).join(' · ')}
            {#if activeStyleName} · 문체: {activeStyleName} (장면별 자동 적용){/if}
            {#if replacedSources.length}<span class="dim"> / 비어 있어 추정: {replacedSources.map((s) => s.label).join(' · ')}</span>{/if}
          </p>
        {/if}
      </section>
    {:else}
      <section class="block">
        {#if editing}
          <div class="row headrow">
            <span class="kicker">직접 고치기 - {paths.manuscript}</span>
            <span class="grow"></span>
            <button class="primary" onclick={saveManuscript}>저장</button>
            <button class="quiet" onclick={() => { editing = false; void load(); }}>취소</button>
          </div>
          <div class="editor"><MarkdownEditor bind:value={manuscript} /></div>
        {:else}
          <div class="reader main" lang="ko">{body}</div>
          <div class="row ctarow">
            <button class="primary big" onclick={revise} disabled={epStatus === 'fixed'}>원고 검토하고 수정안 만들기</button>
            <button class="quiet" onclick={() => (editing = true)}>직접 고치기</button>
            {#if epStatus !== 'fixed'}
              <button class="quiet" onclick={() => write(true)} title="현재 원고는 그대로 두고 설계와 초안 후보만 새로 만듭니다">
                처음부터 새 후보 만들기
              </button>
            {/if}
            {#if draftCards.length}<button class="quiet" onclick={() => (showCandidates = true)}>후보 다시 보기</button>{/if}
            {#if manuscriptSnapshot && epStatus !== 'fixed'}
              <button class="quiet" onclick={restorePreviousManuscript} title={manuscriptSnapshot.label}>이전본 복원</button>
            {/if}
            <span class="grow"></span>
            {#if epStatus === 'fixed'}
              <button class="quiet" onclick={addNextEpisode}>다음 회차 시작</button>
            {:else}
              <button class="quiet strong" onclick={close}>회차 마감</button>
            {/if}
          </div>
        {/if}
      </section>
    {/if}

    <details class="evidence">
      <summary>생성 근거 보기</summary>
      <div class="evidence-body">
        {#if packManifest}
          <div>
            <span class="label">
              컨텍스트 팩 - 설정 자료 {packManifest.included.length}개 선별 · {packManifest.excluded.length}개 제외 ·
              {packManifest.usedChars.toLocaleString()}자 / 예산 {packManifest.budgetChars.toLocaleString()}자
              {#if packManifest.distill && packManifest.distill.source !== 'skipped'}
                · 정제 {packManifest.distill.source === 'agent' ? `AI (${packManifest.distill.inputChars.toLocaleString()} → ${packManifest.distill.capsuleChars.toLocaleString()}자)` : '실패(선별본 사용)'}
              {/if}
            </span>
            <ul class="srcs">
              {#each packManifest.included as item (item.id)}
                <li>
                  <span class="chip ok">포함</span>
                  <span class="srcname">{item.heading}</span>
                  <span class="dim">{item.reasons.join(' · ')}</span>
                  <span class="mono path">{item.path}</span>
                </li>
              {/each}
            </ul>
            {#if packManifest.excluded.length}
              <details class="excluded">
                <summary>제외된 자료 {packManifest.excluded.length}개 - 사유 보기</summary>
                <ul class="srcs">
                  {#each packManifest.excluded.slice(0, 20) as item (item.id)}
                    <li>
                      <span class="chip muted">제외</span>
                      <span class="srcname">{item.heading}</span>
                      <span class="dim">{item.reasons.join(' · ')}</span>
                      <span class="mono path">{item.path}</span>
                    </li>
                  {/each}
                </ul>
              </details>
            {/if}
          </div>
        {/if}
        {#if contextSources.length}
          <div>
            <span class="label">이번 생성이 참고하는 자료 - 전체 자료가 아니라 필요한 부분만 투입됩니다</span>
            <ul class="srcs">
              {#each contextSources as s (s.label)}
                <li>
                  <span class="chip {s.used ? 'ok' : s.note.includes('해당 없음') ? 'muted' : 'warn'}">{s.used ? '투입' : s.note.includes('해당 없음') ? '-' : '비어 있음'}</span>
                  <span class="srcname">{s.label}</span>
                  <span class="dim">{s.note}</span>
                  <span class="mono path">{s.path}</span>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
        <div>
          <span class="label">회차 설계 - {paths.brief}</span>
          <pre class="pre panel">{briefMd || '(아직 없음 - 이번 화 쓰기가 자동 생성합니다)'}</pre>
        </div>
        <div>
          <span class="label">장면 구성 - {paths.scenePlan}</span>
          <pre class="pre panel">{scenePlanMd || '(아직 없음)'}</pre>
        </div>
        {#if qaReports.length}
          <div>
            <span class="label">점검 보고서</span>
            {#each qaReports as r (r.aspect)}
              <pre class="pre panel">{renderQAMarkdown(r)}</pre>
            {/each}
          </div>
        {/if}
        {#if summaryText}
          <div>
            <span class="label">회차 요약 - {summaryPath(ep)}</span>
            <pre class="pre panel">{summaryText}</pre>
          </div>
        {/if}
        {#if $uiMode === 'advanced'}
          <p class="dim">세부 파이프라인 조작은 <button class="quiet inlinebtn" onclick={() => mode.set('episode')}>회차 화면(설계자)</button>에서 할 수 있습니다.</p>
        {/if}
      </div>
    </details>
  </div>
</div>

<style>
  .surface { padding: 24px 32px 40px; }
  .col { max-width: 860px; margin: 0 auto; display: grid; gap: 16px; align-content: start; }
  .head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  .titleline { display: flex; align-items: baseline; gap: 8px; }
  .head h1 { margin: 0; font-size: 22px; }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .headrow { align-items: center; }
  .grow { flex: 1; min-width: 160px; }
  .big { padding: 8px 20px; font-size: 13.5px; }

  .rail { display: flex; border: 1px solid var(--line); border-radius: 4px; overflow: hidden; background: var(--bg-1); }
  .step { flex: 1; padding: 8px 12px; border-right: 1px solid var(--line); font-size: 12px; color: var(--muted); min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .step:last-child { border-right: 0; }
  .step em { display: block; font-style: normal; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint); }
  .step.done { background: var(--ok-soft); }
  .step.now { background: var(--accent-soft); color: var(--text); font-weight: 650; }

  .block { display: grid; gap: 12px; }
  .kicker { font-size: 10px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: var(--faint); }
  .block h2 { margin: 0; font-size: 20px; line-height: 1.3; }
  .lead { margin: 0; color: var(--muted); }
  .small { font-size: 11.5px; margin: 0; }
  .ctarow { margin-top: 4px; }
  .start { padding: 8px 0 4px; }

  /* 후보는 좁은 세로 카드 대신 전폭 행으로 - 긴 요약이 세로로 늘어지지 않고
     후보 간 비교가 줄 단위로 읽힌다 (에디토리얼 리스트). */
  .cands { display: grid; border-top: 1px solid var(--line-strong); }
  .cand {
    display: grid; gap: 8px;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    padding: 12px 4px;
    border-bottom: 1px solid var(--line);
  }
  .cand.rec { background: var(--accent-soft); margin: 0 -8px; padding: 12px 12px; border-radius: 4px; border-bottom-color: transparent; }
  .cand h3 { margin: 0; font-size: 14px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; grid-column: 1; }
  .cand .row { grid-column: 2; grid-row: 1; flex-wrap: nowrap; }
  .cand .sum { margin: 0; font-size: 13px; color: var(--text); grid-column: 1 / -1; line-height: 1.6; }
  .cand .meta { margin: 0; font-size: 11.5px; grid-column: 1 / -1; }
  .cand .risk { margin: 0; font-size: 12px; color: var(--warn); grid-column: 1 / -1; }
  @media (max-width: 560px) {
    .cand { grid-template-columns: minmax(0, 1fr); }
    .cand .row { grid-column: 1; grid-row: auto; }
  }

  .check { display: grid; border-top: 1px solid var(--line); }
  .check label { display: flex; gap: 8px; align-items: baseline; padding: 8px 4px; border-bottom: 1px solid var(--line); font-size: 13px; flex-wrap: wrap; }
  .check label.off { opacity: 0.5; }
  .sev { font-family: var(--mono); font-size: 10.5px; font-weight: 700; }
  .sev.fail { color: var(--bad); }
  .sev.warn { color: var(--warn); }

  .reader {
    font-family: var(--serif);
    font-size: 14.5px;
    line-height: 1.85;
    white-space: pre-wrap;
    word-break: break-word;
    border: 1px solid var(--line);
    border-radius: 4px;
    background: var(--bg-1);
    padding: 24px 32px;
    max-height: min(58vh, 560px);
    overflow: auto;
  }
  /* 원고가 화면의 중심 - 보조 패널이 아니라 데스크만큼 크게 보여준다. */
  .reader.main { max-height: min(66vh, 720px); }
  .editor { height: min(66vh, 720px); min-height: 320px; }
  .panel { border: 1px solid var(--line); border-radius: 4px; padding: 8px; background: var(--bg-1); max-height: 300px; overflow: auto; }

  .strong { color: var(--accent); border-color: var(--accent); }
  .fallback-warn {
    display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap;
    border: 1px solid var(--bad-soft); border-radius: 4px; background: var(--bad-soft);
    padding: 8px 12px; font-size: 12.5px; line-height: 1.55;
  }
  .linkbtn { border: 0; padding: 0; color: var(--accent); text-decoration: underline; font: inherit; }
  .qaline { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .preflight { margin: 0; font-size: 12px; color: var(--muted); }
  .srcline { margin: 0; font-size: 12px; color: var(--muted); border-top: 1px dashed var(--line); padding-top: 8px; }
  .srcs { list-style: none; margin: 0; padding: 0; display: grid; border-top: 1px solid var(--line); }
  .srcs li {
    display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap;
    padding: 8px 4px; border-bottom: 1px solid var(--line); font-size: 12.5px;
  }
  .srcs .srcname { font-weight: 600; }
  .srcs .path { margin-left: auto; font-size: 11px; color: var(--faint); overflow: hidden; text-overflow: ellipsis; max-width: 260px; white-space: nowrap; }
  .excluded summary { cursor: pointer; color: var(--faint); font-size: 12px; padding: 8px 0 4px; }
  .evidence summary { cursor: pointer; color: var(--muted); font-size: 12.5px; padding: 8px 0; border-top: 1px dashed var(--line-strong); }
  .evidence-body { display: grid; gap: 12px; padding-top: 8px; }
  .evidence-body > div { display: grid; gap: 8px; }
  .inlinebtn { padding: 0 4px; font-size: 12px; text-decoration: underline; }
  details summary { user-select: none; }
  button.on { background: var(--accent-soft); color: var(--text); }
  @media (max-width: 640px) {
    .rail { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .step {
      min-height: 48px;
      white-space: normal;
      line-height: 1.25;
      border-right: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
    }
    .step:nth-child(3n),
    .step:last-child { border-right: 0; }
    .step:nth-last-child(-n + 2) { border-bottom: 0; }
  }
</style>
