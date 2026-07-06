<script lang="ts">
  // 설정 - AI 실행기(CLI) 프로필. 특정 provider 고정 없음, 사용자가 명령과 인자를 소유한다.
  // 저장 위치: 프로젝트의 .bindery/settings.json (local-first).
  import { ctx, settings, persistSettings, withBusy, toast } from '$lib/stores/app';
  import {
    PROVIDER_PRESETS, STAGE_GROUPS, applyPreset, toAgentSettings, toAgentSettingsForTier,
    type AgentTier, type TierProfile
  } from '$lib/harness/agentSettings';

  let argsText = $state('');
  let argsWithModelText = $state('');
  let testResult = $state('');

  $effect(() => {
    argsText = $settings.argsTemplate.join(' ');
    argsWithModelText = $settings.argsWithModel.join(' ');
  });

  function pick(presetId: string) {
    settings.update((s) => applyPreset(s, presetId));
  }

  function syncArgs() {
    settings.update((s) => ({
      ...s,
      argsTemplate: argsText.split(/\s+/).filter(Boolean),
      argsWithModel: argsWithModelText.split(/\s+/).filter(Boolean)
    }));
  }

  async function save() {
    syncArgs();
    await persistSettings();
  }

  async function runConnectionTest(label: string, tier: AgentTier) {
    syncArgs();
    testResult = '';
    await withBusy(`연결 테스트 (${label})`, async () => {
      const c = ctx();
      const agent = toAgentSettingsForTier($settings, tier);
      const result = await c.bridge.runAgent(
        c.root,
        '아래 단어 하나만 출력하라: BINDERY-OK',
        `connection-test-${tier}`,
        agent
      );
      testResult = result.ok
        ? `[${label} · ${agent.command}${agent.model ? ` · ${agent.model}` : ''}] 응답 확인 (exit ${result.exitCode}, ${result.durationMs}ms): ${result.text.slice(0, 200)}`
        : `[${label}] 실패 (${result.mode}, exit ${result.exitCode}): ${result.stderr.slice(0, 300) || '출력 없음'}`;
      toast(result.ok ? `${label} 실행기 응답 확인` : `${label} 실행기 연결 실패`, result.ok ? 'ok' : 'bad');
    }, false);
  }

  const test = () => runConnectionTest('기본', 'standard');

  // 티어 프로필 편집 헬퍼 — settings.profiles[tier]를 부분 갱신한다.
  const TIER_LABELS: Record<Exclude<AgentTier, 'standard'>, string> = { light: '경량', heavy: '고급' };
  const TIERS: Array<Exclude<AgentTier, 'standard'>> = ['light', 'heavy'];

  function updateProfile(tier: Exclude<AgentTier, 'standard'>, patch: Partial<TierProfile>) {
    settings.update((s) => ({
      ...s,
      profiles: { ...s.profiles, [tier]: { ...s.profiles[tier], ...patch } }
    }));
  }

  function pickProfilePreset(tier: Exclude<AgentTier, 'standard'>, presetId: string) {
    const preset = PROVIDER_PRESETS.find((p) => p.id === presetId) ?? PROVIDER_PRESETS[0];
    updateProfile(tier, {
      provider: preset.id,
      command: preset.id === 'custom' ? $settings.profiles[tier].command : preset.command,
      argsTemplate: [...preset.argsTemplate],
      argsWithModel: [...preset.argsWithModel],
      outputMode: preset.outputMode
    });
  }

  const tierName = (tier: AgentTier) =>
    tier === 'standard' ? '기본' : TIER_LABELS[tier];

  /** 티어가 실제로 어떤 실행기를 쓰게 되는지 요약 (폴백 포함). */
  function tierSummary(tier: AgentTier): string {
    const a = toAgentSettingsForTier($settings, tier);
    return `${a.command || '(미설정)'}${a.model ? ` · ${a.model}` : ''}`;
  }
</script>

<div class="surface">
  <header class="head">
    <h1>설정 - AI 실행기</h1>
    <p class="dim">CLI 명령과 인자를 직접 설정합니다. {'{prompt}'} {'{model}'} 자리가 실행 시 치환됩니다. 저장: .bindery/settings.json</p>
  </header>

  <section>
    <span class="label">화면 모드</span>
    <div class="row">
      <button class:on={$settings.uiMode !== 'advanced'} onclick={() => settings.update((s) => ({ ...s, uiMode: 'simple' }))}>간단 모드</button>
      <button class:on={$settings.uiMode === 'advanced'} onclick={() => settings.update((s) => ({ ...s, uiMode: 'advanced' }))}>설계자 모드</button>
    </div>
    <p class="dim">간단 모드는 자동화 중심의 최소 화면(홈·집필·작품노트·보류함)만 보여줍니다.
      설계자 모드는 소재·세계관·플롯·회차·제안 화면과 실행 기록(run)·packet 교환 등 파이프라인 전체를 노출합니다.</p>
  </section>

  <section>
    <span class="label">프리셋</span>
    <div class="row">
      {#each PROVIDER_PRESETS as p}
        <button class:on={$settings.provider === p.id} onclick={() => pick(p.id)}>{p.label}</button>
      {/each}
    </div>
  </section>

  <section class="form">
    <label>명령어<input bind:value={$settings.command} placeholder="codex / claude / gemini / /절대/경로" /></label>
    <label>인자 (모델 미지정 시)<input bind:value={argsText} onblur={syncArgs} class="mono" /></label>
    <label>인자 (모델 지정 시)<input bind:value={argsWithModelText} onblur={syncArgs} class="mono" /></label>
    <label>모델 (선택)<input bind:value={$settings.model} placeholder="비우면 CLI 기본 모델" /></label>
    <label>타임아웃 (ms)<input type="number" step="10000" min="5000" bind:value={$settings.timeoutMs} /></label>
    <label class="inline-check"><input type="checkbox" bind:checked={$settings.offline} /> 오프라인 모드 (AI 호출 없이 로컬 뼈대만 사용)</label>
    <label class="inline-check"><input type="checkbox" bind:checked={$settings.showStatusBar} /> 하단 상태바 표시</label>
  </section>

  <section class="row">
    <button class="primary" onclick={save}>저장</button>
    <button onclick={test} disabled={$settings.offline || !$settings.command.trim()}>연결 테스트</button>
  </section>
  {#if testResult}<pre class="pre panel">{testResult}</pre>{/if}

  <section>
    <span class="label">모델 라우팅 — 경량 / 기본 / 고급</span>
    <p class="dim">
      단계마다 다른 CLI·모델을 쓸 수 있습니다. 위의 기본 실행기가 「기본」 티어이고,
      아래에서 경량·고급 티어를 별도로 켤 수 있습니다. 꺼진 티어는 기본 실행기로 폴백합니다.
    </p>
    {#each TIERS as tier (tier)}
      {@const p = $settings.profiles[tier]}
      <div class="tier" class:off={!p.enabled}>
        <div class="row tierhead">
          <label class="inline-check strongname">
            <input type="checkbox" checked={p.enabled} onchange={(e) => updateProfile(tier, { enabled: (e.currentTarget as HTMLInputElement).checked })} />
            {TIER_LABELS[tier]} 티어
          </label>
          {#if !p.enabled}<span class="dim">기본 실행기 사용</span>{/if}
          {#if p.enabled}
            <span class="grow"></span>
            <button class="quiet" onclick={() => runConnectionTest(TIER_LABELS[tier], tier)} disabled={$settings.offline || !p.command.trim()}>연결 테스트</button>
          {/if}
        </div>
        {#if p.enabled}
          <div class="row">
            {#each PROVIDER_PRESETS as preset}
              <button class:on={p.provider === preset.id} onclick={() => pickProfilePreset(tier, preset.id)}>{preset.label}</button>
            {/each}
          </div>
          <div class="form grid2">
            <label>명령어<input value={p.command} oninput={(e) => updateProfile(tier, { command: (e.currentTarget as HTMLInputElement).value })} placeholder="codex / claude / gemini" /></label>
            <label>모델 (선택)<input value={p.model} oninput={(e) => updateProfile(tier, { model: (e.currentTarget as HTMLInputElement).value })} placeholder="비우면 CLI 기본 모델" /></label>
            <label>타임아웃 (ms)<input type="number" step="10000" min="5000" value={p.timeoutMs} oninput={(e) => updateProfile(tier, { timeoutMs: Number((e.currentTarget as HTMLInputElement).value) || 180000 })} /></label>
          </div>
        {/if}
      </div>
    {/each}
  </section>

  <section>
    <span class="label">파이프라인별 티어 배정</span>
    <p class="dim">각 단계 묶음이 어떤 티어로 실행될지 정합니다. 집필은 고급, 정제·요약은 경량이 기본입니다.</p>
    <div class="stages">
      {#each STAGE_GROUPS as g (g.id)}
        <div class="stage">
          <div class="stagename">
            <b>{g.label}</b>
            <span class="dim">{g.hint}</span>
          </div>
          <div class="row tiersel">
            {#each ['light', 'standard', 'heavy'] as const as t}
              <button
                class:on={($settings.stageTiers[g.id] ?? 'standard') === t}
                onclick={() => settings.update((s) => ({ ...s, stageTiers: { ...s.stageTiers, [g.id]: t } }))}
              >{tierName(t)}</button>
            {/each}
          </div>
          <span class="dim mono resolved">{tierSummary($settings.stageTiers[g.id] ?? 'standard')}</span>
        </div>
      {/each}
    </div>
  </section>

  <section class="form grid2">
    <span class="label wide">컨텍스트 예산</span>
    <label>선별 자료 예산 (자)
      <input type="number" step="1000" min="2000" bind:value={$settings.contextBudgetChars} />
    </label>
    <label>정제 발동 기준 (자)
      <input type="number" step="500" min="1000" bind:value={$settings.distillThresholdChars} />
    </label>
    <p class="dim wide">
      바이블·인물·세계 문서는 이번 화 관련도로 선별해 예산 안에서만 프롬프트에 들어갑니다.
      선별 결과가 정제 기준을 넘으면 「컨텍스트 정제」 단계(경량 티어 기본)가 집필용 캡슐로 압축합니다.
    </p>
  </section>

  <section>
    <span class="label">프롬프트 투명성</span>
    <p class="dim">
      모든 단계의 프롬프트 원본은 저장소의 <code>prompts/*.prompt.md</code> blueprint 파일이며,
      실제 전송된 프롬프트는 실행마다 프로젝트의 <code>.bindery/trace/</code>에 파일로 남습니다.
      run 기록은 <code>.bindery/runs/</code>에서 확인할 수 있습니다.
    </p>
  </section>
</div>

<style>
  .surface { padding: 20px 28px; display: grid; gap: 16px; align-content: start; max-width: 720px; }
  .head h1 { margin: 0; font-size: 22px; }
  .head p { margin: 2px 0 0; }
  section { display: grid; gap: 8px; border-top: 1px solid var(--line); padding-top: 12px; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .grow { flex: 1; }
  .form label { display: grid; gap: 3px; font-size: 12px; color: var(--muted); }
  .form.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .form.grid2 .wide { grid-column: 1 / -1; }
  .inline-check { display: flex !important; gap: 6px; align-items: center; }
  .strongname { color: var(--text); font-weight: 650; }
  .panel { border: 1px solid var(--line); border-radius: 4px; padding: 10px; background: var(--bg-1); }

  .tier { display: grid; gap: 8px; border: 1px solid var(--line); border-radius: 4px; padding: 10px 12px; background: var(--bg-1); }
  .tier.off { background: transparent; }
  .tierhead { min-height: 26px; }

  .stages { display: grid; border-top: 1px solid var(--line); }
  .stage {
    display: grid; gap: 6px;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    padding: 9px 2px;
    border-bottom: 1px solid var(--line);
  }
  .stagename { display: grid; gap: 1px; min-width: 0; }
  .stagename .dim { font-size: 11.5px; }
  .tiersel button { font-size: 12px; padding: 3px 10px; }
  .resolved { grid-column: 1 / -1; font-size: 11px; }
  @media (max-width: 620px) {
    .stage { grid-template-columns: minmax(0, 1fr); }
    .form.grid2 { grid-template-columns: 1fr; }
  }
</style>
