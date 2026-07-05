<script lang="ts">
  // 설정 — AI 실행기(CLI) 프로필. 특정 provider 고정 없음, 사용자가 명령과 인자를 소유한다.
  // 저장 위치: 프로젝트의 .bindery/settings.json (local-first).
  import { ctx, settings, persistSettings, withBusy, toast } from '$lib/stores/app';
  import { PROVIDER_PRESETS, applyPreset, toAgentSettings } from '$lib/harness/agentSettings';

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

  async function test() {
    syncArgs();
    testResult = '';
    await withBusy('연결 테스트', async () => {
      const c = ctx();
      const result = await c.bridge.runAgent(
        c.root,
        '아래 단어 하나만 출력하라: BINDERY-OK',
        'connection-test',
        toAgentSettings($settings)
      );
      testResult = result.ok
        ? `응답 확인 (exit ${result.exitCode}, ${result.durationMs}ms): ${result.text.slice(0, 200)}`
        : `실패 (${result.mode}, exit ${result.exitCode}): ${result.stderr.slice(0, 300) || '출력 없음'}`;
      toast(result.ok ? 'AI 실행기 응답 확인' : 'AI 실행기 연결 실패', result.ok ? 'ok' : 'bad');
    }, false);
  }
</script>

<div class="surface">
  <header class="head">
    <h1>설정 — AI 실행기</h1>
    <p class="dim">CLI 명령과 인자를 직접 설정합니다. {'{prompt}'} {'{model}'} 자리가 실행 시 치환됩니다. 저장: .bindery/settings.json</p>
  </header>

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
  </section>

  <section class="row">
    <button class="primary" onclick={save}>저장</button>
    <button onclick={test} disabled={$settings.offline || !$settings.command.trim()}>연결 테스트</button>
  </section>
  {#if testResult}<pre class="pre panel">{testResult}</pre>{/if}

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
  .row { display: flex; gap: 8px; flex-wrap: wrap; }
  .form label { display: grid; gap: 3px; font-size: 12px; color: var(--muted); }
  .inline-check { display: flex !important; gap: 6px; align-items: center; }
  .panel { border: 1px solid var(--line); border-radius: 4px; padding: 10px; background: var(--bg-1); }
</style>
