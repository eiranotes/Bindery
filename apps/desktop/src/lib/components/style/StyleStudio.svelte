<script lang="ts">
  import MarkdownPreview from '$lib/components/editor/MarkdownPreview.svelte';
  import StyleSystemPanel from '$lib/components/style/StyleSystemPanel.svelte';
  import { styleStore, STRICTNESS_LABEL } from '$lib/stores/styleStore';
  import type { StyleStep, StyleStrictness } from '$lib/stores/styleStore';
  import { projectStore } from '$lib/stores/projectStore';
  import { fileTreeStore } from '$lib/stores/fileTreeStore';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { toasts } from '$lib/stores/toastStore';
  import { runAgentText, writeFile, listTree } from '$lib/api/commands';
  import { validateStyleGuideline, type ContractCheck } from '$lib/domain/agentContracts';
  import {
    analyzeStyle,
    STYLE_ANALYSIS_PROCEDURE,
    buildExtractPrompt,
    buildGuidePrompt,
    buildProofPrompt,
    buildGuidelinePrompt,
    mockExtract,
    mockGuide,
    mockProof,
    mockGuideline,
    classifyScene
  } from '$lib/domain/style';

  const stages: Array<{ id: StyleStep; label: string; desc: string }> = [
    { id: 'sample', label: '샘플 입력', desc: '재현할 텍스트' },
    { id: 'analyze', label: '장면 분석', desc: '정량 + 감성' },
    { id: 'guide', label: '작성 지침', desc: '지침·금지 목록' },
    { id: 'proof', label: '재현 테스트', desc: '새 장면 샘플' },
    { id: 'final', label: '지침서', desc: '집필 반영' },
    { id: 'system', label: '문체 시스템', desc: '프리셋·스택' }
  ];

  let running: StyleStep | null = null;
  let offlineNotice = false;
  const strictnessOptions = Object.keys(STRICTNESS_LABEL) as StyleStrictness[];
  const strictnessHint: Record<StyleStrictness, string> = {
    flexible: '지침은 지향점. 장면이 우선, 금지 목록만 준수',
    balanced: '기본 준수 + 장면 필요 시 20% 내외 이탈 허용',
    strict: '엄격 준수. 금지 위반은 실패로 간주'
  };

  $: s = $styleStore;
  $: sampleChars = s.sampleText.replace(/\s/g, '').length;
  $: agentReady = Boolean($settingsStore.agentCliPath) && !$settingsStore.mockMode;
  $: evidenceCount = s.analysis?.bundle.evidenceRecords.length ?? 0;
  $: globalRuleCount =
    s.analysis?.bundle.evidenceRecords.filter((e) => e.globalityDecision === 'global_medium' || e.globalityDecision === 'global_strong').length ?? 0;
  $: sceneClassifications = s.sceneClassifications.length
    ? s.sceneClassifications
    : s.analysis?.scenes.map((sc) => classifyScene(sc.text, { scene_id: sc.sceneId, chapter_id: 'CH001' })) ?? [];

  function procedureStatus(owner: 'local' | 'ai') {
    if (owner === 'local') return s.analysis ? '완료' : '대기';
    if (s.extract) return '완료';
    return s.analysis ? 'AI 보강 필요' : '대기';
  }

  function procedureTone(owner: 'local' | 'ai') {
    if (owner === 'local') return s.analysis ? 'ok' : 'neutral';
    if (s.extract) return 'ok';
    return s.analysis ? 'warn' : 'neutral';
  }

  function decisionLabel(decision: string) {
    return decision === 'global_strong'
      ? '전역 강함'
      : decision === 'global_medium'
        ? '전역'
        : decision === 'register_specific'
          ? '유형 한정'
          : decision === 'local'
            ? '장면 한정'
            : decision === 'prohibited'
              ? '전이 금지'
              : '불확실';
  }

  const featureLabels: Record<string, string> = {
    observation: '관찰',
    dialogue: '대화',
    exposition: '설명',
    movement: '동선',
    conflict: '긴장',
    aftermath: '후처리',
    quiet_transition: '전환',
    OBS: '관찰',
    DIA: '대화',
    ACT: '행동',
    INF: '정보',
    CON: '갈등',
    MOV: '이동',
    AFT: '후처리',
    TRN: '전환',
    INT: '내면',
    REL: '관계',
    short_burst: '단문',
    medium_controlled: '중간',
    compressed_long_sentence: '장문',
    sensory: '감각',
    judgment_delay: '유예',
    question: '질문',
    emphasis: '강조',
    statement: '평서',
    direct_naming: '직접',
    indirect_or_deferred: '우회',
    neutral_or_unmarked: '중립',
    surface_closure: '마감',
    pacing: '박자',
    emotion_handling: '감정',
    dialogue_rhythm: '대화',
    information_distribution: '정보'
  };

  function featureLabel(value: string) {
    return featureLabels[value] ?? value;
  }

  function goto(step: StyleStep) {
    styleStore.update((v) => ({ ...v, step }));
  }

  type StageState = { text: string; tone: 'ok' | 'warn' | 'neutral' };
  $: railStates = {
    sample: (sampleChars > 0 ? { text: `${sampleChars.toLocaleString()}자`, tone: sampleChars >= 1500 ? 'ok' : 'warn' } : { text: '비어 있음', tone: 'neutral' }) as StageState,
    analyze: (s.analysis ? { text: `장면 ${s.analysis.scenes.length}개${s.extract ? ' · 문체 추출됨' : ''}`, tone: s.extract ? 'ok' : 'warn' } : { text: '대기', tone: 'neutral' }) as StageState,
    guide: (s.guide ? { text: '지침 생성됨', tone: 'ok' } : { text: '대기', tone: 'neutral' }) as StageState,
    proof: (s.proof ? { text: '샘플 있음', tone: 'ok' } : { text: '대기', tone: 'neutral' }) as StageState,
    final: (s.guideline ? { text: s.savedPath ? '저장·집필 반영' : '생성됨', tone: 'ok' } : { text: '대기', tone: 'neutral' }) as StageState,
    system: (s.presets.length ? { text: `${s.presets.length} preset · ${s.stacks.length} stack`, tone: 'ok' } : s.analysis ? { text: '생성 가능', tone: 'warn' } : { text: '대기', tone: 'neutral' }) as StageState
  } satisfies Record<StyleStep, StageState>;

  function projectRoot(): string {
    return $projectStore.current?.rootPath || 'sample-project';
  }

  /** AI 실행: 실패하거나 오프라인이면 정량 분석 기반 기본 문서로 대체하고 표시한다. */
  async function agentOrMock(prompt: string, label: string, mock: string, validate?: (text: string) => ContractCheck): Promise<string> {
    const r = await runAgentText(projectRoot(), prompt, label);
    if (r.ok && r.text.trim()) {
      const check = validate?.(r.text.trim()) ?? { ok: true };
      if (!check.ok) {
        offlineNotice = true;
        toasts.push(`${label} 산출물 계약 불일치: ${check.reason ?? 'unknown'} · 오프라인 기본값 사용`, 'warn');
        return mock;
      }
      offlineNotice = false;
      return r.text.trim();
    }
    offlineNotice = true;
    return mock;
  }

  function runAnalyze() {
    if (sampleChars < 200) {
      toasts.push('샘플이 너무 짧습니다. 최소 200자, 권장 1,500자 이상을 붙여넣으세요.', 'warn');
      return;
    }
    const analysis = analyzeStyle(s.sampleText);
    const sceneClassifications = analysis.scenes.map((sc) => classifyScene(sc.text, { scene_id: sc.sceneId, chapter_id: 'CH001' }));
    styleStore.update((v) => ({ ...v, analysis, sceneClassifications, extract: null, activeStack: null, promptCapsule: null, step: 'analyze' }));
    toasts.push(`장면 ${analysis.scenes.length}개로 나눠 분석했습니다`, 'ok');
  }

  async function runExtract() {
    if (!s.analysis) return;
    running = 'analyze';
    try {
      const text = await agentOrMock(buildExtractPrompt(s.sampleText, s.analysis), 'style-extract', mockExtract(s.analysis));
      styleStore.update((v) => ({ ...v, extract: text }));
      toasts.push(offlineNotice ? '오프라인 기본 분석을 생성했습니다' : '문체 추출 완료', offlineNotice ? 'warn' : 'ok');
    } finally {
      running = null;
    }
  }

  async function runGuide() {
    if (!s.analysis) return;
    running = 'guide';
    try {
      const extract = s.extract ?? mockExtract(s.analysis);
      const text = await agentOrMock(buildGuidePrompt(s.sampleText, s.analysis, extract), 'style-guide', mockGuide(s.analysis));
      styleStore.update((v) => ({ ...v, guide: text }));
      toasts.push(offlineNotice ? '오프라인 기본 지침을 생성했습니다' : '작성 지침 생성 완료', offlineNotice ? 'warn' : 'ok');
    } finally {
      running = null;
    }
  }

  async function runProof() {
    if (!s.guide) return;
    running = 'proof';
    try {
      const text = await agentOrMock(buildProofPrompt(s.guide, s.extract ?? '', s.sampleText), 'style-proof', mockProof());
      styleStore.update((v) => ({ ...v, proof: text }));
      toasts.push(offlineNotice ? '오프라인 샘플을 생성했습니다' : '재현 샘플 생성 완료. 원문 느낌과 비교해보세요', offlineNotice ? 'warn' : 'ok');
    } finally {
      running = null;
    }
  }

  async function runFinalize() {
    if (!s.analysis || !s.guide) return;
    running = 'final';
    try {
      const text = await agentOrMock(
        buildGuidelinePrompt(s.extract ?? '', s.guide, s.proof ?? '', s.analysis),
        'style-guideline',
        mockGuideline(s.analysis),
        validateStyleGuideline
      );
      styleStore.update((v) => ({ ...v, guideline: text, savedPath: null }));
      toasts.push(offlineNotice ? '오프라인 기본 지침서를 생성했습니다' : '문체 지침서 생성 완료', offlineNotice ? 'warn' : 'ok');
    } finally {
      running = null;
    }
  }

  let saving = false;
  async function saveGuideline() {
    if (!s.guideline) return;
    saving = true;
    try {
      await writeFile(projectRoot(), 'canon/style-guide.md', s.guideline);
      const nodes = await listTree(projectRoot());
      fileTreeStore.update((v) => ({ ...v, nodes }));
      styleStore.update((v) => ({ ...v, savedPath: 'canon/style-guide.md' }));
      toasts.push('지침서 저장됨: canon/style-guide.md. AI 작업 바이블에서도 보입니다', 'ok');
    } catch (e) {
      toasts.push(`저장 실패: ${e instanceof Error ? e.message : String(e)}`, 'bad');
    } finally {
      saving = false;
    }
  }

  function resetAll() {
    styleStore.update((v) => ({
      ...v,
      analysis: null,
      extract: null,
      guide: null,
      proof: null,
      guideline: null,
      sceneClassifications: [],
      presets: [],
      stacks: [],
      router: null,
      activeStack: null,
      promptCapsule: null,
      savedPath: null,
      step: 'sample'
    }));
  }
</script>

<div class="style-studio">
  <aside class="st-rail" aria-label="문체 재현 단계">
    <div class="rail-head">
      <span class="eyebrow">문체</span>
      <h2>문체 재현</h2>
      <p class="rail-target">{agentReady ? 'AI 연결됨' : '오프라인: 기본 생성'}</p>
    </div>

    <nav class="rail-stages">
      {#each stages as st, i}
        <button class="rail-stage" class:on={s.step === st.id} on:click={() => goto(st.id)}>
          <b>0{i + 1}</b>
          <span class="rs-copy">
            <span class="rs-name">{st.label}</span>
            <small>{railStates[st.id].text}</small>
          </span>
          <span class="dot {railStates[st.id].tone}"></span>
        </button>
      {/each}
    </nav>

    <p class="rail-note">목표는 수치 복사가 아니라 <b>읽었을 때의 느낌</b> 재현입니다. 원문 문장 복사·반복은 지침으로 금지됩니다. 확정된 지침서는 초안 후보 프롬프트에 자동 포함됩니다.</p>
  </aside>

  <section class="st-stage">
    {#if s.step === 'sample'}
      <header class="stage-head">
        <span class="eyebrow">01 샘플 입력</span>
        <h1>재현할 텍스트 붙여넣기</h1>
        <p>문체를 재현하고 싶은 글을 붙여넣습니다. 장면이 나뉘는 긴 글일수록 분석이 정확해집니다 (권장 1,500자 이상, 최대 약 6,000자 분석).</p>
      </header>
      <div class="stage-body">
        <textarea
          class="sample-input"
          rows="16"
          placeholder="여기에 샘플 텍스트를 붙여넣으세요. 장면 구분(빈 줄 두 개, ***, 소제목)이 있으면 그대로 인식합니다."
          value={s.sampleText}
          on:input={(e) => styleStore.update((v) => ({ ...v, sampleText: e.currentTarget.value }))}
        ></textarea>
        <div class="stage-actions">
          <button class="primary" on:click={runAnalyze}>장면 분석 →</button>
          <span class="count-hint">{sampleChars.toLocaleString()}자 (공백 제외)</span>
          {#if s.analysis}<button class="ghost" on:click={resetAll}>처음부터</button>{/if}
        </div>
      </div>
    {:else if s.step === 'analyze'}
      <header class="stage-head">
        <span class="eyebrow">02 장면 분석</span>
        <h1>장면별 구조와 문체 추출</h1>
        <p>먼저 로컬 MVP 절차로 scene, feature, evidence, capsule을 만들고, AI는 그 위에서 호흡·온도·거리감 같은 감성 층위를 보강합니다.</p>
      </header>
      <div class="stage-body">
        {#if !s.analysis}
          <p class="stage-note">샘플이 없습니다. 01 단계에서 텍스트를 먼저 붙여넣으세요.</p>
        {:else}
          <div class="procedure-panel" aria-label="문체 분석 절차">
            <div class="procedure-head">
              <span class="line-label">MVP 분석 절차</span>
              <strong>로컬 분석 먼저, AI는 해석 보강</strong>
            </div>
            <div class="procedure-grid">
              {#each STYLE_ANALYSIS_PROCEDURE as step}
                <div class="proc-step {procedureTone(step.owner)}" class:ai={step.owner === 'ai'}>
                  <span class="proc-owner">{step.owner === 'local' ? '로컬' : 'AI'}</span>
                  <b>{step.label}</b>
                  <small>{step.output}</small>
                  <em>{procedureStatus(step.owner)}</em>
                </div>
              {/each}
            </div>
          </div>

          <div class="local-summary" aria-label="로컬 분석 요약">
            <div>
              <b>{s.analysis.bundle.inputProfile.paragraphCount}</b>
              <span>묶음 후보</span>
            </div>
            <div>
              <b>{s.analysis.scenes.length}</b>
              <span>scene 기록</span>
            </div>
            <div>
              <b>{evidenceCount}</b>
              <span>F_RULE evidence</span>
            </div>
            <div>
              <b>{globalRuleCount}</b>
              <span>전역 규칙</span>
            </div>
          </div>

          <div class="scene-table route-table" role="table" aria-label="장면분류 및 register">
            <div class="scene-row head" role="row">
              <span>장면</span><span>Primary</span><span>Secondary</span><span>Register</span>
            </div>
            {#each sceneClassifications as cls}
              <div class="scene-row" role="row">
                <span class="sc-title">{cls.scene_id}</span>
                <span class="sc-type">{featureLabel(cls.primary_type)} · {(cls.confidence * 100).toFixed(0)}%</span>
                <span class="sc-metrics">{cls.secondary_types.length ? cls.secondary_types.map(featureLabel).join(', ') : '없음'} · {cls.surface_mode}</span>
                <span class="sc-surface">{featureLabel(cls.style_register)} · {cls.narrative_functions.join(', ') || '기능 없음'}</span>
              </div>
            {/each}
          </div>

          <div class="scene-table" role="table" aria-label="장면별 정량 분석">
            <div class="scene-row head" role="row">
              <span>장면</span><span>기능</span><span>수치</span><span>표층</span>
            </div>
            {#each s.analysis.scenes as sc}
              <div class="scene-row" role="row">
                <span class="sc-title" title={sc.title}>{sc.index}. {sc.title}</span>
                <span class="sc-type" title={sc.sceneFunction}>{sc.sceneTypes.map(featureLabel).join(', ')}</span>
                <span class="sc-metrics">문장 {sc.sentenceCount} · 평균 {sc.avgSentenceLen}자 · 대사 {sc.dialogueRatio}%</span>
                <span
                  class="sc-surface"
                  title={`${featureLabel(sc.pacingDuration)} · ${featureLabel(sc.closingDevice)} · ${featureLabel(sc.emotionDistance)} · ${sc.endings.slice(0, 3).map((e) => e.form).join(' · ') || '어미 없음'}`}
                >
                  {featureLabel(sc.pacingDuration)} · {featureLabel(sc.closingDevice)} · {featureLabel(sc.emotionDistance)} · {sc.endings.slice(0, 3).map((e) => e.form).join(' · ') || '어미 없음'}
                </span>
              </div>
            {/each}
          </div>

          {#if s.analysis.bundle.evidenceRecords.length}
            <div class="evidence-panel" aria-label="Evidence rules">
              <div class="procedure-head">
                <span class="line-label">Evidence</span>
                <strong>반복 feature에서 생성된 규칙 후보</strong>
              </div>
              <div class="evidence-list">
                {#each s.analysis.bundle.evidenceRecords.slice(0, 6) as evidence}
                  <div class="evidence-row">
                    <span class="evidence-id">{evidence.featureId}</span>
                    <b>{decisionLabel(evidence.globalityDecision)}</b>
                    <span title={evidence.axis}>{featureLabel(evidence.axis)}</span>
                    <p>{evidence.candidateRule}</p>
                  </div>
                {/each}
              </div>
            </div>
          {:else}
            <p class="stage-note">반복 feature가 부족해 evidence는 아직 생성되지 않았습니다. 샘플 장면을 더 넣으면 전역 규칙 후보가 늘어납니다.</p>
          {/if}

          <div class="stage-actions">
            <button class="primary" on:click={runExtract} disabled={running !== null}>{running === 'analyze' ? '추출 중…' : s.extract ? '문체 다시 추출 (AI)' : '문체 추출 (AI)'}</button>
            {#if s.extract}<button class="ghost" on:click={() => goto('guide')}>다음: 작성 지침 →</button>{/if}
          </div>

          {#if s.extract}
            <div class="md-output"><MarkdownPreview content={s.extract} /></div>
          {/if}
        {/if}
      </div>
    {:else if s.step === 'guide'}
      <header class="stage-head">
        <span class="eyebrow">03 작성 지침</span>
        <h1>장면별 지침과 금지 목록</h1>
        <p>분석을 실행 지침으로 바꿉니다. 장면 유형별로 무엇을 하고, 어떤 단어·묘사가 이 문체를 깨뜨리는지 명시합니다.</p>
      </header>
      <div class="stage-body">
        {#if !s.analysis}
          <p class="stage-note">02 장면 분석을 먼저 실행하세요.</p>
        {:else}
          <div class="stage-actions">
            <button class="primary" on:click={runGuide} disabled={running !== null}>{running === 'guide' ? '생성 중…' : s.guide ? '지침 다시 생성' : '지침 생성'}</button>
            {#if s.guide}<button class="ghost" on:click={() => goto('proof')}>다음: 재현 테스트 →</button>{/if}
          </div>
          {#if s.guide}
            <div class="md-output"><MarkdownPreview content={s.guide} /></div>
          {:else}
            <p class="stage-note">지침에는 장면 유형별 작성 규칙, 금지어, 금지 묘사, 리듬 규칙이 포함됩니다.</p>
          {/if}
        {/if}
      </div>
    {:else if s.step === 'proof'}
      <header class="stage-head">
        <span class="eyebrow">04 재현 테스트</span>
        <h1>원문에 없는 장면으로 검증</h1>
        <p>지침만으로 완전히 새로운 장면을 쓰게 해서, 문장 복사 없이 문체의 느낌이 재현되는지 직접 읽고 판단합니다.</p>
      </header>
      <div class="stage-body">
        {#if !s.guide}
          <p class="stage-note">03 작성 지침을 먼저 생성하세요.</p>
        {:else}
          <div class="stage-actions">
            <button class="primary" on:click={runProof} disabled={running !== null}>{running === 'proof' ? '작성 중…' : s.proof ? '샘플 다시 작성' : '재현 샘플 작성'}</button>
            {#if s.proof}<button class="ghost" on:click={() => goto('final')}>다음: 지침서 →</button>{/if}
          </div>
          {#if s.proof}
            <div class="md-output"><MarkdownPreview content={s.proof} /></div>
            <p class="stage-note">느낌이 다르면 03 단계로 돌아가 지침을 다시 생성하거나, 샘플 텍스트를 더 넣어 분석 정확도를 높이세요.</p>
          {/if}
        {/if}
      </div>
    {:else if s.step === 'final'}
      <header class="stage-head">
        <span class="eyebrow">05 지침서</span>
        <h1>최종 문체 지침서</h1>
        <p>분석·지침·재현 테스트를 하나의 지침서로 통합합니다. 저장하면 <code>canon/style-guide.md</code>로 기록되고, AI 초안 후보 프롬프트에 자동 포함됩니다.</p>
      </header>
      <div class="stage-body">
        {#if !s.guide}
          <p class="stage-note">03 작성 지침까지 먼저 완료하세요.</p>
        {:else}
          <div class="stage-actions">
            <button class="primary" on:click={runFinalize} disabled={running !== null}>{running === 'final' ? '작성 중…' : s.guideline ? '지침서 다시 생성' : '지침서 생성'}</button>
            {#if s.guideline}
              <button class="ghost" on:click={saveGuideline} disabled={saving}>{saving ? '저장 중…' : s.savedPath ? '다시 저장' : '프로젝트에 저장'}</button>
              <button class="ghost" on:click={() => goto('system')}>문체 시스템 →</button>
              <label class="apply-check">
                <input type="checkbox" checked={s.applyToDraft} on:change={(e) => styleStore.update((v) => ({ ...v, applyToDraft: e.currentTarget.checked }))} />
                집필 프롬프트에 반영
              </label>
            {/if}
          </div>
          {#if s.guideline}
            <div class="strictness-row">
              <span class="line-label">적용 강도: 너무 강하게 강제하면 문장이 딱딱해집니다</span>
              <div class="strictness-opts">
                {#each strictnessOptions as st}
                  <button class="strict-opt" class:on={s.strictness === st} on:click={() => styleStore.update((v) => ({ ...v, strictness: st }))}>
                    <b>{STRICTNESS_LABEL[st]}</b>
                    <small>{strictnessHint[st]}</small>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
          {#if s.savedPath}<p class="stage-note ok">저장됨: {s.savedPath}. AI 작업 02 바이블과 산출물 보관함에서 확인할 수 있습니다.</p>{/if}
          {#if s.guideline}
            <div class="md-output"><MarkdownPreview content={s.guideline} /></div>
          {/if}
        {/if}
      </div>
    {:else if s.step === 'system'}
      <header class="stage-head">
        <span class="eyebrow">06 문체 시스템</span>
        <h1>프리셋, 스택, 라우터 관리</h1>
        <p>분석 결과를 재사용 가능한 문체 프리셋과 라우팅 규칙으로 관리합니다. 장면 분류 보정, 점수 실험, SkillPack 내보내기를 여기서 마무리합니다.</p>
      </header>
      <div class="stage-body">
        <StyleSystemPanel />
      </div>
    {/if}
  </section>
</div>

<style>
  .style-studio { min-height: 0; display: grid; grid-template-columns: 236px minmax(0, 1fr); }
  .st-rail {
    display: grid;
    grid-template-rows: auto 1fr auto;
    align-content: start;
    gap: 14px;
    padding: 18px 16px;
    border-right: 1px solid var(--line);
    background: var(--bg-1);
    min-height: 0;
    overflow: auto;
  }
  .rail-head h2 { margin: 3px 0 6px; font-size: 19px; line-height: 1.15; }
  .rail-target { margin: 0; color: var(--faint); font-size: 11.5px; }
  .rail-stages { display: grid; align-content: start; border-top: 1px solid var(--line); }
  .rail-stage {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) 10px;
    gap: 10px;
    align-items: center;
    text-align: left;
    padding: 12px 4px;
    border: 0;
    border-bottom: 1px solid var(--line);
    border-radius: 0;
    position: relative;
  }
  .rail-stage b { color: var(--faint); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; font-weight: 600; }
  .rail-stage.on b { color: var(--accent); }
  .rail-stage.on::before { content: ''; position: absolute; left: -16px; top: 10px; bottom: 10px; width: 2px; background: var(--accent); }
  .rs-copy { min-width: 0; display: grid; gap: 2px; }
  .rs-name { color: var(--text); font-weight: 650; font-size: 13.5px; }
  .rail-stage small { color: var(--muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rail-note { margin: 0; color: var(--faint); font-size: 11.5px; line-height: 1.6; border-top: 1px solid var(--line); padding-top: 12px; }
  .rail-note b { color: var(--muted); }

  .st-stage { min-height: 0; overflow: auto; padding: 22px 26px; min-width: 0; }
  .stage-head { max-width: 820px; padding-bottom: 16px; border-bottom: 1px solid var(--line); }
  .stage-head h1 { margin: 4px 0 7px; font-size: 24px; line-height: 1.12; letter-spacing: 0; }
  .stage-head p { margin: 0; color: var(--muted); line-height: 1.65; }
  .stage-head code { background: var(--accent-soft); border-radius: 4px; padding: 1px 5px; font-family: ui-monospace, monospace; font-size: .9em; }
  .stage-body { padding-top: 18px; display: grid; gap: 16px; align-content: start; max-width: min(1120px, 100%); min-width: 0; }
  .stage-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .stage-note { margin: 0; color: var(--faint); font-size: 12px; line-height: 1.6; }
  .stage-note.ok { color: var(--ok); }

  .procedure-panel,
  .evidence-panel {
    display: grid;
    gap: var(--space-3);
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    padding: var(--space-3) 0;
  }
  .procedure-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); min-width: 0; }
  .procedure-head strong { color: var(--text); font-size: 13px; line-height: 1.35; min-width: 0; text-align: right; }
  .procedure-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(152px, 1fr)); gap: var(--space-2); }
  .proc-step {
    min-width: 0;
    display: grid;
    gap: 3px;
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    background: var(--bg-2);
  }
  .proc-step.ok { border-color: color-mix(in srgb, var(--ok) 42%, var(--line)); background: var(--ok-soft); }
  .proc-step.warn { border-color: color-mix(in srgb, var(--warn) 42%, var(--line)); background: var(--warn-soft); }
  .proc-step b { color: var(--text); font-size: 12.5px; line-height: 1.25; }
  .proc-step small { color: var(--muted); font-size: 10.5px; line-height: 1.35; min-height: 28px; }
  .proc-step em { color: var(--faint); font-style: normal; font-size: 10.5px; font-weight: 700; }
  .proc-owner {
    width: fit-content;
    color: var(--faint);
    border: 1px solid var(--line);
    border-radius: var(--r-sm);
    padding: 1px 5px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0;
  }
  .proc-step.ai .proc-owner { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 38%, var(--line)); }

  .local-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
  }
  .local-summary div { display: grid; gap: 2px; padding: var(--space-3) 0; }
  .local-summary div + div { border-left: 1px solid var(--line); padding-left: var(--space-3); }
  .local-summary b { color: var(--text); font-size: 18px; line-height: 1; font-variant-numeric: tabular-nums; }
  .local-summary span { color: var(--faint); font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }

  .sample-input {
    width: 100%;
    resize: vertical;
    background: var(--bg-desk);
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    padding: 14px;
    font-family: var(--manuscript-font);
    font-size: 14px;
    line-height: 1.9;
  }
  .count-hint { color: var(--faint); font-size: 12px; font-variant-numeric: tabular-nums; }

  .scene-table { display: grid; border-top: 1px solid var(--line); font-size: 12px; min-width: 0; width: 100%; }
  .scene-row {
    display: grid;
    grid-template-columns: minmax(180px, 1.25fr) minmax(124px, .8fr) minmax(178px, 1fr) minmax(220px, 1.15fr);
    gap: 12px;
    align-items: center;
    padding: 9px 0;
    border-bottom: 1px solid var(--line);
    color: var(--text);
    min-width: 0;
  }
  .scene-row.head { color: var(--faint); font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
  .scene-row span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .sc-title { color: var(--text); font-weight: 650; }
  .sc-type,
  .sc-metrics,
  .sc-surface { color: var(--muted); }

  .evidence-list { display: grid; gap: 0; border-top: 1px solid var(--line); }
  .evidence-row {
    display: grid;
    grid-template-columns: 86px 72px 110px minmax(0, 1fr);
    align-items: baseline;
    gap: var(--space-2);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--line);
    font-size: 12px;
  }
  .evidence-id { color: var(--accent); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
  .evidence-row b { color: var(--text); font-size: 11.5px; }
  .evidence-row span { color: var(--muted); }
  .evidence-row p { margin: 0; color: var(--muted); line-height: 1.45; min-width: 0; }

  .md-output {
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    background: var(--bg-2);
    max-height: 520px;
    overflow: auto;
  }
  .md-output :global(.preview) { border-left: 0; padding: 18px 22px; font-size: 13.5px; line-height: 1.85; }
  .apply-check { display: inline-flex; align-items: center; gap: 7px; color: var(--muted); font-size: 12.5px; }
  .line-label { color: var(--faint); font-size: 10.5px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
  .strictness-row { display: grid; gap: 8px; border-top: 1px solid var(--line); padding-top: 12px; }
  .strictness-opts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; max-width: 640px; }
  .strict-opt { display: grid; gap: 3px; text-align: left; border: 1px solid var(--line); border-radius: var(--r-md); padding: 9px 11px; }
  .strict-opt.on { border-color: color-mix(in srgb, var(--accent) 50%, transparent); background: var(--accent-soft); }
  .strict-opt b { color: var(--text); font-size: 12.5px; }
  .strict-opt small { color: var(--muted); font-size: 10.5px; line-height: 1.4; }

  @media (max-width: 1100px) {
    .style-studio { grid-template-columns: 1fr; }
    .st-rail { grid-template-rows: none; border-right: 0; border-bottom: 1px solid var(--line); }
    .rail-stages { grid-template-columns: repeat(2, 1fr); }
    .rail-stage.on::before { display: none; }
    .rail-stage.on { background: var(--accent-soft); }
  }
  @media (max-width: 900px) {
    .scene-row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    .scene-row.head { display: none; }
    .scene-row span::before {
      display: block;
      margin-bottom: 2px;
      color: var(--faint);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .06em;
      text-transform: uppercase;
    }
    .scene-row span:nth-child(1)::before { content: '장면'; }
    .scene-row span:nth-child(2)::before { content: '기능'; }
    .scene-row span:nth-child(3)::before { content: '수치'; }
    .scene-row span:nth-child(4)::before { content: '표층'; }
  }
  @media (max-width: 700px) {
    .st-stage { padding: 16px; }
    .rail-stages { grid-template-columns: 1fr; }
    .procedure-head { display: grid; }
    .procedure-grid,
    .local-summary { grid-template-columns: 1fr; }
    .local-summary div + div { border-left: 0; border-top: 1px solid var(--line); padding-left: 0; }
    .scene-row { grid-template-columns: 1fr; gap: 7px; }
    .evidence-row { grid-template-columns: 1fr; gap: 3px; }
  }
</style>
