<script lang="ts">
  // 회차 워크벤치 - 브리프, 장면, 초안 후보(diff 적용), QA, 수정, 요약, 픽스.
  // 계획 산출물은 회차 폴더 파일이며, 원고 반영은 항상 diff + 스냅샷을 거친다.
  import {
    ctx, currentEpisode, episodes, progress, candidates, withBusy, toast, refreshAll, refreshCandidates, mode
  } from '$lib/stores/app';
  import {
    generateBrief, generateScenePlan, generateDraftCandidates, generateRevisionCandidate,
    loadBrief, loadScenePlan, readCandidateBody, applyToManuscript, runQA,
    generateRevisionPlanStage, renderBriefMarkdown, renderScenePlanMarkdown, renderQAMarkdown,
    nextEpisode, approvalStatus, setPlanningApproval, saveWebBrief, saveWebScenePlan,
    saveWebDraftCandidate, type ApprovedEpisodeBrief, type ApprovedScenePlan, type CandidateFile
  } from '$lib/harness/episode';
  import { loadEpisodeContext } from '$lib/harness/context';
  import { summarizeEpisode, proposeCanonDelta, fixEpisode } from '$lib/harness/closeout';
  import { readOptional } from '$lib/harness/project';
  import { episodePaths, LAYOUT, summaryPath } from '$lib/core/layout';
  import { clip, parseFrontmatter } from '$lib/core/text';
  import { exportPacket, recordImport } from '$lib/harness/exchange';
  import { previewPrompt } from '$lib/harness/runner';
  import { BLUEPRINTS } from '$lib/prompts';
  import { writeArtifact } from '$lib/harness/artifacts';
  import { registerCanonDelta, saveProposal } from '$lib/harness/proposals';
  import type { QAReport, QAAspect, RevisionPlan } from '$lib/schemas/contracts';
  import { parseCanonDeltaProposal, parseDraftCandidate, parseEpisodeBrief, parseScenePlan } from '$lib/schemas/contracts';
  import DiffView from '../DiffView.svelte';
  import MarkdownEditor from '../MarkdownEditor.svelte';

  type Tab = 'plan' | 'draft' | 'qa' | 'closeout';
  let tab = $state<Tab>('plan');

  let brief = $state<ApprovedEpisodeBrief | null>(null);
  let scenePlan = $state<ApprovedScenePlan | null>(null);
  let manuscript = $state('');
  let notes = $state('');
  let targetLength = $state(5000);
  let candidateCount = $state(2);
  let activeCandidate = $state<CandidateFile | null>(null);
  let candidateBody = $state('');
  let qaReports = $state<QAReport[]>([]);
  let revisionPlan = $state<RevisionPlan | null>(null);
  let summaryText = $state('');
  type ExchangeChoice = 'episode-brief' | 'scene-plan' | 'draft-candidate' | 'canon-delta';
  let showExchange = $state(false);
  let exchangeStage = $state<ExchangeChoice>('episode-brief');
  let exchangePacket = $state('');
  let exchangeId = $state('');
  let exchangeImportText = $state('');
  const exchangeStages: Array<[ExchangeChoice, string]> = [
    ['episode-brief', '브리프'],
    ['scene-plan', '장면 계획'],
    ['draft-candidate', '초안 후보'],
    ['canon-delta', '정사 변경']
  ];

  const ep = $derived($currentEpisode);
  const paths = $derived(episodePaths(ep));
  const manuscriptBody = $derived(parseFrontmatter(manuscript).body.trim());
  const chars = $derived(manuscriptBody.replace(/\s/g, '').length);
  const epStatus = $derived($progress[ep]?.status ?? 'planned');
  const briefStatus = $derived(approvalStatus(brief));
  const sceneStatus = $derived(approvalStatus(scenePlan));
  const planningApproved = $derived(briefStatus === 'approved' && sceneStatus === 'approved');

  $effect(() => {
    void ep;
    void load();
  });

  async function load() {
    const c = ctx();
    brief = await loadBrief(c, ep);
    scenePlan = await loadScenePlan(c, ep);
    manuscript = await readOptional(c, paths.manuscript);
    summaryText = await readOptional(c, summaryPath(ep));
    await refreshCandidates();
    activeCandidate = null;
    candidateBody = '';
    qaReports = [];
    revisionPlan = null;
  }

  async function makeBrief() {
    const r = await withBusy('회차 브리프', () => generateBrief(ctx(), ep, notes, targetLength), false);
    if (r) {
      brief = r.output;
      toast(r.source === 'agent' ? `브리프 생성됨 - ${paths.brief}` : '로컬 뼈대 브리프 생성됨 - 파일을 직접 채울 수 있습니다', r.source === 'agent' ? 'ok' : 'warn');
    }
  }

  async function makeScenePlan() {
    const r = await withBusy('장면 계획', () => generateScenePlan(ctx(), ep), false);
    if (r && 'error' in r) {
      toast(r.error, 'warn');
    } else if (r) {
      scenePlan = r.output;
      toast(`장면 계획 ${r.output.scenes.length}장면 - ${paths.scenePlan}`, r.source === 'agent' ? 'ok' : 'warn');
    }
  }

  async function markApproved(kind: 'brief' | 'scene-plan') {
    await withBusy(kind === 'brief' ? '브리프 승인' : '장면 계획 승인', async () => {
      const next = await setPlanningApproval(ctx(), ep, kind, 'approved');
      if (kind === 'brief') brief = next as ApprovedEpisodeBrief;
      else scenePlan = next as ApprovedScenePlan;
      toast(kind === 'brief' ? '브리프 승인됨' : '장면 계획 승인됨', 'ok');
    }, false);
  }

  async function makeDrafts() {
    const r = await withBusy('초안 후보 생성', () => generateDraftCandidates(ctx(), ep, candidateCount, notes), false);
    if (!r) return;
    if (r.error) {
      toast(r.error, 'warn');
      return;
    }
    await refreshCandidates();
    toast(`후보 ${r.candidates.length}건 생성됨 - 원고는 그대로입니다. diff로 검토하세요`, 'ok');
    tab = 'draft';
    if (r.candidates[0]) await selectCandidate(r.candidates[0]);
  }

  async function buildExchangePrompt(): Promise<string | null> {
    const c = ctx();
    if (exchangeStage === 'episode-brief') {
      const base = await loadEpisodeContext(c, ep);
      return previewPrompt({
        blueprint: BLUEPRINTS.episodeBrief,
        vars: {
          episode: ep,
          plotRow: base.plotRowText,
          resumeState: base.resumeState,
          bible: base.bible,
          openThreads: base.openThreads,
          previousTail: base.previousTail,
          notes: notes || '(없음)',
          targetLength: String(targetLength)
        }
      });
    }
    if (exchangeStage === 'scene-plan') {
      if (!brief) {
        toast('브리프가 먼저 필요합니다', 'warn');
        return null;
      }
      return previewPrompt({
        blueprint: BLUEPRINTS.scenePlan,
        vars: {
          episode: ep,
          brief: renderBriefMarkdown(brief),
          styleGuide: clip(await readOptional(c, LAYOUT.style.guide), 2000)
        }
      });
    }
    if (exchangeStage === 'draft-candidate') {
      if (!planningApproved || !brief || !scenePlan) {
        toast('승인된 브리프와 장면 계획이 먼저 필요합니다', 'warn');
        return null;
      }
      const base = await loadEpisodeContext(c, ep);
      return previewPrompt({
        blueprint: BLUEPRINTS.draftCandidate,
        vars: {
          episode: ep,
          brief: renderBriefMarkdown(brief),
          scenePlan: renderScenePlanMarkdown(scenePlan),
          resumeState: base.resumeState,
          previousSummary: base.previousSummary,
          previousTail: base.previousTail,
          bible: base.bible,
          openThreads: base.openThreads,
          styleGuide: base.styleGuide,
          currentManuscript: manuscriptBody || '(빈 원고)',
          notes: notes || '(없음)',
          targetLength: String(brief.target_length),
          variation: ''
        }
      });
    }
    const deltas = $candidates.flatMap((candidate) => candidate.deltaCandidates ?? []);
    return previewPrompt({
      blueprint: BLUEPRINTS.canonDelta,
      vars: {
        episode: ep,
        summary: clip(summaryText, 5000) || '(요약 없음)',
        deltaCandidates: deltas.length
          ? deltas.map((d) => `- ${d.summary} (대상 힌트: ${d.target_hint || '없음'}, risk: ${d.risk})`).join('\n')
          : '(초안 단계에서 분리된 후보 없음)',
        canonFiles: [
          `### ${LAYOUT.canon.bible}\n${clip(await readOptional(c, LAYOUT.canon.bible), 3500)}`,
          `### ${LAYOUT.plot.openThreads}\n${clip(await readOptional(c, LAYOUT.plot.openThreads), 1500)}`
        ].join('\n\n')
      }
    });
  }

  async function makeExchangePacket() {
    const prompt = await buildExchangePrompt();
    if (!prompt) return;
    const packet = await withBusy('회차 packet 내보내기', () => exportPacket(ctx(), exchangeStage, prompt), false);
    if (packet) {
      exchangePacket = packet.packet;
      exchangeId = packet.exchangeId;
      showExchange = true;
      toast(`packet 저장됨: ${packet.packetPath}`, 'ok');
    }
  }

  async function copyExchangePacket() {
    await navigator.clipboard.writeText(exchangePacket);
    toast('packet이 클립보드에 복사됨', 'ok');
  }

  async function importExchangeResult() {
    const c = ctx();
    if (exchangeStage === 'episode-brief') {
      const parsed = parseEpisodeBrief(exchangeImportText, ep);
      if (!parsed) {
        if (exchangeId) await recordImport(c, exchangeId, exchangeImportText, false, 'schema validation failed');
        toast('가져오기 실패: episode_brief JSON이 아닙니다', 'bad');
        return;
      }
      await withBusy('웹 브리프 가져오기', async () => {
        brief = await saveWebBrief(c, parsed);
        if (exchangeId) await recordImport(c, exchangeId, exchangeImportText, true);
        exchangeImportText = '';
        toast('웹 브리프를 draft 상태로 저장했습니다', 'ok');
      }, false);
    } else if (exchangeStage === 'scene-plan') {
      const parsed = parseScenePlan(exchangeImportText, ep);
      if (!parsed) {
        if (exchangeId) await recordImport(c, exchangeId, exchangeImportText, false, 'schema validation failed');
        toast('가져오기 실패: scene_plan JSON이 아닙니다', 'bad');
        return;
      }
      await withBusy('웹 장면 계획 가져오기', async () => {
        scenePlan = await saveWebScenePlan(c, parsed);
        if (exchangeId) await recordImport(c, exchangeId, exchangeImportText, true);
        exchangeImportText = '';
        toast('웹 장면 계획을 draft 상태로 저장했습니다', 'ok');
      }, false);
    } else if (exchangeStage === 'draft-candidate') {
      const parsed = parseDraftCandidate(exchangeImportText, ep, manuscriptBody).candidate;
      if (!parsed) {
        if (exchangeId) await recordImport(c, exchangeId, exchangeImportText, false, 'schema validation failed');
        toast('가져오기 실패: draft_candidate JSON이 아닙니다', 'bad');
        return;
      }
      await withBusy('웹 초안 후보 가져오기', async () => {
        const saved = await saveWebDraftCandidate(c, ep, parsed);
        await refreshCandidates();
        await selectCandidate(saved);
        if (exchangeId) await recordImport(c, exchangeId, exchangeImportText, true);
        exchangeImportText = '';
        tab = 'draft';
        toast('웹 초안 후보를 등록했습니다', 'ok');
      }, false);
    } else {
      const parsed = parseCanonDeltaProposal(exchangeImportText, ep);
      if (!parsed) {
        if (exchangeId) await recordImport(c, exchangeId, exchangeImportText, false, 'schema validation failed');
        toast('가져오기 실패: canon_delta_proposal JSON이 아닙니다', 'bad');
        return;
      }
      await withBusy('웹 정사 변경 가져오기', async () => {
        const proposal = registerCanonDelta({ ...parsed, requires_human_approval: true }, 'web-import');
        await saveProposal(c, proposal);
        await writeArtifact(c, ep, 'canon-delta', `정사 변경 proposal · ${parsed.changes.length}건 (웹 교환)`, parsed.changes.map((change) => `- [${change.risk}] ${change.change_type} ${change.target_path}: ${change.summary}`).join('\n'), 'web-import');
        if (exchangeId) await recordImport(c, exchangeId, exchangeImportText, true);
        exchangeImportText = '';
        mode.set('canon');
        toast('웹 정사 변경 proposal을 등록했습니다', 'ok');
      });
    }
  }

  async function selectCandidate(c: CandidateFile) {
    activeCandidate = c;
    candidateBody = await readCandidateBody(ctx(), c);
  }

  async function applyDiff(result: string, kind: 'all' | 'partial') {
    await withBusy('후보 적용', async () => {
      await applyToManuscript(ctx(), ep, result, `${activeCandidate?.label ?? '후보'} ${kind === 'all' ? '전체' : '일부'} 적용`);
      manuscript = await readOptional(ctx(), paths.manuscript);
      toast(`원고에 ${kind === 'all' ? '전체' : '선택 구간만'} 반영됨 (이전본 스냅샷 보존)`, 'ok');
    }, false);
  }

  async function doQA(aspect: QAAspect) {
    const content = await readOptional(ctx(), paths.manuscript);
    const r = await withBusy(`QA(${aspect})`, () => runQA(ctx(), ep, aspect, { label: '현재 원고', content }), false);
    if (r) {
      qaReports = [...qaReports.filter((q) => q.aspect !== aspect), r.output as QAReport];
      const v = (r.output as QAReport).overall.verdict;
      toast(`QA ${aspect}: ${v} (${(r.output as QAReport).overall.score})`, v === 'fail' ? 'bad' : v === 'warn' ? 'warn' : 'ok');
    }
  }

  async function makeRevisionPlan() {
    if (!qaReports.length) {
      toast('먼저 QA를 실행하세요', 'warn');
      return;
    }
    const r = await withBusy('수정 계획', () => generateRevisionPlanStage(ctx(), ep, qaReports, []), false);
    if (r) revisionPlan = r.output;
  }

  async function makeRevisionCandidate() {
    if (!revisionPlan) return;
    const r = await withBusy('수정 후보 생성', () => generateRevisionCandidate(ctx(), ep, revisionPlan!), false);
    if (!r) return;
    if (r.error) {
      toast(r.error, 'warn');
      return;
    }
    await refreshCandidates();
    if (r.candidate) {
      await selectCandidate(r.candidate);
      tab = 'draft';
      toast('수정 후보 생성됨 - diff에서 hunk 단위로 골라 적용하세요', 'ok');
    }
  }

  async function doSummary() {
    const r = await withBusy('회차 요약', () => summarizeEpisode(ctx(), ep), false);
    if (r) {
      summaryText = r.output;
      toast(`요약 저장됨 - canon/summaries/${ep}.md`, r.source === 'agent' ? 'ok' : 'warn');
    }
  }

  async function doCanonDelta() {
    const deltas = $candidates.flatMap((c) => c.deltaCandidates ?? []);
    const r = await withBusy('정사 변경 proposal', () => proposeCanonDelta(ctx(), ep, deltas));
    if (r) {
      if (r.proposal) {
        toast(`정사 변경 ${r.proposal.payload.changes.length}건 제안됨 - 제안·정사 화면에서 승인하세요`, 'ok');
        mode.set('canon');
      } else {
        toast('제안할 정사 변경이 없거나 AI가 연결되지 않았습니다 (지어내지 않습니다)', 'info');
      }
    }
  }

  async function doFix() {
    await withBusy('기록·픽스', async () => {
      await fixEpisode(ctx(), ep);
      toast(`${ep} 픽스 완료 - 재개 상태(resume state)가 갱신됐습니다. 다음: ${nextEpisode(ep)}`, 'ok');
    });
  }

  async function addNextEpisode() {
    const next = nextEpisode($episodes[$episodes.length - 1] ?? 'ep000');
    const c = ctx();
    await c.bridge.writeFile(c.root, episodePaths(next).manuscript, `---\nepisode: ${next}\nstatus: planned\n---\n\n# ${next}\n\n`);
    await c.bridge.writeFile(c.root, episodePaths(next).index, `# ${next} 작업 노트\n\n- 상태: 기획\n`);
    await refreshAll();
    currentEpisode.set(next);
    toast(`${next} 폴더 생성됨`, 'ok');
  }

  const tabs: Array<[Tab, string]> = [['plan', '계획'], ['draft', '후보·적용'], ['qa', 'QA·수정'], ['closeout', '요약·픽스']];
</script>

<div class="surface">
  <header class="head">
    <div>
      <h1>회차 {ep}</h1>
      <p class="dim">
        <span class="chip {epStatus === 'fixed' ? 'ok' : epStatus === 'drafting' ? 'info' : 'muted'}">{epStatus === 'fixed' ? '픽스' : epStatus === 'drafting' ? '집필 중' : '기획'}</span>
        원고 공백 제외 {chars.toLocaleString()}자 · {paths.manuscript}
      </p>
    </div>
    <div class="row">
      <select bind:value={$currentEpisode}>
        {#each $episodes as e}<option value={e}>{e}</option>{/each}
      </select>
      <button class="quiet" onclick={addNextEpisode}>+ 다음 회차</button>
    </div>
  </header>

  <nav class="tabs">
    {#each tabs as [id, label]}
      <button class="quiet" class:on={tab === id} onclick={() => (tab = id)}>{label}</button>
    {/each}
  </nav>

  <section class="exchange-line">
    <span class="label">웹 AI 교환</span>
    <select bind:value={exchangeStage}>
      {#each exchangeStages as [id, label]}<option value={id}>{label}</option>{/each}
    </select>
    <button onclick={makeExchangePacket}>packet 내보내기</button>
    <button class="quiet" onclick={() => (showExchange = !showExchange)}>{showExchange ? '교환 닫기' : '결과 가져오기'}</button>
  </section>

  {#if showExchange}
    <section class="exchange">
      {#if exchangePacket}
        <div class="row"><button onclick={copyExchangePacket}>packet 복사</button><span class="dim">.bindery/exchange/{exchangeId}/packet.md</span></div>
      {/if}
      <textarea rows="6" bind:value={exchangeImportText} placeholder="웹 AI가 돌려준 {exchangeStage} JSON을 붙여넣으세요"></textarea>
      <div class="row"><button class="primary" onclick={importExchangeResult} disabled={!exchangeImportText.trim()}>검증 후 등록</button></div>
    </section>
  {/if}

  {#if tab === 'plan'}
    <section class="cols">
      <div>
        <div class="row headrow">
          <span class="label">회차 브리프 - {paths.brief}</span>
          <span class="chip {briefStatus === 'approved' ? 'ok' : 'warn'}">{briefStatus === 'approved' ? '승인됨' : '검토 필요'}</span>
          <label class="inline">목표 분량 <input type="number" step="500" min="1000" bind:value={targetLength} /></label>
          <button class="primary" onclick={makeBrief}>{brief ? '재생성' : '브리프 생성'}</button>
        </div>
        {#if brief}
          <pre class="pre panel">{renderBriefMarkdown(brief)}</pre>
          <div class="row">
            <button onclick={() => markApproved('brief')} disabled={briefStatus === 'approved'}>{briefStatus === 'approved' ? '브리프 승인 완료' : '브리프 승인'}</button>
            <span class="dim">승인 후에만 장면 계획을 생성할 수 있습니다.</span>
          </div>
        {:else}
          <p class="empty">브리프가 없습니다. 플롯이 승인된 회차라면 근거가 강해집니다. 파일을 직접 작성해도 됩니다.</p>
        {/if}
      </div>
      <div>
        <div class="row headrow">
          <span class="label">장면 계획 - {paths.scenePlan}</span>
          <span class="chip {sceneStatus === 'approved' ? 'ok' : 'warn'}">{sceneStatus === 'approved' ? '승인됨' : '검토 필요'}</span>
          <button class="primary" onclick={makeScenePlan} disabled={briefStatus !== 'approved'}>{scenePlan ? '재생성' : '장면 계획 생성'}</button>
        </div>
        {#if scenePlan}
          <pre class="pre panel">{renderScenePlanMarkdown(scenePlan)}</pre>
          <div class="row">
            <button onclick={() => markApproved('scene-plan')} disabled={sceneStatus === 'approved'}>{sceneStatus === 'approved' ? '장면 계획 승인 완료' : '장면 계획 승인'}</button>
            <span class="dim">초안 후보는 승인된 장면 계획만 입력으로 사용합니다.</span>
          </div>
        {:else}
          <p class="empty">장면 계획이 없습니다. 승인된 브리프가 먼저 필요합니다.</p>
        {/if}
      </div>
    </section>
    <section>
      <div class="row">
        <input class="grow" bind:value={notes} placeholder="집필 지시 (선택) - 브리프·초안 프롬프트에 전달" />
        <label class="inline">후보 수 <input type="number" min="1" max="4" bind:value={candidateCount} /></label>
        <button class="primary big" onclick={makeDrafts} disabled={!planningApproved}>초안 후보 생성</button>
      </div>
      {#if !planningApproved}<p class="dim">초안은 승인된 브리프와 승인된 장면 계획이 있어야 생성됩니다 (계획 없이 생성 금지).</p>{/if}
    </section>
  {:else if tab === 'draft'}
    <section class="cols">
      <div>
        <span class="label">후보 목록 ({$candidates.length}) - 원본 원고를 덮지 않습니다</span>
        {#if $candidates.length === 0}
          <p class="empty">후보가 없습니다. 계획 탭에서 초안 후보를 생성하세요.</p>
        {:else}
          <ul class="cands">
            {#each $candidates as c (c.id)}
              <li>
                <button class="quiet" class:on={activeCandidate?.id === c.id} onclick={() => selectCandidate(c)}>
                  <b>{c.label}</b>
                  <span class="chip {c.source === 'agent' ? 'ok' : c.source === 'web-import' ? 'info' : 'warn'}">{c.source === 'agent' ? 'AI' : c.source === 'web-import' ? '웹' : '뼈대'}</span>
                  <span class="dim">{c.kind === 'revision' ? '수정' : '초안'} · {new Date(c.createdAt).toLocaleTimeString()}</span>
                  {#if c.changeSummary}<p class="dim sum">{c.changeSummary}</p>{/if}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
        {#if activeCandidate?.deltaCandidates?.length}
          <div class="deltas">
            <span class="label">이 후보가 분리해낸 설정 변경 후보</span>
            {#each activeCandidate.deltaCandidates as d}
              <p class="dim">- [{d.risk}] {d.summary}</p>
            {/each}
            <p class="dim">요약·픽스 탭의 "정사 변경 proposal"로 승인 흐름에 태웁니다.</p>
          </div>
        {/if}
      </div>
      <div>
        <span class="label">diff - 현재 원고 대비</span>
        {#if activeCandidate && candidateBody}
          <DiffView base={manuscriptBody} next={candidateBody} onapply={applyDiff} />
        {:else}
          <p class="empty">후보를 선택하면 diff가 표시됩니다.</p>
        {/if}
      </div>
    </section>
    <section>
      <details>
        <summary>현재 원고 직접 수정 (다듬기)</summary>
        <div class="manuscript-editor">
          <MarkdownEditor bind:value={manuscript} compact />
        </div>
        <div class="row">
          <button class="primary" onclick={() => withBusy('원고 저장', async () => {
            await ctx().bridge.writeFile(ctx().root, paths.manuscript, manuscript);
            toast('원고 저장됨', 'ok');
          }, false)}>저장</button>
        </div>
      </details>
    </section>
  {:else if tab === 'qa'}
    <section>
      <div class="row">
        <span class="label">QA - 관점별 점수 (현재 원고 기준)</span>
        <button onclick={() => doQA('style')}>문체·리듬·훅</button>
        <button onclick={() => doQA('continuity')}>플롯·연속성</button>
        <button onclick={() => doQA('canon')}>정사·설정 충돌</button>
      </div>
      {#if qaReports.length === 0}
        <p class="empty">이 세션에서 실행된 QA가 없습니다. 관점을 선택해 실행하세요. 결과는 .bindery/artifacts/{ep}/에도 남습니다.</p>
      {:else}
        <div class="qa-grid">
          {#each qaReports as r (r.aspect)}
            <pre class="pre panel">{renderQAMarkdown(r)}</pre>
          {/each}
        </div>
      {/if}
    </section>
    <section>
      <div class="row">
        <span class="label">수정 계획</span>
        <button class="primary" onclick={makeRevisionPlan} disabled={!qaReports.length}>QA 이슈로 수정 계획 생성</button>
      </div>
      {#if revisionPlan}
        <table class="grid">
          <thead><tr><th>수용</th><th>심각도</th><th>제시</th><th>위치</th><th>출처</th></tr></thead>
          <tbody>
            {#each revisionPlan.items as item (item.id)}
              <tr class:off={!item.accepted}>
                <td><input type="checkbox" bind:checked={item.accepted} /></td>
                <td><span class="chip {item.severity === 'fail' ? 'bad' : 'warn'}">{item.severity}</span></td>
                <td>{item.instruction}</td>
                <td class="dim">{item.target || '-'}</td>
                <td class="dim mono">{item.source_gate || '-'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <div class="row">
          <button class="primary" onclick={makeRevisionCandidate}>수용 항목으로 수정 후보 생성</button>
          <span class="dim">체크 해제한 항목은 수정에서 제외됩니다 (사람의 결정).</span>
        </div>
      {/if}
    </section>
  {:else}
    <section>
      <div class="row">
        <span class="label">요약 - canon/summaries/{ep}.md</span>
        <button class="primary" onclick={doSummary}>요약 생성</button>
      </div>
      {#if summaryText}<pre class="pre panel">{summaryText}</pre>{:else}<p class="empty">요약이 없습니다.</p>{/if}
    </section>
    <section>
      <div class="row">
        <span class="label">정사 변경 proposal - 승인 전에는 canon에 반영되지 않습니다</span>
        <button class="primary" onclick={doCanonDelta} disabled={!summaryText}>요약에서 정사 변경 제안</button>
      </div>
    </section>
    <section>
      <div class="row">
        <span class="label">기록·픽스 - 스냅샷 후 회차를 확정하고 재개 상태를 갱신합니다</span>
        <button class="primary big" onclick={doFix} disabled={epStatus === 'fixed'}>{epStatus === 'fixed' ? '이미 픽스됨' : `${ep} 픽스`}</button>
      </div>
      {#if epStatus === 'fixed'}
        <p class="dim">픽스됨 - <button class="quiet" onclick={addNextEpisode}>다음 회차 시작</button> 또는 홈에서 재개 상태를 확인하세요.</p>
      {/if}
    </section>
  {/if}
</div>

<style>
  .surface { padding: 18px 26px; display: grid; gap: 14px; align-content: start; }
  .head { display: flex; justify-content: space-between; align-items: start; gap: 12px; flex-wrap: wrap; }
  .head h1 { margin: 0; font-size: 22px; }
  .head p { margin: 4px 0 0; display: flex; gap: 8px; align-items: center; }
  .tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--line); padding-bottom: 6px; }
  .tabs button { font-size: 12.5px; }
  .tabs button.on { background: var(--accent-soft); color: var(--text); font-weight: 650; }
  section { display: grid; gap: 8px; border-top: 1px solid var(--line); padding-top: 10px; }
  section:first-of-type { border-top: 0; }
  .exchange-line { grid-template-columns: auto minmax(120px, 180px) auto auto; align-items: center; justify-content: start; }
  .exchange { border: 1px dashed var(--line-strong); border-radius: 4px; padding: 10px; background: var(--bg-1); }
  .exchange textarea { min-height: 120px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .headrow { justify-content: space-between; }
  .inline { display: flex; gap: 5px; align-items: center; font-size: 11.5px; color: var(--muted); }
  .inline input { width: 76px; }
  .grow { flex: 1; min-width: 200px; }
  .big { padding: 7px 16px; }
  .panel { border: 1px solid var(--line); border-radius: 4px; padding: 10px; background: var(--bg-1); max-height: 380px; overflow: auto; }
  .cands { list-style: none; margin: 0; padding: 0; display: grid; }
  .cands button { display: block; width: 100%; text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--line); border-radius: 0; }
  .cands button.on { background: var(--accent-soft); }
  .cands b { margin-right: 6px; }
  .cands .sum { margin: 3px 0 0; font-size: 11.5px; }
  .deltas { border: 1px dashed var(--line-strong); border-radius: 4px; padding: 8px 10px; display: grid; gap: 3px; }
  .deltas p { margin: 0; }
  .manuscript-editor { height: 420px; min-height: 0; }
  .qa-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
  tr.off { opacity: 0.45; }
  details summary { cursor: pointer; color: var(--muted); font-size: 12.5px; }
  @media (max-width: 1000px) { .cols { grid-template-columns: 1fr; } }
</style>
