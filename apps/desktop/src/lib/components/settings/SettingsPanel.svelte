<script lang="ts">
  import { settingsStore } from '$lib/stores/settingsStore';
  import { testAgentCli } from '$lib/api/commands';
  import { toasts } from '$lib/stores/toastStore';
  let testResult = '';
  let testing = false;
  async function test() {
    testing = true;
    const r = await testAgentCli($settingsStore.agentCliPath, $settingsStore.agentProvider, $settingsStore.agentOutputMode);
    testResult = r.ok ? r.stdout : r.stderr;
    testing = false;
    toasts.push(r.ok ? 'Agent CLI 응답 OK' : 'Agent CLI 실패', r.ok ? 'ok' : 'bad');
  }
</script>

<div class="card settings-card">
  <div class="kpi"><strong>AI 연결 설정</strong><button class="ghost tiny" on:click={test} disabled={testing}>{testing ? '…' : '연결 테스트'}</button></div>
  <label class="field">실행기
    <select bind:value={$settingsStore.agentProvider}>
      <option value="codex">Codex CLI</option>
      <option value="antigravity">Antigravity CLI</option>
      <option value="gemini">Gemini CLI</option>
      <option value="custom">직접 설정</option>
    </select>
  </label>
  <label class="field">명령어 <input bind:value={$settingsStore.agentCliPath} placeholder="codex 또는 /opt/homebrew/bin/codex" /></label>
  <label class="field">출력
    <select bind:value={$settingsStore.agentOutputMode}>
      <option value="file">파일로 받기</option>
      <option value="stdout">stdout</option>
    </select>
  </label>
  <label class="field">novelctl <input bind:value={$settingsStore.novelctlPath} /></label>
  <p class="mock-help">기본값은 이 Mac에서 검증한 Codex CLI입니다. Gemini는 현재 계정 정책상 headless 실행이 막힐 수 있고, Antigravity는 명령어를 agy로 바꾼 뒤 파일 출력을 선택하세요.</p>
  <div class="toggles">
    <label class="tg"><input type="checkbox" bind:checked={$settingsStore.mockMode} /> 데모 모드</label>
    <label class="tg"><input type="checkbox" bind:checked={$settingsStore.autosave} /> 자동 저장</label>
    <label class="tg"><input type="checkbox" bind:checked={$settingsStore.showLineNumbers} /> 줄 번호</label>
    <label class="tg"><input type="checkbox" bind:checked={$settingsStore.showMentions} /> 설정 언급</label>
    <label class="tg"><input type="checkbox" bind:checked={$settingsStore.smartInput} /> 스마트 입력</label>
  </div>
  <div class="font-row">
    <label class="field">본문 폰트
      <select bind:value={$settingsStore.editorFont}>
        <option value="serif">바탕</option>
        <option value="gothic">고딕</option>
      </select>
    </label>
    <label class="field">크기
      <input type="number" min="13" max="22" bind:value={$settingsStore.editorFontSize} />
    </label>
  </div>
  {#if testResult}<div class="console">{testResult}</div>{/if}
</div>

<style>
  .tiny { padding: 5px 9px; font-size: 11.5px; }
  .field { display: grid; grid-template-columns: 82px 1fr; align-items: center; gap: 8px; margin-top: 8px; font-size: 12.5px; color: var(--muted); }
  .field input, .field select { width: 100%; }
  .mock-help { margin: 8px 0 0; color: var(--faint); font-size: 11.5px; line-height: 1.5; }
  .toggles { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 10px; }
  .tg { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--muted); }
  .console { margin-top: 8px; }
  .font-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
  .font-row .field { grid-template-columns: 68px 1fr; }
</style>
