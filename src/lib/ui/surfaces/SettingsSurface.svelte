<script lang="ts">
  // 설정 - AI 실행기(CLI) 프로필. 특정 provider 고정 없음, 사용자가 명령과 인자를 소유한다.
  // 저장 위치: 프로젝트의 .bindery/settings.json (local-first).
  import { ctx, settings, persistSettings, withBusy, toast, usageSummary, providerUsage, refreshUsage } from '$lib/stores/app';
  import {
    PROVIDER_PRESETS, STAGE_GROUPS, applyPreset, toAgentSettings, toAgentSettingsForTier,
    type AgentTier, type TierProfile
  } from '$lib/harness/agentSettings';
  import { fetchProviderUsage, formatTokens, formatUsd, type ModelRate } from '$lib/harness/usage';

  let argsText = $state('');
  let argsWithModelText = $state('');
  let testResult = $state('');
  // null: 이번 세션에 아직 테스트 안 함 · true/false: 마지막 기본 티어 테스트 결과
  let testOk = $state<boolean | null>(null);

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
        : `[${label}] 실패 (${result.mode}, exit ${result.exitCode}): ${failureHint(result.mode, result.stderr)}${result.stderr.slice(0, 300) || '출력 없음'}`;
      if (tier === 'standard') testOk = result.ok;
      toast(result.ok ? `${label} 실행기 응답 확인` : `${label} 실행기 연결 실패`, result.ok ? 'ok' : 'bad');
    }, false);
  }

  /** 실패 모드를 원인 후보로 번역 - 초보 사용자가 바로 조치할 수 있게. */
  function failureHint(mode: string, stderr = ''): string {
    if (stderr.includes('trusted directory') || stderr.includes('skip-git-repo-check')) {
      return 'Codex 비 Git 폴더 실행 옵션이 빠졌습니다. 최신 Codex 프리셋을 다시 선택한 뒤 저장하세요. · ';
    }
    if (mode === 'spawn-error') return '명령을 찾을 수 없음 - CLI 미설치이거나 경로 문제. 절대 경로를 넣어보세요. · ';
    if (mode === 'timeout') return '응답 시간 초과 - 로그인이 안 됐거나 모델이 느립니다. · ';
    if (mode === 'unavailable') return '실행기 없음 - 데모(메모리) 모드입니다. · ';
    return '';
  }

  const test = () => runConnectionTest('기본', 'standard');

  // 티어 프로필 편집 헬퍼 - settings.profiles[tier]를 부분 갱신한다.
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

  const hasCommand = $derived(Boolean($settings.command.trim()));
  // 'none': 명령 없음 · 'untested': 명령 있으나 미검증 · 'ok'/'fail': 테스트 결과
  const connState = $derived<'none' | 'untested' | 'ok' | 'fail'>(
    !hasCommand ? 'none' : testOk === true ? 'ok' : testOk === false ? 'fail' : 'untested'
  );
  const overBudget = $derived($usageSummary.budgetUsd > 0 && $usageSummary.budgetRatio >= 1);
  const nearBudget = $derived($usageSummary.budgetUsd > 0 && $usageSummary.budgetRatio >= 0.8 && $usageSummary.budgetRatio < 1);

  function updateRate(i: number, patch: Partial<ModelRate>) {
    settings.update((s) => {
      const rates = s.modelRates.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
      return { ...s, modelRates: rates };
    });
  }

  async function loadProviderUsage() {
    await withBusy('실제 사용량 조회', async () => {
      const u = await fetchProviderUsage(ctx());
      await refreshUsage();
      toast(u.ok ? '실행기 사용량을 불러왔습니다.' : '사용량 응답이 비어 있습니다 - 실행기가 /usage를 지원하는지 확인하세요.', u.ok ? 'ok' : 'warn');
    }, false);
  }
</script>

<div class="surface">
  <header class="head">
    <h1>설정 - AI 실행기</h1>
    <p class="dim">CLI 명령과 인자를 직접 설정합니다. {'{prompt}'} {'{model}'} 자리가 실행 시 치환됩니다. 저장: .bindery/settings.json</p>
  </header>

  {#if !$settings.offline && (connState === 'none' || connState === 'fail')}
    <section class="onboarding">
      <div class="ob-head">
        <span class="chip {connState === 'fail' ? 'bad' : 'warn'}">{connState === 'fail' ? '연결 실패' : '연결 안 됨'}</span>
        <b>{connState === 'fail' ? '실행기 응답이 없습니다' : 'AI 실행기를 먼저 연결하세요'}</b>
      </div>
      <p class="dim">Bindery는 사용자의 CLI(자기 API 키/구독)를 그대로 씁니다 - 앱은 별도 요금이 없습니다.
        아래 중 하나를 설치·로그인한 뒤 프리셋을 고르고 <b>연결 테스트</b>를 누르세요.
        <b class="bad-text">연결 전에는 모든 생성이 로컬 뼈대(AI 아님)로만 돌아 결과가 성의 없어 보입니다.</b></p>
      <ol class="ob-steps">
        <li><b>CLI 설치·로그인</b> - 터미널에서 하나 선택:
          <ul>
            <li><code class="mono">claude</code> (Claude Code) → <code class="mono">claude</code> 실행 후 로그인</li>
            <li><code class="mono">codex</code> (OpenAI Codex CLI) → <code class="mono">codex login</code></li>
            <li><code class="mono">agy</code> (이 머신의 Gemini 실행기) → 실행 후 로그인/키 설정</li>
          </ul>
        </li>
        <li><b>프리셋 선택</b> - 아래 프리셋에서 설치한 CLI를 고르면 명령/인자가 자동 채워집니다.</li>
        <li><b>연결 테스트</b> - 초록 응답이 뜨면 완료. 실패 메시지는 원인(미설치·로그인 만료·경로)을 알려줍니다.</li>
      </ol>
      <p class="dim small">전역 명령이 안 잡히면 명령어 칸에 절대 경로(예: <code class="mono">/opt/homebrew/bin/claude</code>)를 넣으세요.
        AI 없이 구조만 시험하려면 아래 <b>오프라인 모드</b>를 켜면 이 안내가 사라집니다.</p>
    </section>
  {:else if !$settings.offline && connState === 'untested'}
    <section class="onboarding">
      <span class="chip warn">미확인</span>
      <span>실행기 <b>{$settings.command}</b>가 설정돼 있습니다. 아래 <b>연결 테스트</b>로 실제 응답을 확인하세요 -
        확인 전에는 실패 시 조용히 로컬 뼈대로 폴백됩니다.</span>
    </section>
  {:else if !$settings.offline && connState === 'ok'}
    <section class="onboarding ok">
      <span class="chip ok">연결됨</span>
      <span>기본 실행기: <b>{$settings.command}</b>{$settings.model ? ` · ${$settings.model}` : ''}.</span>
    </section>
  {/if}

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
    <span class="label">모델 라우팅 - 경량 / 기본 / 고급</span>
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
    <div class="usage-head">
      <span class="label">AI 사용량 · 추정 요금</span>
      <span class="dim">토큰·요금은 추정치입니다 (CLI가 실제 usage를 주지 않아 글자 수 기반 근사).</span>
    </div>
    <div class="usage-cards">
      <div class="ucard">
        <span class="ulabel">이번 달 ({$usageSummary.thisMonthKey})</span>
        <b class="ucost" class:over={overBudget} class:near={nearBudget}>~{formatUsd($usageSummary.thisMonth.costUsd)}</b>
        <span class="dim">{formatTokens($usageSummary.thisMonth.promptTokens + $usageSummary.thisMonth.outputTokens)} 토큰 · {$usageSummary.thisMonth.runs}회 실행</span>
        {#if $usageSummary.budgetUsd > 0}
          <div class="bar"><div class="fill" class:over={overBudget} class:near={nearBudget} style:width={`${Math.min(100, $usageSummary.budgetRatio * 100)}%`}></div></div>
          <span class="dim">예산 {formatUsd($usageSummary.budgetUsd)}의 {Math.round($usageSummary.budgetRatio * 100)}%</span>
        {/if}
      </div>
      <div class="ucard">
        <span class="ulabel">전체 누적</span>
        <b class="ucost">~{formatUsd($usageSummary.all.costUsd)}</b>
        <span class="dim">{formatTokens($usageSummary.all.promptTokens + $usageSummary.all.outputTokens)} 토큰 · {$usageSummary.all.runs}회</span>
      </div>
    </div>

    <label class="budget">월 예산 상한 (USD, 0이면 없음)
      <input type="number" step="5" min="0" bind:value={$settings.monthlyBudgetUsd} onchange={save} />
    </label>

    <div class="provider-usage">
      <div class="row">
        <span class="label">실행기 실제 사용량</span>
        <span class="grow"></span>
        <button class="quiet" onclick={loadProviderUsage} disabled={$settings.offline || !$settings.command.trim()}>
          /usage 불러오기
        </button>
      </div>
      <p class="dim small">위 대시보드는 글자 수 기반 추정입니다. 실행기가 <code class="mono">/usage</code>를 지원하면
        (예: <code class="mono">agy</code>) 실제 사용량을 그대로 불러옵니다.</p>
      {#if $providerUsage}
        <div class="pu-meta dim">
          {$providerUsage.command} · {new Date($providerUsage.fetchedAt).toLocaleString()}
          {#if !$providerUsage.ok}<span class="chip warn">응답 없음</span>{/if}
        </div>
        <pre class="pre panel pu-raw">{$providerUsage.raw || '(빈 응답)'}</pre>
      {/if}
    </div>

    {#if $usageSummary.byScope.length}
      <details class="usage-detail">
        <summary>회차·월별 상세</summary>
        <div class="cols2 usage-tables">
          <div>
            <span class="label">회차별 (요금 높은 순)</span>
            <table class="grid">
              <tbody>
                {#each $usageSummary.byScope.slice(0, 12) as row (row.scope)}
                  <tr><td>{row.scope}</td><td class="num">{formatTokens(row.totals.promptTokens + row.totals.outputTokens)}</td><td class="num">~{formatUsd(row.totals.costUsd)}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
          <div>
            <span class="label">월별</span>
            <table class="grid">
              <tbody>
                {#each $usageSummary.byMonth.slice(0, 12) as row (row.month)}
                  <tr><td>{row.month}</td><td class="num">{formatTokens(row.totals.promptTokens + row.totals.outputTokens)}</td><td class="num">~{formatUsd(row.totals.costUsd)}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    {/if}

    <details class="usage-detail">
      <summary>모델 단가 (USD / 1M 토큰) - 자기 요금제에 맞게 조정</summary>
      <table class="grid rates">
        <thead><tr><th>모델 매칭</th><th>설명</th><th>입력</th><th>출력</th></tr></thead>
        <tbody>
          {#each $settings.modelRates as rate, i (i)}
            <tr>
              <td><input class="mono cell" value={rate.match} placeholder="(기본값)" oninput={(e) => updateRate(i, { match: (e.currentTarget as HTMLInputElement).value })} /></td>
              <td><input class="cell" value={rate.label} oninput={(e) => updateRate(i, { label: (e.currentTarget as HTMLInputElement).value })} /></td>
              <td><input class="cell num" type="number" step="0.1" min="0" value={rate.inputPerM} oninput={(e) => updateRate(i, { inputPerM: Number((e.currentTarget as HTMLInputElement).value) || 0 })} /></td>
              <td><input class="cell num" type="number" step="0.1" min="0" value={rate.outputPerM} oninput={(e) => updateRate(i, { outputPerM: Number((e.currentTarget as HTMLInputElement).value) || 0 })} /></td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="dim">모델 id에 매칭 문자열이 포함되면 해당 단가를 씁니다(위에서부터). 빈 매칭은 기본값입니다.
        오프라인·로컬 뼈대 실행은 항상 $0으로 계산됩니다.</p>
    </details>
  </section>

  <section>
    <span class="label">프롬프트 투명성</span>
    <p class="dim">
      모든 단계의 프롬프트 원본은 저장소의 <code>prompts/*.prompt.md</code> blueprint 파일이며,
      실제 전송된 프롬프트는 실행마다 프로젝트의 <code>.bindery/trace/</code>에 파일로 남습니다.
      run 기록은 <code>.bindery/runs/</code>, 사용량 원장은 <code>.bindery/usage.json</code>에 있습니다.
    </p>
  </section>
</div>

<style>
  .surface { padding: 20px 28px; display: grid; gap: 16px; align-content: start; max-width: 720px; }
  .head h1 { margin: 0; font-size: 22px; }
  .head p { margin: 4px 0 0; }
  section { display: grid; gap: 8px; border-top: 1px solid var(--line); padding-top: 12px; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .grow { flex: 1; }
  .form label { display: grid; gap: 4px; font-size: 12px; color: var(--muted); }
  .form.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .form.grid2 .wide { grid-column: 1 / -1; }
  .inline-check { display: flex !important; gap: 8px; align-items: center; }
  .strongname { color: var(--text); font-weight: 650; }
  .panel { border: 1px solid var(--line); border-radius: 4px; padding: 8px; background: var(--bg-1); }

  .tier { display: grid; gap: 8px; border: 1px solid var(--line); border-radius: 4px; padding: 8px 12px; background: var(--bg-1); }
  .tier.off { background: transparent; }
  .tierhead { min-height: 24px; }

  .stages { display: grid; border-top: 1px solid var(--line); }
  .stage {
    display: grid; gap: 8px;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    padding: 8px 4px;
    border-bottom: 1px solid var(--line);
  }
  .stagename { display: grid; gap: 1px; min-width: 0; }
  .stagename .dim { font-size: 11.5px; }
  .tiersel button { font-size: 12px; padding: 4px 8px; }
  .resolved { grid-column: 1 / -1; font-size: 11px; }

  .onboarding { display: grid; gap: 8px; border: 1px solid var(--line-strong); border-radius: 4px; padding: 12px 12px; background: var(--bg-1); }
  .onboarding.ok { border-color: var(--ok-soft); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .ob-head { display: flex; gap: 8px; align-items: center; }
  .ob-head b { font-size: 14px; }
  .ob-steps { margin: 0; padding-left: 20px; display: grid; gap: 4px; font-size: 12.5px; line-height: 1.6; }
  .ob-steps ul { margin: 4px 0; padding-left: 16px; }
  .bad-text { color: var(--bad); }

  .usage-head { display: grid; gap: 4px; }
  .usage-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .ucard { display: grid; gap: 4px; border: 1px solid var(--line); border-radius: 4px; padding: 12px 12px; background: var(--bg-1); }
  .ulabel { font-size: 11px; color: var(--faint); }
  .ucost { font-size: 22px; font-weight: 750; font-variant-numeric: tabular-nums; }
  .ucost.near { color: var(--warn); }
  .ucost.over { color: var(--bad); }
  .bar { height: 4px; border-radius: 4px; background: var(--bg-rail); overflow: hidden; margin-top: 4px; }
  .fill { height: 100%; background: var(--accent); }
  .fill.near { background: var(--warn); }
  .fill.over { background: var(--bad); }
  .budget { display: grid; gap: 4px; font-size: 12px; color: var(--muted); max-width: 280px; }
  .provider-usage { display: grid; gap: 8px; border-top: 1px dashed var(--line); padding-top: 8px; }
  .pu-meta { display: flex; gap: 8px; align-items: center; font-size: 11.5px; }
  .pu-raw { max-height: 220px; overflow: auto; font-size: 11.5px; white-space: pre-wrap; }
  .usage-detail summary { cursor: pointer; color: var(--muted); font-size: 12.5px; padding: 4px 0; }
  .usage-tables { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .usage-tables .num, table.grid td.num { text-align: right; font-variant-numeric: tabular-nums; }
  table.grid.rates input.cell { width: 100%; padding: 4px 8px; font-size: 12px; }
  table.grid.rates input.num { text-align: right; }
  .cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  @media (max-width: 620px) {
    .stage { grid-template-columns: minmax(0, 1fr); }
    .form.grid2 { grid-template-columns: 1fr; }
    .usage-cards, .usage-tables, .cols2 { grid-template-columns: 1fr; }
  }
</style>
