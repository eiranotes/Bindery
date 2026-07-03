<script lang="ts">
  import { styleStore } from '$lib/stores/styleStore';
  import { projectStore } from '$lib/stores/projectStore';
  import { toasts } from '$lib/stores/toastStore';
  import { exportStyleSkillPack } from '$lib/api/commands';
  import {
    STYLE_REGISTER_BY_TAG,
    analyzeKoreanSurface,
    buildPromptCapsule,
    buildStyleSkillPackFiles,
    resolveActiveStyleStack,
    scoreStyleMatch,
    type ActiveStyleStack,
    type PromptCapsule,
    type SceneClassification,
    type SceneTag,
    type StyleMatchReport,
    type StylePreset,
    type StyleRegister,
    type StyleRouter,
    type StyleRouterRule,
    type StyleRule,
    type StyleStack,
    type StyleStackAdapter
  } from '$lib/domain/style';

  const sceneTags: SceneTag[] = ['OBS', 'DIA', 'ACT', 'INF', 'CON', 'MOV', 'AFT', 'TRN', 'INT', 'REL'];
  const surfaceModes = ['dialogue-heavy', 'description-heavy', 'action-heavy', 'exposition-heavy', 'internal-heavy', 'mixed'] as const;
  const registers: StyleRegister[] = [
    'observation',
    'dialogue',
    'action',
    'exposition',
    'conflict',
    'movement',
    'aftermath',
    'quiet_transition',
    'internal_overlay',
    'relationship_overlay'
  ];
  const conflictPolicies: StyleStack['conflict_policy'][] = ['scope_priority', 'higher_weight', 'base_preserve', 'axis_merge', 'manual_lock'];
  const routeTargets: StyleRouterRule['target_type'][] = ['project_default', 'dialogue', 'scene_type', 'style_register', 'scene_id', 'character_dialogue', 'chapter', 'revision_pass'];

  let selectedSceneId = '';
  let selectedPresetId = '';
  let selectedStackId = '';
  let scoreLabText = '';
  let scoreReport: StyleMatchReport | null = null;
  let exportResult = '';
  let exporting = false;
  let seededInputId = '';

  $: s = $styleStore;
  $: if (!selectedSceneId && s.sceneClassifications[0]) selectedSceneId = s.sceneClassifications[0].scene_id;
  $: if (selectedSceneId && s.sceneClassifications.length && !s.sceneClassifications.some((cls) => cls.scene_id === selectedSceneId)) selectedSceneId = s.sceneClassifications[0].scene_id;
  $: if (!selectedPresetId && s.presets[0]) selectedPresetId = s.presets[0].preset_id;
  $: if (selectedPresetId && s.presets.length && !s.presets.some((preset) => preset.preset_id === selectedPresetId)) selectedPresetId = s.presets[0].preset_id;
  $: if (!selectedStackId && s.stacks[0]) selectedStackId = s.stacks[0].stack_id;
  $: if (selectedStackId && s.stacks.length && !s.stacks.some((stack) => stack.stack_id === selectedStackId)) selectedStackId = s.stacks[0].stack_id;
  $: if (s.step === 'system' && s.analysis && !s.presets.length && s.analysis.bundle.inputProfile.inputId !== seededInputId) {
    seededInputId = s.analysis.bundle.inputProfile.inputId;
    seedSystemDefaults();
  }

  $: selectedScene = s.sceneClassifications.find((cls) => cls.scene_id === selectedSceneId) ?? s.sceneClassifications[0];
  $: selectedPreset = s.presets.find((preset) => preset.preset_id === selectedPresetId) ?? s.presets[0];
  $: selectedStack = s.stacks.find((stack) => stack.stack_id === selectedStackId) ?? s.stacks[0];
  $: router = s.router ?? makeDefaultRouter(selectedStack?.stack_id ?? 'stack_default');
  $: scoreTarget = scoreLabText.trim() || sceneTextFor(selectedScene?.scene_id) || s.sampleText.slice(0, 1200);
  $: koreanReport = analyzeKoreanSurface(scoreTarget);
  $: skillFiles = buildStyleSkillPackFiles(projectId(), s.presets, stacksWithPresets(), router);
  $: scoreRows = scoreReport
    ? [
        ['Total', scoreReport.total_score],
        ['Global', scoreReport.global_fit],
        ['Register', scoreReport.register_fit],
        ['Scene', scoreReport.scene_classification_fit],
        ['Rhythm', scoreReport.rhythm_fit],
        ['Discourse', scoreReport.discourse_fit],
        ['Dialogue', scoreReport.dialogue_fit],
        ['Lexical', scoreReport.lexical_fit],
        ['Fluency', scoreReport.fluency]
      ]
    : [];
  $: suggestions = buildSuggestions(scoreReport, koreanReport);

  function projectRoot(): string {
    return $projectStore.current?.rootPath || 'sample-project';
  }

  function projectId(): string {
    return ($projectStore.current?.title || projectRoot().split(/[\\/]/).filter(Boolean).pop() || 'bindery-project').replace(/\s+/g, '-').toLowerCase();
  }

  function sceneTextFor(sceneId?: string): string {
    if (!sceneId) return '';
    return s.analysis?.scenes.find((scene) => scene.sceneId === sceneId)?.text ?? '';
  }

  function rule(rule_id: string, instruction: string, axis = 'analysis'): StyleRule {
    return { rule_id, instruction, axis, strength: 0.8, source: 'global' };
  }

  function makePresetFromAnalysis(): StylePreset {
    const analysis = s.analysis;
    const evidenceRules =
      analysis?.bundle.evidenceRecords
        .filter((evidence) => evidence.globalityDecision === 'global_medium' || evidence.globalityDecision === 'global_strong')
        .slice(0, 8)
        .map((evidence, index) => rule(`g_${index + 1}_${evidence.featureId}`, evidence.candidateRule, evidence.axis)) ?? [];
    const fallbackRules = evidenceRules.length ? evidenceRules : [rule('g_default', '감정 해설보다 관찰, 행동, 판단의 순서로 장면을 밀어간다.', 'rhythm')];
    const dialogueRule = rule('d_dialogue_001', '질문과 답변은 짧게 유지하고 관계 변화는 호칭과 응답 간격으로 드러낸다.', 'dialogue');
    return {
      preset_id: `preset_${Date.now().toString(36)}`,
      project_id: projectId(),
      name: analysis ? `문체 프리셋 ${s.presets.length + 1}` : '문체 프리셋',
      description: '로컬 분석 evidence에서 생성',
      preset_type: 'mixed',
      default_strength: 0.75,
      allowed_scopes: ['project', 'chapter', 'scene', 'dialogue', 'character'],
      style_axes: {
        rhythm: (analysis?.overall.shortRatio ?? 35) / 100,
        observation: (analysis?.overall.dialogueRatio ?? 30) > 45 ? 0.45 : 0.65,
        dialogue: (analysis?.overall.dialogueRatio ?? 30) / 100
      },
      register_availability: { observation: true, dialogue: true, action: true, exposition: true },
      compact_instruction: s.guide?.split('\n').find((line) => line.trim().length > 8)?.replace(/^#+\s*/, '') ?? '분석된 전역 규칙을 새 장면에 맞춰 추상적으로 적용한다.',
      global_rules: fallbackRules,
      register_rules: { dialogue: [dialogueRule] },
      overlay_rules: {
        REL: [rule('rel_overlay_001', '관계 변화는 설명보다 말투, 호칭, 침묵의 길이로 처리한다.', 'relationship')],
        INT: [rule('int_overlay_001', '판단은 직접 선언보다 관찰 뒤에 늦게 배치한다.', 'judgment')]
      },
      character_rules: {},
      negative_rules: ['원문 고유명사와 사건 구조를 가져오지 않는다.', '특정 장면의 사물 나열이나 동선 순서를 반복하지 않는다.'],
      fewshot_refs: [],
      content_terms: [],
      metrics_baseline: analysis
        ? {
            avg_sentence_len: analysis.overall.avgSentenceLen,
            short_sentence_ratio: analysis.overall.shortRatio / 100,
            long_sentence_ratio: analysis.overall.longRatio / 100,
            dialogue_ratio: analysis.overall.dialogueRatio / 100,
            paragraph_count: analysis.scenes.length
          }
        : {}
    };
  }

  function makeDefaultStack(preset: StylePreset): StyleStack {
    return {
      stack_id: `stack_${Date.now().toString(36)}`,
      project_id: projectId(),
      name: '기본 문체 스택',
      description: '프리셋 가중치와 register overlay를 조합',
      base_preset_id: preset.preset_id,
      adapters: [{ preset_id: preset.preset_id, role: 'base', weight: preset.default_strength, scope: 'global', enabled: true }],
      presets: [preset],
      conflict_policy: 'scope_priority',
      normalization: 'weighted_average',
      max_active_rules: 18,
      global_rules: [],
      register_rules: {},
      overlay_rules: {},
      character_rules: {},
      negative_rules: [],
      fewshot_refs: []
    };
  }

  function makeDefaultRouter(stackId: string): StyleRouter {
    return {
      router_id: 'router_default',
      project_id: projectId(),
      default_stack_id: stackId,
      rules: [{ rule_id: 'route_project_default', target_type: 'project_default', target_value: '*', stack_id: stackId, priority: 1, enabled: true, overlay: false }]
    };
  }

  function seedSystemDefaults() {
    const preset = makePresetFromAnalysis();
    const stack = makeDefaultStack(preset);
    const nextRouter = makeDefaultRouter(stack.stack_id);
    selectedPresetId = preset.preset_id;
    selectedStackId = stack.stack_id;
    styleStore.update((v) => ({ ...v, presets: [preset], stacks: [stack], router: nextRouter }));
  }

  function stacksWithPresets(): StyleStack[] {
    return s.stacks.map((stack) => ({ ...stack, presets: s.presets }));
  }

  function updatePreset(presetId: string, patch: Partial<StylePreset>) {
    styleStore.update((v) => ({ ...v, presets: v.presets.map((preset) => (preset.preset_id === presetId ? { ...preset, ...patch } : preset)) }));
  }

  function clonePreset(preset: StylePreset) {
    const clone = { ...preset, preset_id: `${preset.preset_id}_copy_${Date.now().toString(36)}`, name: `${preset.name} 복제` };
    selectedPresetId = clone.preset_id;
    styleStore.update((v) => ({ ...v, presets: [...v.presets, clone] }));
  }

  function archivePreset(preset: StylePreset) {
    updatePreset(preset.preset_id, { description: `[archived] ${preset.description ?? ''}`.trim() });
  }

  function updateStack(stackId: string, patch: Partial<StyleStack>) {
    styleStore.update((v) => ({ ...v, stacks: v.stacks.map((stack) => (stack.stack_id === stackId ? { ...stack, ...patch, presets: v.presets } : stack)) }));
  }

  function addAdapter() {
    if (!selectedStack || !selectedPreset) return;
    const adapter: StyleStackAdapter = { preset_id: selectedPreset.preset_id, role: 'register_overlay', weight: 0.55, scope: selectedScene?.style_register ?? 'global', enabled: true };
    updateStack(selectedStack.stack_id, { adapters: [...selectedStack.adapters, adapter] });
  }

  function updateAdapter(index: number, patch: Partial<StyleStackAdapter>) {
    if (!selectedStack) return;
    const adapters = selectedStack.adapters.map((adapter, i) => (i === index ? { ...adapter, ...patch } : adapter));
    updateStack(selectedStack.stack_id, { adapters });
  }

  function removeAdapter(index: number) {
    if (!selectedStack) return;
    updateStack(selectedStack.stack_id, { adapters: selectedStack.adapters.filter((_, i) => i !== index) });
  }

  function updateRouter(nextRouter: StyleRouter) {
    styleStore.update((v) => ({ ...v, router: nextRouter }));
  }

  function addRouterRule() {
    if (!selectedStack) return;
    const target = selectedScene?.primary_type ?? 'OBS';
    updateRouter({
      ...router,
      default_stack_id: router.default_stack_id ?? selectedStack.stack_id,
      rules: [
        ...router.rules,
        {
          rule_id: `route_${Date.now().toString(36)}`,
          target_type: 'scene_type',
          target_value: target,
          stack_id: selectedStack.stack_id,
          priority: 10,
          enabled: true,
          overlay: true,
          compatible_scene_types: [target]
        }
      ]
    });
  }

  function updateRouterRule(index: number, patch: Partial<StyleRouterRule>) {
    updateRouter({ ...router, rules: router.rules.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  }

  function removeRouterRule(index: number) {
    updateRouter({ ...router, rules: router.rules.filter((_, i) => i !== index) });
  }

  function updateClassification(sceneId: string, patch: Partial<SceneClassification>) {
    styleStore.update((v) => ({
      ...v,
      sceneClassifications: v.sceneClassifications.map((cls) => (cls.scene_id === sceneId ? { ...cls, ...patch, manual_override: true } : cls))
    }));
  }

  function toggleSecondary(cls: SceneClassification, tag: SceneTag) {
    const next = cls.secondary_types.includes(tag) ? cls.secondary_types.filter((item) => item !== tag) : [...cls.secondary_types, tag].filter((item) => item !== cls.primary_type);
    updateClassification(cls.scene_id, { secondary_types: next.slice(0, 4) });
  }

  async function previewRoute() {
    if (!selectedScene) return;
    const active = resolveActiveStyleStack({ scene_id: selectedScene.scene_id, chapter_id: selectedScene.chapter_id, classification: selectedScene }, router);
    styleStore.update((v) => ({ ...v, activeStack: active }));
  }

  async function buildCapsulePreview(activeOverride?: ActiveStyleStack) {
    if (!selectedScene) return;
    const active = activeOverride ?? s.activeStack ?? resolveActiveStyleStack({ scene_id: selectedScene.scene_id, classification: selectedScene }, router);
    const capsule: PromptCapsule = buildPromptCapsule(
      { scene_id: selectedScene.scene_id, scene_classification: selectedScene, stacks: stacksWithPresets() },
      active,
      selectedStack?.max_active_rules ?? 18
    );
    styleStore.update((v) => ({ ...v, activeStack: active, promptCapsule: capsule }));
  }

  function runScoreLab() {
    if (!scoreTarget.trim()) return;
    const style = selectedStack ? { ...selectedStack, presets: s.presets } : selectedPreset;
    if (!style) return;
    scoreReport = scoreStyleMatch(scoreTarget, style, selectedScene ?? null);
  }

  function buildSuggestions(report: StyleMatchReport | null, surface: ReturnType<typeof analyzeKoreanSurface>): string[] {
    const out: string[] = [];
    if (!report) return out;
    if (report.register_mismatch_penalty > 0) out.push('Scene register가 어긋났습니다. override에서 primary/register를 먼저 확인하세요.');
    if (report.leakage_penalty > 0) out.push('content_terms 또는 고유 사물 누수 후보가 있습니다. 새 장면 내용으로 바꿔 쓰세요.');
    if (report.overfit_penalty > 0.04) out.push('반복 n-gram 또는 문장 반복이 감지됐습니다. 동선과 사물 순서를 섞으세요.');
    if (Object.keys(surface.judgment_markers).length === 0 && selectedScene?.secondary_types.includes('INT')) out.push('INT overlay가 있는데 판단 지연 표지가 약합니다.');
    if (Object.keys(surface.relationship_markers).length === 0 && selectedScene?.secondary_types.includes('REL')) out.push('REL overlay가 있는데 호칭, 거리감, 응답 변화 표지가 약합니다.');
    return out.length ? out : ['현재 점수에서 큰 자동 제안은 없습니다.'];
  }

  async function exportPack() {
    if (!s.presets.length || !s.stacks.length) {
      toasts.push('프리셋과 스택을 먼저 생성하세요', 'warn');
      return;
    }
    exporting = true;
    try {
      const result = await exportStyleSkillPack(projectRoot(), projectId(), s.presets, stacksWithPresets(), router, 'exports/bindery-style-runtime');
      exportResult = `${result.path} · ${result.files.length} files`;
      toasts.push('SkillPack export 완료', 'ok');
    } catch (error) {
      toasts.push(`SkillPack export 실패: ${error instanceof Error ? error.message : String(error)}`, 'bad');
    } finally {
      exporting = false;
    }
  }
</script>

<div class="system-grid">
  <section class="sys-band">
    <div class="band-head">
      <div>
        <span class="line-label">Preset Manager</span>
        <h2>프리셋</h2>
      </div>
      <button class="ghost tiny" on:click={seedSystemDefaults}>생성</button>
    </div>
    {#if !s.presets.length}
      <p class="empty">분석 결과에서 프리셋을 만들 수 있습니다.</p>
    {:else}
      <div class="preset-list">
        {#each s.presets as preset}
          <button class="preset-row" class:on={selectedPresetId === preset.preset_id} on:click={() => (selectedPresetId = preset.preset_id)}>
            <b>{preset.name}</b>
            <span>{preset.preset_type} · {(preset.default_strength * 100).toFixed(0)}%</span>
          </button>
        {/each}
      </div>
      {#if selectedPreset}
        <div class="form-grid">
          <label><span>이름</span><input value={selectedPreset.name} on:input={(e) => updatePreset(selectedPreset.preset_id, { name: e.currentTarget.value })} /></label>
          <label><span>강도</span><input type="range" min="0.1" max="1" step="0.05" value={selectedPreset.default_strength} on:input={(e) => updatePreset(selectedPreset.preset_id, { default_strength: Number(e.currentTarget.value) })} /></label>
          <label class="wide"><span>요약 지침</span><textarea rows="3" value={selectedPreset.compact_instruction} on:input={(e) => updatePreset(selectedPreset.preset_id, { compact_instruction: e.currentTarget.value })}></textarea></label>
        </div>
        <div class="action-row">
          <button class="ghost tiny" on:click={() => clonePreset(selectedPreset)}>Clone</button>
          <button class="ghost tiny" on:click={() => archivePreset(selectedPreset)}>Archive</button>
        </div>
      {/if}
    {/if}
  </section>

  <section class="sys-band">
    <div class="band-head">
      <div>
        <span class="line-label">Stack Mixer</span>
        <h2>스택</h2>
      </div>
      <button class="ghost tiny" on:click={addAdapter} disabled={!selectedStack || !selectedPreset}>Adapter</button>
    </div>
    {#if selectedStack}
      <div class="form-grid">
        <label><span>Conflict</span><select value={selectedStack.conflict_policy} on:change={(e) => updateStack(selectedStack.stack_id, { conflict_policy: e.currentTarget.value as StyleStack['conflict_policy'] })}>{#each conflictPolicies as policy}<option value={policy}>{policy}</option>{/each}</select></label>
        <label><span>Max rules</span><input type="number" min="4" max="40" value={selectedStack.max_active_rules} on:input={(e) => updateStack(selectedStack.stack_id, { max_active_rules: Number(e.currentTarget.value) })} /></label>
      </div>
      <div class="adapter-list">
        {#each selectedStack.adapters as adapter, index}
          <div class="adapter-row">
            <select value={adapter.preset_id} on:change={(e) => updateAdapter(index, { preset_id: e.currentTarget.value })}>{#each s.presets as preset}<option value={preset.preset_id}>{preset.name}</option>{/each}</select>
            <select value={adapter.scope} on:change={(e) => updateAdapter(index, { scope: e.currentTarget.value as StyleStackAdapter['scope'] })}>
              <option value="global">global</option>
              {#each registers as register}<option value={register}>{register}</option>{/each}
              {#each sceneTags as tag}<option value={tag}>{tag}</option>{/each}
              <option value="dialogue">dialogue</option>
              <option value="conflict">conflict</option>
            </select>
            <input type="range" min="0" max="1" step="0.05" value={adapter.weight} on:input={(e) => updateAdapter(index, { weight: Number(e.currentTarget.value) })} />
            <button class="ghost icon-btn" aria-label="remove adapter" title="remove adapter" on:click={() => removeAdapter(index)}>×</button>
          </div>
        {/each}
      </div>
    {:else}
      <p class="empty">프리셋 생성 후 기본 스택이 만들어집니다.</p>
    {/if}
  </section>

  <section class="sys-band wide-band">
    <div class="band-head">
      <div>
        <span class="line-label">Router Editor</span>
        <h2>라우터</h2>
      </div>
      <div class="action-row">
        <button class="ghost tiny" on:click={addRouterRule} disabled={!selectedStack}>Rule</button>
        <button class="ghost tiny" on:click={previewRoute}>Preview</button>
        <button class="ghost tiny" on:click={() => buildCapsulePreview()}>Capsule</button>
      </div>
    </div>
    <div class="router-table">
      {#each router.rules as rule, index}
        <div class="router-row">
          <select value={rule.target_type} on:change={(e) => updateRouterRule(index, { target_type: e.currentTarget.value as StyleRouterRule['target_type'] })}>{#each routeTargets as target}<option value={target}>{target}</option>{/each}</select>
          <input value={rule.target_value} on:input={(e) => updateRouterRule(index, { target_value: e.currentTarget.value })} />
          <select value={rule.stack_id} on:change={(e) => updateRouterRule(index, { stack_id: e.currentTarget.value })}>{#each s.stacks as stack}<option value={stack.stack_id}>{stack.name}</option>{/each}</select>
          <input type="number" value={rule.priority} on:input={(e) => updateRouterRule(index, { priority: Number(e.currentTarget.value) })} />
          <button class="ghost icon-btn" aria-label="remove route" title="remove route" on:click={() => removeRouterRule(index)}>×</button>
        </div>
      {/each}
    </div>
    <div class="preview-strip">
      <span>route: {s.activeStack?.primary_stack_id ?? '대기'}</span>
      <span>overlay: {s.activeStack?.overlay_stack_ids.join(', ') || '없음'}</span>
      <span>capsule: {s.promptCapsule ? `${s.promptCapsule.global_rules.length + s.promptCapsule.register_rules.length + s.promptCapsule.overlay_rules.length} rules` : '대기'}</span>
    </div>
  </section>

  <section class="sys-band wide-band">
    <div class="band-head">
      <div>
        <span class="line-label">Scene Override</span>
        <h2>장면 분류 보정</h2>
      </div>
      <select class="compact-select" value={selectedSceneId} on:change={(e) => (selectedSceneId = e.currentTarget.value)}>
        {#each s.sceneClassifications as cls}<option value={cls.scene_id}>{cls.scene_id}</option>{/each}
      </select>
    </div>
    {#if selectedScene}
      <div class="override-grid">
        <label><span>Primary</span><select value={selectedScene.primary_type} on:change={(e) => updateClassification(selectedScene.scene_id, { primary_type: e.currentTarget.value as SceneTag, style_register: STYLE_REGISTER_BY_TAG[e.currentTarget.value as SceneTag] })}>{#each sceneTags as tag}<option value={tag}>{tag}</option>{/each}</select></label>
        <label><span>Surface</span><select value={selectedScene.surface_mode} on:change={(e) => updateClassification(selectedScene.scene_id, { surface_mode: e.currentTarget.value as SceneClassification['surface_mode'] })}>{#each surfaceModes as mode}<option value={mode}>{mode}</option>{/each}</select></label>
        <label><span>Register</span><select value={selectedScene.style_register} on:change={(e) => updateClassification(selectedScene.scene_id, { style_register: e.currentTarget.value as StyleRegister })}>{#each registers as register}<option value={register}>{register}</option>{/each}</select></label>
      </div>
      <div class="tag-row">
        {#each sceneTags as tag}
          <button class:on={selectedScene.secondary_types.includes(tag)} disabled={tag === selectedScene.primary_type} on:click={() => toggleSecondary(selectedScene, tag)}>{tag}</button>
        {/each}
      </div>
    {:else}
      <p class="empty">장면 분석을 먼저 실행하세요.</p>
    {/if}
  </section>

  <section class="sys-band">
    <div class="band-head">
      <div>
        <span class="line-label">Score Lab</span>
        <h2>점수</h2>
      </div>
      <button class="primary tiny" on:click={runScoreLab}>Score</button>
    </div>
    <textarea rows="7" placeholder="점수화할 새 장면을 붙여넣으세요. 비워두면 선택 장면을 사용합니다." bind:value={scoreLabText}></textarea>
    {#if scoreRows.length}
      <div class="score-grid">
        {#each scoreRows as row}
          <div><span>{row[0]}</span><b>{(Number(row[1]) * 100).toFixed(0)}</b></div>
        {/each}
      </div>
      <p class="diag">{scoreReport?.diagnostics.join(' · ')}</p>
    {/if}
  </section>

  <section class="sys-band">
    <div class="band-head">
      <div>
        <span class="line-label">Suggestion Lab</span>
        <h2>제안</h2>
      </div>
      <span class="mini-stat">{Object.keys(koreanReport.action_verbs).length} actions</span>
    </div>
    <div class="suggestions">
      {#each suggestions as item}<p>{item}</p>{/each}
    </div>
    <div class="nlp-strip">
      <span>판단 {Object.keys(koreanReport.judgment_markers).length}</span>
      <span>관계 {Object.keys(koreanReport.relationship_markers).length}</span>
      <span>감정 {Object.keys(koreanReport.emotion_markers).length}</span>
      <span>화자 수동 보정</span>
    </div>
  </section>

  <section class="sys-band wide-band">
    <div class="band-head">
      <div>
        <span class="line-label">SkillPack</span>
        <h2>내보내기</h2>
      </div>
      <button class="primary tiny" on:click={exportPack} disabled={exporting}>{exporting ? 'Exporting' : 'Export'}</button>
    </div>
    <div class="preview-strip">
      <span>{skillFiles.length} files</span>
      <span>{skillFiles.filter((file) => file.path.startsWith('references/')).length} references</span>
      <span>{exportResult || 'exports/bindery-style-runtime'}</span>
    </div>
    <div class="file-list">
      {#each skillFiles.slice(0, 12) as file}<code>{file.path}</code>{/each}
    </div>
  </section>
</div>

<style>
  .system-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); min-width: 0; }
  .sys-band { display: grid; gap: var(--space-3); align-content: start; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: var(--space-4) 0; min-width: 0; }
  .wide-band { grid-column: 1 / -1; }
  .band-head { display: flex; align-items: end; justify-content: space-between; gap: var(--space-3); min-width: 0; }
  .band-head h2 { margin: 2px 0 0; color: var(--text); font-size: 17px; line-height: 1.2; letter-spacing: 0; }
  .line-label { color: var(--faint); font-size: 10.5px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
  .tiny { padding: 5px 9px; font-size: 11.5px; }
  .empty { margin: 0; color: var(--faint); font-size: 12px; line-height: 1.6; }
  .preset-list { display: grid; border-top: 1px solid var(--line); }
  .preset-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--space-2); text-align: left; padding: var(--space-2) 0; border: 0; border-bottom: 1px solid var(--line); border-radius: 0; }
  .preset-row.on { color: var(--accent); }
  .preset-row b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; }
  .preset-row span { color: var(--faint); font-size: 11px; font-variant-numeric: tabular-nums; }
  .form-grid,
  .override-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); }
  label { min-width: 0; display: grid; gap: 4px; }
  label span { color: var(--faint); font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
  label.wide { grid-column: 1 / -1; }
  input,
  select,
  textarea {
    width: 100%;
    min-width: 0;
    border: 1px solid var(--line);
    border-radius: var(--r-sm);
    background: var(--bg-2);
    color: var(--text);
    padding: 7px 8px;
    font-size: 12px;
  }
  textarea { resize: vertical; line-height: 1.55; }
  input[type='range'] { padding: 0; accent-color: var(--accent); }
  .action-row { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
  .adapter-list,
  .router-table,
  .file-list,
  .suggestions { display: grid; gap: var(--space-2); min-width: 0; }
  .adapter-row { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(130px, 1fr) minmax(120px, .8fr) 28px; align-items: center; gap: var(--space-2); min-width: 0; }
  .router-row { display: grid; grid-template-columns: minmax(130px, .9fr) minmax(110px, 1fr) minmax(130px, 1fr) 72px 28px; align-items: center; gap: var(--space-2); min-width: 0; }
  .icon-btn { width: 28px; height: 28px; padding: 0; display: grid; place-items: center; }
  .preview-strip,
  .nlp-strip { display: flex; flex-wrap: wrap; gap: var(--space-2); min-width: 0; }
  .preview-strip span,
  .nlp-strip span,
  .mini-stat,
  .file-list code {
    min-width: 0;
    color: var(--muted);
    background: var(--accent-soft);
    border: 1px solid var(--line);
    border-radius: var(--r-sm);
    padding: 4px 7px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .compact-select { max-width: 190px; }
  .tag-row { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: var(--space-1); }
  .tag-row button { padding: 5px 0; font-size: 11px; border-radius: var(--r-sm); border-color: var(--line); }
  .tag-row button.on { background: var(--accent-soft); color: var(--accent); border-color: var(--line-strong); font-weight: 800; }
  .score-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid var(--line); border-left: 1px solid var(--line); }
  .score-grid div { display: grid; gap: 2px; padding: var(--space-2); border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); min-width: 0; }
  .score-grid span { color: var(--faint); font-size: 10px; font-weight: 800; text-transform: uppercase; }
  .score-grid b { color: var(--text); font-size: 16px; font-variant-numeric: tabular-nums; }
  .diag { margin: 0; color: var(--faint); font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
  .suggestions p { margin: 0; padding: var(--space-2) 0; border-bottom: 1px solid var(--line); color: var(--muted); font-size: 12px; line-height: 1.55; }
  .file-list { grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }

  @media (max-width: 960px) {
    .system-grid { grid-template-columns: 1fr; }
    .adapter-row,
    .router-row { grid-template-columns: 1fr 1fr; }
    .icon-btn { width: auto; }
    .tag-row { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  }
  @media (max-width: 620px) {
    .form-grid,
    .override-grid,
    .score-grid { grid-template-columns: 1fr; }
    .adapter-row,
    .router-row { grid-template-columns: 1fr; }
    .tag-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .band-head { align-items: start; display: grid; }
  }
</style>
